# Issue: Request Waterfalls & Redundant Uncached Fetches

**Severity**: MEDIUM  
**Category**: Next.js 16 Architecture & Performance  
**File and line**: `app/f/[slug]/page.tsx:12-53`, `app/(dashboard)/dashboard/page.tsx:12-30`

### What is wrong
1. **Duplicate Uncached Queries in Dynamic Route**: In `app/f/[slug]/page.tsx`, `generateMetadata` issues a query to Supabase:
   ```typescript
   const { data } = await supabase.from('forms').select('title, description').eq('slug', slug)...
   ```
   Then `FormPage` executes a second query for the exact same form:
   ```typescript
   const { data, error } = await supabase.from('forms').select('*').eq('slug', slug)...
   ```
   Because Next.js 16 caching is opt-in and no `React.cache()` deduplication wrapper is used, every visit executes two redundant network round trips to Supabase.
2. **Sequential Waterfalls on Dashboard**: In `DashboardPage`, `getUser()`, the form query, and the response query execute sequentially instead of concurrently.

### Why it matters
Redundant round trips inflate Time-To-First-Byte (TTFB) and double database read traffic on public form pages. Sequential waterfalls on the dashboard make page loads unnecessarily sluggish.

### Concrete recommended fix
1. Deduplicate the form query using `React.cache`:
   ```typescript
   import { cache } from 'react'

   export const getFormBySlug = cache(async (slug: string) => {
     const supabase = await createClient()
     return await supabase.from('forms').select('*').eq('slug', slug).eq('status', 'published').maybeSingle()
   })
   ```
   Call `getFormBySlug` in both `generateMetadata` and `FormPage`.
2. In `DashboardPage`, initiate independent queries in parallel using `Promise.all()`.
