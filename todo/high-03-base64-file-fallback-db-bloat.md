# Issue: Multi-Megabyte Base64 Fallback Stored in Postgres JSONB

**Severity**: HIGH  
**Category**: Database & Performance / Storage  
**File and line**: `components/form-player/question-renderer.tsx:48-67`

### What is wrong
In `handleFileSelect`, if the `/api/upload` endpoint returns a 503 status code (which occurs whenever R2 environment variables are not configured):
```typescript
if (response.status === 503 && !result.configured) {
  const reader = new FileReader()
  reader.onload = () => {
    onChange({
      name: file.name,
      type: file.type,
      size: file.size,
      url: reader.result as string, // base64 data URL
    })
    setIsUploading(false)
  }
  reader.readAsDataURL(file)
  return
}
```
The entire raw file (up to 10MB) is encoded into base64 and stored directly inside the `responses.answers` JSONB column.

### Why it matters
1. A 10MB binary file expands to ~13.3MB in base64. Storing multi-megabyte text payloads directly in Postgres JSONB columns causes severe database bloat, exhausts TOAST table storage, and severely degrades query latency for all operations on the `responses` table.
2. Converting a 10MB file to base64 in client memory frequently crashes or freezes mobile and low-memory browsers.
3. When the database responses are queried on the dashboard, the server must transfer gigabytes of base64 text over the wire, causing out-of-memory errors in Node.js.

### Concrete recommended fix
1. Remove the base64 database fallback completely.
2. Store binary files exclusively in an object store (Supabase Storage or Cloudflare R2).
3. If object storage is unconfigured or unavailable, return a clean user-facing error message informing the respondent that file upload is currently unavailable, rather than dumping large binary payloads into the transactional database.
