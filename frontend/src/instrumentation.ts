// Paqshi (R2-16): run at server startup. Node's undici fetch was hitting
// connect-timeouts on the FIRST outbound request on Windows (black globe until
// the tile proxy warmed up). Forcing IPv4-first DNS resolution fixes the slow/
// failed connects (the hosts resolve AAAA records that time out on connect).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const dns = await import('node:dns');
      dns.setDefaultResultOrder('ipv4first');
    } catch {
      /* best-effort */
    }
  }
}
