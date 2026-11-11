export function createRateLimiter(limit: number, windowMs: number) {
  const counts = new Map<string, number>()
  let windowEnd = 0

  return (request: Request) => {
    const now = Date.now()
    if (now >= windowEnd) {
      counts.clear()
      windowEnd = now + windowMs
    }

    // Vercel sets this header. Local development uses one shared bucket.
    const key = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') || 'unknown' : 'local'
    const count = counts.get(key) ?? 0
    if (count >= limit || (!counts.has(key) && counts.size >= 2_000)) return false
    counts.set(key, count + 1)
    return true
  }
}
