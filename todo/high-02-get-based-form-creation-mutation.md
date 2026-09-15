# Issue: Side-Effecting Database Mutation on HTTP GET Request During Prefetching

**Severity**: HIGH  
**Category**: Next.js Architecture / Correctness  
**File and line**: `app/(dashboard)/forms/new/page.tsx:13-47`

### What is wrong
`NewFormPage` is an App Router server page responding to HTTP GET requests. When accessed, it creates a new form via a database `insert`:
```typescript
const { error } = await supabase
  .from('forms')
  .insert(newForm as never)
...
redirect(`/forms/${formId}/edit`)
```

### Why it matters
HTTP GET requests must be safe and idempotent. In Next.js App Router, `<Link href="/forms/new">` automatically prefetches routes in the background in production when visible in the viewport or hovered by the user. Because this route performs a write, background prefetch requests will automatically create orphaned empty forms in the database without user intention. Over time, this pollutes the database with junk records and degrades dashboard performance.

### Concrete recommended fix
Refactor form creation into a Server Action triggered only by explicit user interaction:
1. Define a Server Action `createFormAction()` in `app/actions/forms.ts`:
   ```typescript
   'use server'
   export async function createFormAction() {
     const supabase = await createClient()
     const { data: { user } } = await supabase.auth.getUser()
     if (!user) throw new Error('Unauthorized')
     
     const formId = crypto.randomUUID()
     const slug = generateSlug()
     await supabase.from('forms').insert({ id: formId, user_id: user.id, slug, ... })
     redirect(`/forms/${formId}/edit`)
   }
   ```
2. Replace `<Link href="/forms/new">` with a `<form action={createFormAction}>` or a button with `useTransition`.
3. If `/forms/new` remains a page, it should render an initial configuration form that only submits on button click via POST.
