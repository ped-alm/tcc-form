'use server'

import { cookies, headers } from 'next/headers'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { Form, QuestionConfig, Json } from '@/lib/database.types'
import { validateAnswers } from '@/lib/validation'
import {
  exampleForm,
  EXAMPLE_FORM_ID,
  surveyTranslations,
  SurveyLanguage,
} from '@/lib/example-form'

export interface SubmitResponsePayload {
  formId: string
  answers: Record<string, Json>
  respondentHash?: string
  clientToken?: string
}

export interface SubmitResponseResult {
  success: boolean
  isDuplicate?: boolean
  error?: string
  validationErrors?: Record<string, string>
}

// In-memory rate limiting map: identifier -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10

function isRateLimited(identifier: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  // Clean up expired entries periodically
  if (rateLimitMap.size > 10000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (val.resetAt < now) {
        rateLimitMap.delete(key)
      }
    }
  }

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return true
  }

  entry.count += 1
  return false
}

async function getSupabaseSubmitClient() {
  const adminClient = createAdminClient()
  if (adminClient) return adminClient
  return await createClient()
}

// Helper to load form definition
async function getFormDefinition(formId: string): Promise<Form | null> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    if (formId === EXAMPLE_FORM_ID) return exampleForm
    return null
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('forms')
      .select('*')
      .eq('id', formId)
      .maybeSingle()

    if (error || !data) {
      if (formId === EXAMPLE_FORM_ID) return exampleForm
      return null
    }

    return data as Form
  } catch {
    if (formId === EXAMPLE_FORM_ID) return exampleForm
    return null
  }
}

/**
 * Server Action to validate and securely record anonymous form submissions.
 */
export async function submitResponseAction(
  payload: SubmitResponsePayload
): Promise<SubmitResponseResult> {
  const reqHeaders = await headers()
  const cookieStore = await cookies()

  // 1. Rate Limiting Check
  const clientIp =
    reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    reqHeaders.get('x-real-ip') ||
    payload.clientToken ||
    'unknown-client'

  if (isRateLimited(clientIp)) {
    return {
      success: false,
      error: 'Rate limit exceeded. Please wait a moment before trying again.',
    }
  }

  // 2. Fetch Form Definition
  const form = await getFormDefinition(payload.formId)
  if (!form) {
    return {
      success: false,
      error: 'Form not found.',
    }
  }

  if (form.status !== 'published') {
    return {
      success: false,
      error: 'This form is no longer accepting responses.',
    }
  }

  // 3. Resolve Questions Configuration based on Language
  const language = (payload.answers._survey_language as SurveyLanguage) || 'pt'
  const isSurvey = Boolean(
    form.questions &&
      (form.questions as QuestionConfig[]).some(q => q.id === 'q01-consentimento')
  )

  const questions: QuestionConfig[] = isSurvey
    ? surveyTranslations[language]?.questions || exampleForm.questions
    : (form.questions as QuestionConfig[]) || []

  // 4. Strict Server-Side Validation with Zod
  const validation = validateAnswers(payload.answers, questions, language)
  if (!validation.isValid) {
    return {
      success: false,
      validationErrors: validation.errors,
      error:
        language === 'en'
          ? 'Please review the highlighted questions before submitting.'
          : 'Por favor, revise os campos destacados antes de enviar.',
    }
  }

  // 5. Silent Deduplication Check
  // Check cookie marker first
  const cookieSubmitted = cookieStore.get(`survey_submitted_${payload.formId}`)
  if (cookieSubmitted?.value === '1') {
    // Silent deduplication: treat as success without inserting duplicate database record
    return {
      success: true,
      isDuplicate: true,
    }
  }

  // Check respondentHash in Supabase if configured and provided
  if (payload.respondentHash && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const client = await getSupabaseSubmitClient()
      const { data: existing } = await (client.from('responses') as ReturnType<typeof client.from>)
        .select('id')
        .eq('form_id', payload.formId)
        .eq('respondent_hash', payload.respondentHash)
        .maybeSingle()

      if (existing) {
        // Silent deduplication: user already submitted previously
        cookieStore.set(`survey_submitted_${payload.formId}`, '1', {
          path: '/',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 365, // 1 year
          sameSite: 'lax',
        })

        return {
          success: true,
          isDuplicate: true,
        }
      }
    } catch {
      // Continue to insertion if query check encounters transient error
    }
  }

  // 6. Database Insertion
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const client = await getSupabaseSubmitClient()
      const insertData = {
        form_id: payload.formId,
        answers: validation.sanitized,
        respondent_hash: payload.respondentHash || null,
      }

      const { error: insertError } = await (client.from('responses') as ReturnType<typeof client.from>)
        .insert(insertData as never)

      if (insertError) {
        console.error('Error inserting response to Supabase:', insertError)
        return {
          success: false,
          error:
            language === 'en'
              ? 'An error occurred while submitting your response. Please try again.'
              : 'Ocorreu um erro ao enviar sua resposta. Por favor, tente novamente.',
        }
      }
    } catch (err) {
      console.error('Database connection exception during submit:', err)
      return {
        success: false,
        error:
          language === 'en'
            ? 'Database connection error. Please try again.'
            : 'Erro de conexão com o banco de dados. Por favor, tente novamente.',
      }
    }
  }

  // 7. Mark completion in HTTP-only cookie
  try {
    cookieStore.set(`survey_submitted_${payload.formId}`, '1', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    })
  } catch {
    // Cookie setting might be ignored in non-standard request environments
  }

  return {
    success: true,
  }
}
