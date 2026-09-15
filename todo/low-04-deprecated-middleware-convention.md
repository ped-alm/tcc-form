# Issue: Deprecated Middleware Convention in Next.js 16

**Severity**: LOW  
**Category**: Next.js 16 Architecture  
**File and line**: `middleware.ts:1-20`

### What is wrong
`next build` emits the following deprecation warning:
```
The "middleware" file convention is deprecated. Please use "proxy" instead.
Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
```
In Next.js 16, `middleware.ts` is superseded by `proxy.ts` (running on the Node.js runtime under Fluid Compute).

### Why it matters
Legacy middleware conventions run on Edge runtime constraints by default in older deployments, causing awkward database connectivity and performance mismatches with Supabase. In future Next.js releases, support for `middleware.ts` may be dropped entirely.

### Concrete recommended fix
Migrate `middleware.ts` to `proxy.ts`:
1. Rename `middleware.ts` to `proxy.ts`.
2. Rename the exported function to `export async function proxy(request: NextRequest) { ... }`.
3. Verify session refresh works properly on Node.js runtime under Fluid Compute.
