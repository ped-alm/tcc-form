# Task: Evaluate Distributed Rate Limiting for Multi-Instance Serverless Deployment

**Severity**: LOW  
**Category**: Architecture & Scalability  
**Status**: Speculative Improvement  
**Files**: `app/actions/submit-response.ts` (lines 30-59)

---

### What is wrong
In `app/actions/submit-response.ts`:
```ts
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10

function isRateLimited(identifier: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)
  // ...
}
```
Rate limiting is held in an in-memory `Map` inside the Node.js module scope.

### Why it matters
In serverless environments (e.g. Vercel Fluid Compute, AWS Lambda), state is isolated to individual execution instances. When traffic scales, incoming requests are distributed across multiple lambda containers, each having an independent `rateLimitMap`. An automated bot or attacker distributing requests can easily bypass the 10 req/min limit.

Furthermore, per Vercel React best practices (`server-no-shared-module-state`), module-level mutable request state in RSC/SSR can retain state across invocations in unpredictable ways.

*Note*: Because this application also integrates Cloudflare Turnstile bot verification (which protects against automated spam submissions at the edge), this issue is considered a speculative improvement for high-traffic scenarios rather than a verified blocker.

### Concrete recommended fix
If strict IP/token rate limiting is required across distributed serverless instances:
1. Use an edge-compatible distributed store such as Upstash Redis (`@upstash/ratelimit`).
2. Alternatively, rely primarily on Cloudflare Turnstile (bot challenge verification) and WAF rules configured on Cloudflare or Vercel Edge.

### Verification
Simulate requests across multiple Node.js worker processes and observe whether rate limits are coordinated globally.
