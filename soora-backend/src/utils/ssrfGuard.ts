/**
 * SSRF guard for the URL-proxy routes (`/proxy`, `/manga-img`).
 *
 * Both routes fetch an arbitrary attacker-supplied `?url=`. Without validation
 * that lets anyone use the backend as an open proxy into private/internal
 * networks (cloud metadata, localhost services, other VPS ports). Scanners
 * already probe it (127.0.0.1:8025, 0.0.0.0:8080, *.oast.online OOB callbacks).
 *
 * Policy: only public http(s) hosts on standard web ports.
 */

// Private / loopback / link-local / metadata ranges that must never be reachable.
function isBlockedIp(host: string): boolean {
  // IPv6 loopback / unspecified
  if (host === '::1' || host === '::' || host === '0.0.0.0') return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1 etc.) — strip prefix and re-check
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isBlockedIp(mapped[1]);

  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false; // not a bare IPv4 literal
  const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
  if (a === 127) return true;                     // 127.0.0.0/8 loopback
  if (a === 10) return true;                      // 10.0.0.0/8 private
  if (a === 0) return true;                       // 0.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true;        // 192.168.0.0/16 private
  if (a === 169 && b === 254) return true;        // 169.254.0.0/16 link-local incl. cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true;                      // multicast / reserved
  return false;
}

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, ''); // drop trailing dot
  if (h === 'localhost') return true;
  if (h.endsWith('.localhost')) return true;
  if (h.endsWith('.internal') || h.endsWith('.local')) return true;
  if (h.endsWith('.oast.online') || h.endsWith('.oast.fun') || h.endsWith('.interact.sh')) return true; // common OOB SSRF probes
  return false;
}

/** Web ports we allow the proxy to reach. */
const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443']);

/**
 * Returns true if `rawUrl` is safe to fetch through the proxy.
 * Rejects non-http(s) schemes, private/loopback/metadata hosts, and odd ports.
 */
export function isUrlAllowed(rawUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (!ALLOWED_PORTS.has(u.port)) return false;

  const host = u.hostname;
  if (!host) return false;
  if (isBlockedHostname(host)) return false;
  if (isBlockedIp(host)) return false;

  return true;
}
