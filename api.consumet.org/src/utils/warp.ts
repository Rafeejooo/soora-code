import { SocksProxyAgent } from 'socks-proxy-agent';
import net from 'net';

/**
 * Cloudflare WARP SOCKS5 proxy utility.
 * WARP must be running in proxy mode on localhost:40000.
 *
 * Usage:
 *   import { WARP_AGENT, applyWarpToProvider } from '../utils/warp';
 *
 *   // Apply to a @consumet/extensions provider:
 *   const goku = new MOVIES.Goku();
 *   applyWarpToProvider(goku);
 */

const WARP_HOST = process.env.WARP_HOST || '127.0.0.1';
const WARP_PORT = Number(process.env.WARP_PORT) || 40000;
const WARP_URL = `socks5h://${WARP_HOST}:${WARP_PORT}`;

export const WARP_AGENT = new SocksProxyAgent(WARP_URL);

/**
 * Domains that should always route through WARP (IP-blocked CDNs).
 */
export const WARP_DOMAINS = [
  'silvercloud', 'owocdn', 'uwucdn', 'megacloud', 'megafiles',
  'vizcloud', 'rapid-cloud', 'rabbitstream', 'streameeeeee',
  'raffaellocdn', 'vidcloud', 'dokicloud',
  // Goku provider
  'goku.sx', 'img.goku', 'cdn.goku',
];

export const shouldUseWarp = (url: string): boolean => {
  try {
    const host = new URL(url).hostname;
    return WARP_DOMAINS.some((d) => host.includes(d));
  } catch {
    return false;
  }
};

/**
 * Apply WARP SOCKS5 proxy to a @consumet/extensions provider's
 * internal axios client. All HTTP requests from the provider will
 * be routed through Cloudflare WARP.
 */
export const applyWarpToProvider = (provider: any, logger?: any): boolean => {
  try {
    const client = provider.client;
    if (client?.defaults) {
      client.defaults.httpAgent = WARP_AGENT;
      client.defaults.httpsAgent = WARP_AGENT;
      client.defaults.timeout = 30000;
      logger?.info?.(`WARP proxy applied to provider`);
      return true;
    }
  } catch (e) {
    logger?.warn?.(`Failed to apply WARP: ${e}`);
  }
  return false;
};

/**
 * Quick check if WARP proxy is reachable (TCP connect test).
 * Resolves true/false, never throws.
 */
export const isWarpAvailable = (): Promise<boolean> =>
  new Promise((resolve) => {
    const sock = net.createConnection({ host: WARP_HOST, port: WARP_PORT }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.setTimeout(2000);
    sock.on('error', () => resolve(false));
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
