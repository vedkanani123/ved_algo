import "server-only";

const buckets = new Map<string, { count: number; resetAt: number }>();

// Best-effort per-instance protection. Configure Vercel WAF/rate limiting as the authoritative edge control.
export function withinRateLimit(key: string, maxRequests = 30, windowMs = 60_000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= maxRequests;
}
