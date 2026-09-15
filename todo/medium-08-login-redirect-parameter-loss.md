# Issue: Loss of Redirect Path on Unauthenticated Login

**Severity**: MEDIUM  
**Category**: Authentication & UX  
**File and line**: `app/(auth)/login/page.tsx:24`, `44`, `middleware.ts:50`

### What is wrong
When an unauthenticated user attempts to access a protected route (such as `/forms/123/edit` or `/forms/123/responses`), the middleware sets a redirect parameter:
```typescript
url.pathname = '/login'
url.searchParams.set('redirect', request.nextUrl.pathname)
return NextResponse.redirect(url)
```
However, `app/(auth)/login/page.tsx` never reads `searchParams.get('redirect')`. It hardcodes the OAuth and Magic Link callbacks to `/auth/callback` without forwarding `next`:
```typescript
redirectTo: `${window.location.origin}/auth/callback`
emailRedirectTo: `${window.location.origin}/auth/callback`
```

### Why it matters
When users click links to edit a form, view responses, or accept shared invitations, they are directed to sign in. Upon successful authentication, they are unconditionally sent to `/dashboard`, losing their target destination and disrupting user workflows.

### Concrete recommended fix
In `LoginPage`:
1. Read the `redirect` query parameter from `useSearchParams`:
   ```typescript
   const searchParams = useSearchParams()
   const redirect = searchParams.get('redirect')
   const redirectQuery = redirect ? `?next=${encodeURIComponent(redirect)}` : ''
   ```
2. Append `redirectQuery` to the callback URLs:
   ```typescript
   redirectTo: `${window.location.origin}/auth/callback${redirectQuery}`
   emailRedirectTo: `${window.location.origin}/auth/callback${redirectQuery}`
   ```
