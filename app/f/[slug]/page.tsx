import { cache } from 'react'
import { notFound } from 'next/navigation'
import { FormPlayer } from '@/components/form-player/form-player'
import { Form } from '@/lib/database.types'
import { exampleForm, EXAMPLE_FORM_SLUG } from '@/lib/example-form'

export const dynamic = 'force-dynamic'

interface FormPageProps {
  params: Promise<{ slug: string }>
}

const getFormBySlug = cache(async (slug: string): Promise<Form | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return slug === EXAMPLE_FORM_SLUG ? exampleForm : null
  }

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('forms')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()

    if (error || !data) {
      return slug === EXAMPLE_FORM_SLUG ? exampleForm : null
    }

    return data as Form
  } catch {
    return slug === EXAMPLE_FORM_SLUG ? exampleForm : null
  }
})

export async function generateMetadata({ params }: FormPageProps) {
  const { slug } = await params
  const form = await getFormBySlug(slug)

  if (!form) {
    return { title: 'Form Not Found' }
  }

  return {
    title: form.title || 'Form',
    description: form.description || 'Fill out this form',
  }
}

export default async function FormPage({ params }: FormPageProps) {
  const { slug } = await params
  const form = await getFormBySlug(slug)

  if (!form) {
    notFound()
  }

  return <FormPlayer form={form} />
}

