import axios from 'axios';
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

  msgCount++;

  const statusText = getStatusText(report.status);
  const brief = [
    `<b>🚨 ERROR ${report.status} ${statusText}</b>`,
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
