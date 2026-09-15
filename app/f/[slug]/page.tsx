import { notFound } from 'next/navigation'
import { FormPlayer } from '@/components/form-player/form-player'
import { Form } from '@/lib/database.types'
import { exampleForm, EXAMPLE_FORM_SLUG } from '@/lib/example-form'

export const dynamic = 'force-dynamic'

interface FormPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: FormPageProps) {
  const { slug } = await params

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (slug === EXAMPLE_FORM_SLUG) {
      return {
        title: exampleForm.title,
        description: exampleForm.description || 'Fill out this form',
      }
    }
    return { title: 'Form Not Found' }
  }

  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data } = await supabase
      .from('forms')
      .select('title, description')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()

    const form = (data as { title: string; description: string | null } | null) ?? (slug === EXAMPLE_FORM_SLUG ? exampleForm : null)

    if (!form) {
      return { title: 'Form Not Found' }
    }

    return {
      title: form.title || 'Form',
      description: form.description || 'Fill out this form',
    }
  } catch {
    if (slug === EXAMPLE_FORM_SLUG) {
      return {
        title: exampleForm.title,
        description: exampleForm.description || 'Fill out this form',
      }
    }
    return { title: 'Form Not Found' }
  }
}

export default async function FormPage({ params }: FormPageProps) {
  const { slug } = await params

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (slug === EXAMPLE_FORM_SLUG) {
      return <FormPlayer form={exampleForm} />
    }
    notFound()
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

    const form = (data as Form | null) ?? (slug === EXAMPLE_FORM_SLUG ? exampleForm : null)

    if (error || !form) {
      notFound()
    }

    return <FormPlayer form={form} />
  } catch {
    if (slug === EXAMPLE_FORM_SLUG) {
      return <FormPlayer form={exampleForm} />
    }
    notFound()
  }
}

