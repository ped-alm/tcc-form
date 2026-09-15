# Issue: Unsanitized Open Redirect in OAuth Callback

**Severity**: CRITICAL  
**Category**: Supabase Auth & Security / Correctness  
**File and line**: `app/auth/callback/route.ts:5-15`

### What is wrong
The OAuth callback route reads the `next` parameter directly from query string parameters:
```typescript
const next = searchParams.get('next') ?? '/dashboard'
...
return NextResponse.redirect(`${origin}${next}`)
```
It concatenates `next` directly without validating that `next` is a relative path originating from the same domain.

### Why it matters
An attacker can supply malicious payloads such as `next=@attacker.com` or `next=//evil.com` or `next=/\evil.com`. When an authenticated user signs in through a legitimate Google OAuth prompt, the callback will redirect their browser to the attacker's server. This creates an open redirect vulnerability commonly chained with phishing and token exfiltration attacks.

### Concrete recommended fix
Sanitize the `next` destination to ensure it strictly represents a relative internal path:
```typescript
function getSafeRedirectUrl(next: string | null, origin: string): string {
  if (!next) return `${origin}/dashboard`
  
  // Must start with single slash and not double slash or backslash
  if (next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
    try {
      const parsed = new URL(next, origin)
      if (parsed.origin === origin) {
        return parsed.toString()
      }
    } catch {
      // Fall through to default
    }
  }
  return `${origin}/dashboard`
}
```
Use this helper when constructing the redirect response:
```typescript
return NextResponse.redirect(getSafeRedirectUrl(next, origin))
```

### Resolution
Fixed by completely removing the auth system and `app/auth/callback/route.ts` as the application was converted to a form-only system without administrative login/dashboard routes. Data is accessed directly in Supabase.
