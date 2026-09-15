# Issue: In-Memory Response Counting and PostgREST 1,000-Row Limit

**Severity**: HIGH  
**Category**: Database & Performance / Correctness  
**File and line**: `app/(dashboard)/dashboard/page.tsx:23-36`

### What is wrong
To compute response counts for forms displayed on the user's dashboard, the component queries all raw response records for all forms:
```typescript
const { data: responseCounts } = formIds.length > 0 
  ? await supabase
      .from('responses')
      .select('form_id')
      .in('form_id', formIds)
  : { data: [] }
```
It then aggregates counts manually using a client-side JavaScript `Map`.

### Why it matters
1. **Silent Count Truncation**: PostgREST has a default query limit of 1,000 rows. If an active creator has forms that together have received more than 1,000 responses, the query silently stops returning rows past 1,000. Their response counters display incorrect, truncated numbers.
2. **Network and Memory Exhaustion**: Transferring thousands of rows over the network simply to count them is an $O(N)$ operational disaster that wastes database bandwidth, adds latency to every dashboard load, and wastes server memory.

### Concrete recommended fix
Use database-level counting instead of downloading rows.
Option A: Create a Postgres view for response counts:
```sql
CREATE OR REPLACE VIEW form_response_counts WITH (security_invoker = true) AS
SELECT form_id, count(*)::int AS count
FROM responses
GROUP BY form_id;
```
Query this view from Next.js:
```typescript
const { data: counts } = await supabase
  .from('form_response_counts')
  .select('form_id, count')
  .in('form_id', formIds)
```
Option B: Run headcount queries with `count: 'exact', head: true` in parallel using `Promise.all()`.
