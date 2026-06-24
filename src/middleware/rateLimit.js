// Very small in-memory rate limiter, keyed by IP.
// Good enough to stop casual abuse on a single-server demo deployment.
// If you run multiple server instances behind a load balancer, replace
// this with a shared store (e.g. Redis) so limits apply across instances.

const buckets = new Map();

function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: 'Too many requests. Please slow down and try again shortly.' });
    }
    next();
  };
}

module.exports = { rateLimit };
