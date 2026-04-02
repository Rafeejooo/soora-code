import axios from 'axios';
import { Request } from 'express';
import { config } from '../config';

export interface ErrorReport {
  status: number;
  method: string;
  url: string;
  source: 'frontend' | 'backend';
  page?: string;
  trigger?: string;
  timestamp: string;
  details?: {
    requestHeaders?: Record<string, any>;
    requestBody?: any;
    responseBody?: any;
    errorMessage?: string;
    stack?: string;
  };
}

const TELEGRAM_API = `https://api.telegram.org/bot${config.telegramBotToken}`;

// Rate limiting: max 20 messages per minute
let msgCount = 0;
let windowStart = Date.now();
const MAX_PER_MINUTE = 20;

function isRateLimited(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    msgCount = 0;
    windowStart = now;
  }
  return msgCount >= MAX_PER_MINUTE;
}

// Deduplication: suppress identical errors within a 5-minute window
const DEDUP_WINDOW = 5 * 60_000; // 5 minutes
const DEDUP_CLEANUP = 10 * 60_000; // cleanup entries older than 10 minutes
const dedupMap = new Map<string, { count: number; firstSeen: number }>();

function getFingerprint(report: ErrorReport): string {
  // Strip query params from URL for grouping
  const urlPath = report.url.split('?')[0];
  const msg = report.details?.errorMessage || '';
  return `${report.status}|${urlPath}|${msg}`;
}

function cleanupDedupMap(): void {
  const now = Date.now();
  for (const [key, entry] of dedupMap) {
    if (now - entry.firstSeen > DEDUP_CLEANUP) {
      dedupMap.delete(key);
    }
  }
}

/** Returns null if should send, or the suppressed count if deduplicated */
function checkDedup(report: ErrorReport): { send: boolean; suppressedCount: number } {
  const key = getFingerprint(report);
  const now = Date.now();
  const entry = dedupMap.get(key);

  if (!entry) {
    // First occurrence — allow send, start tracking
    dedupMap.set(key, { count: 0, firstSeen: now });
    return { send: true, suppressedCount: 0 };
  }

  if (now - entry.firstSeen < DEDUP_WINDOW) {
    // Within window — suppress and increment count
    entry.count++;
    return { send: false, suppressedCount: entry.count };
  }

  // Window expired — allow send with summary of suppressed count, then reset
  const suppressed = entry.count;
  dedupMap.set(key, { count: 0, firstSeen: now });
  return { send: true, suppressedCount: suppressed };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n... (truncated)';
}

function stringify(value: any): string {
  if (value === undefined || value === null) return 'N/A';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatFullDetail(report: ErrorReport): string {
  const sections: string[] = [];

  // Context section — so Claude/reader immediately understands the situation
  sections.push(`=== Error Summary ===
Status: ${report.status} ${getStatusText(report.status)}
Method: ${report.method}
URL: ${report.url}
Source: ${report.source}${report.page ? `\nPage: ${report.page}` : ''}${report.trigger ? `\nTrigger: ${report.trigger}` : ''}
Timestamp: ${report.timestamp}`);

  const details = report.details;
  if (!details) {
    sections.push('No additional technical details available.');
    return sections.join('\n\n');
  }

  if (details.errorMessage) {
    sections.push(`=== Error Message ===\n${details.errorMessage}`);
  }

  if (details.requestHeaders) {
    const { authorization, cookie, ...safeHeaders } = details.requestHeaders;
    const headerStr = stringify(safeHeaders);
    if (headerStr !== '{}') {
      sections.push(`=== Request Headers ===\n${headerStr}`);
    }
  }

  if (details.requestBody) {
    sections.push(`=== Request Body / Payload ===\n${stringify(details.requestBody)}`);
  }

  if (details.responseBody) {
    sections.push(`=== Response Body ===\n${stringify(details.responseBody)}`);
  }

  if (details.stack) {
    sections.push(`=== Stack Trace ===\n${details.stack}`);
  }

  return sections.join('\n\n');
}

export async function notifyError(report: ErrorReport): Promise<void> {
  if (!config.telegramBotToken || !config.telegramChatId) return;
  if (isRateLimited()) return;

  // Deduplication check
  cleanupDedupMap();
  const { send, suppressedCount } = checkDedup(report);
  if (!send) return;

  msgCount++;

  const statusText = getStatusText(report.status);
  const brief = [
    `<b>🚨 ERROR ${report.status} ${statusText}</b>`,
    suppressedCount > 0 ? `<i>(+${suppressedCount} same error suppressed in last 5m)</i>` : null,
    ``,
    `<b>URL:</b> ${report.method} ${escapeHtml(report.url)}`,
    `<b>Source:</b> ${report.source}`,
    report.page ? `<b>Page:</b> ${escapeHtml(report.page)}` : null,
    report.trigger ? `<b>Trigger:</b> ${escapeHtml(report.trigger)}` : null,
    `<b>Time:</b> ${report.timestamp}`,
  ].filter(Boolean).join('\n');

  try {
    const sent = await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: config.telegramChatId,
      text: brief,
      parse_mode: 'HTML',
    });

    const messageId = sent.data?.result?.message_id;

    // Send full detail as reply — self-contained, copy-paste ready for debugging
    if (messageId) {
      const fullDetail = formatFullDetail(report);
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: config.telegramChatId,
        text: `<b>📋 Full Error Detail (copy-paste ready)</b>\n\n<pre>${escapeHtml(truncate(fullDetail, 3500))}</pre>`,
        parse_mode: 'HTML',
        reply_parameters: { message_id: messageId },
      });
    }
  } catch (err: any) {
    console.error('[Telegram] Failed to send notification:', err.message);
  }
}

function getStatusText(status: number): string {
  const map: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return map[status] || 'Error';
}

/** Convenience helper for route catch blocks */
export function reportRouteError(req: Request, err: any, trigger?: string): void {
  notifyError({
    status: err.response?.status || err.status || 500,
    method: req.method,
    url: req.originalUrl,
    source: 'backend',
    trigger: trigger || req.path,
    timestamp: new Date().toISOString(),
    details: {
      errorMessage: err.message,
      stack: err.stack,
    },
  });
}
