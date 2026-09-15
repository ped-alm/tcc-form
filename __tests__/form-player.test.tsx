import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { FormPlayer } from '@/components/form-player/form-player'
import { Form } from '@/lib/database.types'

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion')
  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  }
})

describe('FormPlayer Component', () => {
  const mockForm: Form = {
    id: 'test-form-id',
    title: 'Research Survey',
    description: 'A study on software development',
    slug: 'research-survey',
    status: 'published',
    theme: 'ocean',
    thank_you_message: 'Thanks for participating!',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        type: 'short_text',
        title: 'What is your current role?',
        required: true,
      },
      {
        id: 'q2',
        type: 'short_text',
        title: 'Any additional comments?',
        required: false,
      },
    ],
  }

  it('renders welcome screen with title and description', () => {
    render(<FormPlayer form={mockForm} />)

    expect(screen.getByText('Research Survey')).toBeInTheDocument()
    expect(screen.getByText(/A study on software development/)).toBeInTheDocument()
    expect(screen.getByText(/Iniciar pesquisa|Start/i)).toBeInTheDocument()
  })

  it('transitions to first question when start button is clicked', () => {
    render(<FormPlayer form={mockForm} />)

    const startButton = screen.getByRole('button', { name: /Iniciar pesquisa/i })
    fireEvent.click(startButton)

    expect(screen.getByText('What is your current role?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /OK/i })).toBeInTheDocument()
  })

  it('shows validation error when attempting to advance past an unanswered required question', () => {
    render(<FormPlayer form={mockForm} />)

    // Start the form
    fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/i }))

    // Click OK without filling required input
    const okButton = screen.getByRole('button', { name: /OK/i })
    fireEvent.click(okButton)

    expect(screen.getByText(/Este campo é obrigatório|This field is required/i)).toBeInTheDocument()
  })

  it('allows advancing to next question once required input is provided', () => {
    render(<FormPlayer form={mockForm} />)

    // Start
    fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/i }))

    // Fill in question 1
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Frontend Engineer' } })

    // Click OK
    const okButton = screen.getByRole('button', { name: /OK/i })
    fireEvent.click(okButton)

    // Transition to question 2
    expect(screen.getByText('Any additional comments?')).toBeInTheDocument()
  })

  it('maintains Turnstile widget and does not recreate it when user types on the last question', () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'test-site-key'
    let renderCount = 0
    let removeCount = 0
    let capturedCallback: ((token: string) => void) | null = null

    window.turnstile = {
      render: vi.fn((_el, options) => {
        renderCount++
        capturedCallback = options.callback
        return 'widget-last-q'
      }),
      reset: vi.fn(),
      remove: vi.fn(() => {
        removeCount++
      }),
    }

    render(<FormPlayer form={mockForm} />)

    // Advance to question 1
    fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/i }))
    // Fill Q1
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Frontend Engineer' } })
    fireEvent.click(screen.getByRole('button', { name: /OK/i }))

    // Now on Q2 (last question)
    expect(screen.getByText('Any additional comments?')).toBeInTheDocument()
    expect(renderCount).toBe(1)
    expect(removeCount).toBe(0)

    // Simulate Turnstile challenge being solved first
    act(() => {
      capturedCallback?.('solved-turnstile-token')
    })

    // Now type in Q2's input
    const q2Input = screen.getByRole('textbox')
    fireEvent.change(q2Input, { target: { value: 'H' } })
    fireEvent.change(q2Input, { target: { value: 'He' } })
    fireEvent.change(q2Input, { target: { value: 'Hello' } })

    // Verify Turnstile widget was NOT removed or re-rendered
    expect(renderCount).toBe(1)
    expect(removeCount).toBe(0)

    // Submit button should NOT be disabled because turnstileToken was NOT cleared!
    const submitBtn = screen.getByRole('button', { name: /Enviar|Submit/i })
    expect(submitBtn).not.toBeDisabled()

    delete (window as unknown as { turnstile?: unknown }).turnstile
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  })
})
