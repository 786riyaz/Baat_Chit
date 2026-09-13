/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Good enough for a single Render instance. If you later scale to multiple
 * instances, swap this for a shared store (Redis) so limits are enforced
 * across all instances - this in-memory version only limits per-process.
 */
function createRateLimiter({ windowMs, max }) {
const hits = new Map();

setInterval(() => {
const now = Date.now();
for (const [key, entry] of hits.entries()) {
if (now - entry.windowStart > windowMs) hits.delete(key);
}
}, Math.min(windowMs, 60000)).unref();

return function rateLimit(key) {
const now = Date.now();
const entry = hits.get(key);
if (!entry || now - entry.windowStart > windowMs) {
hits.set(key, { windowStart: now, count: 1 });
return { limited: false };
}
entry.count += 1;
if (entry.count > max) {
const retryAfterMs = windowMs - (now - entry.windowStart);
return { limited: true, retryAfterMs };
}
return { limited: false };
};
}

module.exports = { createRateLimiter };
