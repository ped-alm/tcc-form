# Issue: Unused Dead Code and Imports Flagged by Linter

**Severity**: LOW  
**Category**: Code Hygiene & Maintainability  
**File and line**: `components/form-builder/form-builder.tsx:52`, `components/form-player/form-player.tsx:6-15`, `components/form-builder/form-preview.tsx:6`, `components/responses/responses-dashboard.tsx:118, 438`, `supabase/schema.sql:185-200`

### What is wrong
1. **Unused imports and variables**:
   - `router` in `components/form-builder/form-builder.tsx:52`
   - `Check` in `components/form-builder/form-preview.tsx:6`
   - `themeList`, `Palette`, `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` in `components/form-player/form-player.tsx:6-15`
   - `router` in `components/responses/responses-dashboard.tsx:118`
2. **Unoptimized `<img>` Tag**: Line 438 of `responses-dashboard.tsx` uses raw `<img />` instead of `next/image`'s `<Image />`.
3. **Dead Database Function**: The stored function `generate_unique_slug(base_slug TEXT, uid UUID)` in `supabase/schema.sql` is never invoked anywhere in the codebase.

### Why it matters
Dead code and unused imports create noise in code reviews, bloat client bundle payloads, and trigger linter warnings that obscure real errors.

### Concrete recommended fix
1. Remove all unused imports and variables across all components.
2. Replace the raw `<img>` element with Next.js `<Image src={filePreview.url} alt={filePreview.name} width={800} height={600} />`.
3. Drop the dead `generate_unique_slug` SQL function or adapt it to enforce global slug uniqueness.
