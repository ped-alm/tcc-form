# Issue: Unauthenticated Public File Upload Endpoint

**Severity**: CRITICAL  
**Category**: Supabase & Storage Security / Correctness  
**File and line**: `app/api/upload/route.ts:28-94`

### What is wrong
The `POST` route handler in `app/api/upload/route.ts` allows any client on the public internet to upload files up to 10MB to Cloudflare R2. It does not check user authentication via Supabase Auth, does not verify that the request is associated with an existing published form, and does not enforce rate limiting or magic number content validation.

### Why it matters
Anyone can use this endpoint as a free, anonymous file-hosting service. Malicious actors can script automated uploads to rapidly exhaust cloud storage quotas and bandwidth limits, incur severe financial costs, upload malware or illegal content, or perform denial of service attacks against the storage infrastructure.

### Concrete recommended fix
1. If file uploads are only intended for authenticated form creators (e.g. form logos/assets), verify the session at the beginning of the handler:
   ```typescript
   const supabase = await createClient()
   const { data: { user } } = await supabase.auth.getUser()
   if (!user) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
   }
   ```
2. If file uploads are intended for respondents answering forms, bind the upload to a specific form ID and question ID:
   - Validate that `formId` exists, is in `published` status, and contains a `file_upload` question with matching file extensions.
   - Issue temporary pre-signed upload URLs rather than proxying raw bytes through the Next.js server.
   - Enforce IP-based rate limiting (via Upstash Redis or Cloudflare WAF).
   - Alternatively, migrate to Supabase Storage with dedicated Row Level Security policies.


### Resolution
Fixed by completely removing the unauthenticated `/api/upload` route handler (`app/api/upload/route.ts`), removing unused `@aws-sdk/client-s3` dependency, and updating `components/form-player/question-renderer.tsx` to prevent requests to the removed endpoint.
