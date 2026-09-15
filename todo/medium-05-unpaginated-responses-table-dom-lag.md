# Issue: Unpaginated Responses Table Causing DOM Lag

**Severity**: MEDIUM  
**Category**: Performance & Component Architecture  
**File and line**: `app/(dashboard)/forms/[id]/responses/page.tsx:34-40`, `components/responses/responses-dashboard.tsx:290-340`

### What is wrong
In `ResponsesPage`, all responses for a form are fetched without pagination:
```typescript
const { data: responsesData } = await supabase
  .from('responses')
  .select('*')
  .eq('form_id', id)
  .order('submitted_at', { ascending: false })
```
In `ResponsesDashboard`, every single response row is rendered directly inside a `<TableBody>` in the DOM simultaneously.

### Why it matters
For active forms with hundreds or thousands of submissions across dozens of questions, rendering thousands of DOM table rows and cells causes substantial browser frame drops, input lag in the search box, and high browser memory usage, leading to tab crashes on mobile or low-spec devices.

### Concrete recommended fix
1. Implement server-side pagination with query search parameters:
   ```typescript
   const page = Number(searchParams.page ?? 1)
   const pageSize = 50
   const from = (page - 1) * pageSize
   const to = from + pageSize - 1
   const { data, count } = await supabase
     .from('responses')
     .select('*', { count: 'exact' })
     .eq('form_id', id)
     .range(from, to)
   ```
2. Render page navigation controls (`Next`, `Previous`, page count) on `ResponsesDashboard`.
3. Alternatively, for large datasets without server pagination, virtualize the table rows using `@tanstack/react-virtual`.
