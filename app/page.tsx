import { FormPlayer } from '@/components/form-player/form-player'
import { Form } from '@/lib/database.types'
import { exampleForm, EXAMPLE_FORM_SLUG } from '@/lib/example-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: exampleForm.title,
  description: exampleForm.description ?? undefined,
}

// Loads the example form from Supabase when it is already seeded
// (supabase/seed-example-form.sql); otherwise falls back to the local definition
// so the form is always rendered.
async function getExampleForm(): Promise<Form> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return exampleForm
    }

    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data } = await supabase
      .from('forms')
      .select('*')
      .eq('slug', EXAMPLE_FORM_SLUG)
      .eq('status', 'published')
      .maybeSingle()

    return (data as Form | null) ?? exampleForm
  } catch {
    return exampleForm
  }
}

export default async function HomePage() {
  const form = await getExampleForm()

  return <FormPlayer form={form} />
}
