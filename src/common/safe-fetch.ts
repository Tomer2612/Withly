import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';

// Fetching a URL a user typed (link previews) from the server is a classic
// SSRF hole: without checks, anyone could make the server request internal
// addresses — localhost services, the private network, or the EC2 instance
// metadata endpoint at 169.254.169.254. This helper only talks to public
// internet addresses.
//
// The address check runs inside the socket's DNS `lookup`, i.e. on the exact
// IP the connection is about to use. Checking a hostname first and connecting
// later would be bypassable by a DNS record that changes in between.

const BLOCKED = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, incl. cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
] as const) {
  BLOCKED.addSubnet(addr, prefix, 'ipv4');
}
for (const [addr, prefix] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
] as const) {
  BLOCKED.addSubnet(addr, prefix, 'ipv6');
}

/** @public Exported for test/security-misc.test.js. */
export function isPublicAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '');
  const family = net.isIP(ip);
  if (family === 4) return !BLOCKED.check(ip, 'ipv4');
  if (family === 6) {
    // IPv4-mapped / NAT64 forms carry an IPv4 address — judge that one. Both
    // spellings matter: the URL parser rewrites [::ffff:127.0.0.1] into the
    // hex form [::ffff:7f00:1].
    const dotted = ip.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/i);
    if (dotted) return !BLOCKED.check(dotted[1], 'ipv4');
    const hex = ip.match(
      /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i,
    );
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      const v4 = `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
      return !BLOCKED.check(v4, 'ipv4');
    }
    return !BLOCKED.check(ip, 'ipv6');
  }
  return false;
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number,
) => void;

// Drop-in replacement for dns.lookup that refuses non-public results. Handles
// both call styles Node uses (single address, or `all: true` for happy-eyeballs).
function publicOnlyLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: LookupCallback,
) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const list = addresses;
    if (list.length === 0 || list.some((a) => !isPublicAddress(a.address))) {
      const blocked: NodeJS.ErrnoException = new Error(
        `Blocked non-public address for ${hostname}`,
      );
      blocked.code = 'EBLOCKED';
      return callback(blocked, []);
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

export interface PublicFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
}

// GETs an http(s) page on a public address and returns its HTML (capped at
// maxBytes), or null when the URL is refused, unreachable or isn't HTML.
// Redirects are followed manually so every hop gets the same checks.
export async function fetchPublicHtml(
  rawUrl: string,
  {
    maxBytes = 512 * 1024,
    timeoutMs = 8000,
    maxRedirects = 3,
  }: PublicFetchOptions = {},
): Promise<{ html: string; finalUrl: string } | null> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return null;
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:')
      return null;
    // Standard web ports only — no probing of other services on a host.
    if (current.port && current.port !== '80' && current.port !== '443')
      return null;
    // An IP literal skips DNS (so skips the lookup check) — judge it here.
    const host = current.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host) && !isPublicAddress(host)) return null;

    const result = await requestOnce(current, maxBytes, timeoutMs);
    if (!result) return null;
    if ('redirect' in result) {
      try {
        current = new URL(result.redirect, current);
      } catch {
        return null;
      }
      continue;
    }
    return { html: result.html, finalUrl: current.toString() };
  }
  return null;
}

function requestOnce(
  url: URL,
  maxBytes: number,
  timeoutMs: number,
): Promise<{ html: string } | { redirect: string } | null> {
  return new Promise((resolve) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      url,
      {
        method: 'GET',
        lookup: publicOnlyLookup as unknown as typeof dns.lookup,
        timeout: timeoutMs,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; Withly/1.0; +https://withly.co.il)',
          Accept: 'text/html,application/xhtml+xml',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: res.headers.location });
        }
        const type = String(res.headers['content-type'] ?? '');
        if (
          status !== 200 ||
          !/text\/html|application\/xhtml\+xml/i.test(type)
        ) {
          res.resume();
          return resolve(null);
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            // Enough for the <head> meta tags; stop reading the rest.
            chunks.push(chunk.subarray(0, chunk.length - (size - maxBytes)));
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        const done = () =>
          resolve({ html: Buffer.concat(chunks).toString('utf8') });
        res.on('end', done);
        res.on('close', done);
        res.on('error', () => resolve(null));
      },
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
    req.end();
  });
}
