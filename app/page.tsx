import { FormPlayer } from '@/components/form-player/form-player'
import { Form } from '@/lib/database.types'
import { exampleForm } from '@/lib/example-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: exampleForm.title,
  description: exampleForm.description ?? undefined,
}

// Loads the single form from Supabase when seeded;
// otherwise falls back to the local definition so the form is always rendered.
async function getForm(): Promise<Form> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return exampleForm
    }

    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data } = await supabase
      .from('forms')
      .select('*')
      .eq('status', 'published')
      .maybeSingle()

    return (data as Form | null) ?? exampleForm
  } catch {
    return exampleForm
  }
}

export default async function HomePage() {
  const form = await getForm()

  return <FormPlayer form={form} />
}
