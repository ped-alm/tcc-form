import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { FormPlayer } from '@/components/form-player/form-player'
import { Form } from '@/lib/database.types'
import { toast } from 'sonner'
import { submitResponseAction } from '@/app/actions/submit-response'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('@/app/actions/submit-response', () => ({
  submitResponseAction: vi.fn(),
}))

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
    is_singleton: true,
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

  it('allows submission on the last question without Turnstile widget or verification', () => {
    render(<FormPlayer form={mockForm} />)

    // Advance to question 1
    fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/i }))
    // Fill Q1
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Frontend Engineer' } })
    fireEvent.click(screen.getByRole('button', { name: /OK/i }))

    // Now on Q2 (last question)
    expect(screen.getByText('Any additional comments?')).toBeInTheDocument()

    // Verify no Turnstile widget container is rendered
    expect(screen.queryByTestId('turnstile-container')).not.toBeInTheDocument()

    // Submit button should NOT be disabled
    const submitBtn = screen.getByRole('button', { name: /Enviar|Submit/i })
    expect(submitBtn).not.toBeDisabled()
  })

  it('does not intercept ArrowUp and ArrowDown inside a long_text textarea', () => {
    const formWithLongText: Form = {
      ...mockForm,
      questions: [
        {
          id: 'q_long',
          type: 'long_text',
          title: 'Describe your architecture',
          required: false,
        },
        {
          id: 'q_next',
          type: 'short_text',
          title: 'Next question',
          required: false,
        },
      ],
    }

    render(<FormPlayer form={formWithLongText} />)
    fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/i }))

    expect(screen.getByText('Describe your architecture')).toBeInTheDocument()
    const textarea = screen.getByRole('textbox')

    // Simulate pressing ArrowDown inside textarea
    const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    const downPrevented = !textarea.dispatchEvent(downEvent)

    expect(downPrevented).toBe(false)
    expect(screen.getByText('Describe your architecture')).toBeInTheDocument()
    expect(screen.queryByText('Next question')).not.toBeInTheDocument()

    // Simulate pressing ArrowUp inside textarea
    const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
    const upPrevented = !textarea.dispatchEvent(upEvent)

    expect(upPrevented).toBe(false)
    expect(screen.getByText('Describe your architecture')).toBeInTheDocument()
  })

  it('does not hijack Shift+Tab for goToPrevious navigation', () => {
    render(<FormPlayer form={mockForm} />)

    // Advance to question 2
    fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/i }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Frontend Engineer' } })
    fireEvent.click(screen.getByRole('button', { name: /OK/i }))

    expect(screen.getByText('Any additional comments?')).toBeInTheDocument()

    // Press Shift+Tab
    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    const shiftTabPrevented = !window.dispatchEvent(shiftTabEvent)

    // Verify it is not prevented and does NOT go back to question 1
    expect(shiftTabPrevented).toBe(false)
    expect(screen.getByText('Any additional comments?')).toBeInTheDocument()
    expect(screen.queryByText('What is your current role?')).not.toBeInTheDocument()
  })

  it('allows questionnaire step navigation with ArrowDown and ArrowUp when inputs are not focused', () => {
    const nonRequiredForm: Form = {
      ...mockForm,
      questions: [
        {
          id: 'q1',
          type: 'short_text',
          title: 'Question 1',
          required: false,
        },
        {
          id: 'q2',
          type: 'short_text',
          title: 'Question 2',
          required: false,
        },
      ],
    }

    render(<FormPlayer form={nonRequiredForm} />)
    fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/i }))

    expect(screen.getByText('Question 1')).toBeInTheDocument()

    // Focus on an action button outside input controls (e.g. the OK button)
    const okButton = screen.getByRole('button', { name: /OK/i })
    okButton.focus()

    // Press ArrowDown to advance
    act(() => {
      fireEvent.keyDown(okButton, { key: 'ArrowDown' })
    })

    expect(screen.getByText('Question 2')).toBeInTheDocument()

    // Press ArrowUp while focused on OK button to go back
    const nextOkButton = screen.getByRole('button', { name: /OK|Enviar|Submit/i })
    nextOkButton.focus()
    act(() => {
      fireEvent.keyDown(nextOkButton, { key: 'ArrowUp' })
    })

    expect(screen.getByText('Question 1')).toBeInTheDocument()
  })

  it('does not trigger step navigation when focused on question options', () => {
    const choiceForm: Form = {
      ...mockForm,
      questions: [
        {
          id: 'q_choice',
          type: 'dropdown',
          title: 'Choose your main language',
          options: ['TypeScript', 'Rust', 'Go'],
          required: false,
        },
        {
          id: 'q_after',
          type: 'short_text',
          title: 'Next step',
          required: false,
        },
      ],
    }

    render(<FormPlayer form={choiceForm} />)
    fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/i }))

    expect(screen.getByText('Choose your main language')).toBeInTheDocument()

    const optionBtn = screen.getByText('TypeScript')
    optionBtn.focus()

    const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    const downPrevented = !optionBtn.dispatchEvent(downEvent)

    expect(downPrevented).toBe(false)
    expect(screen.getByText('Choose your main language')).toBeInTheDocument()
    expect(screen.queryByText('Next step')).not.toBeInTheDocument()
  })

  it('does not trigger step navigation when focused on radio, checkbox, or select elements', () => {
    const container = document.createElement('div')
    const radio = document.createElement('input')
    radio.type = 'radio'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    const select = document.createElement('select')
    const option = document.createElement('option')
    select.appendChild(option)

    container.appendChild(radio)
    container.appendChild(checkbox)
    container.appendChild(select)
    document.body.appendChild(container)

    render(<FormPlayer form={mockForm} />)

    // Focus radio and dispatch ArrowDown
    radio.focus()
    const radioEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    const radioPrevented = !radio.dispatchEvent(radioEvent)
    expect(radioPrevented).toBe(false)

    // Focus checkbox and dispatch ArrowUp
    checkbox.focus()
    const checkboxEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
    const checkboxPrevented = !checkbox.dispatchEvent(checkboxEvent)
    expect(checkboxPrevented).toBe(false)

    // Focus select and dispatch ArrowDown
    select.focus()
    const selectEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    const selectPrevented = !select.dispatchEvent(selectEvent)
    expect(selectPrevented).toBe(false)

    document.body.removeChild(container)
  })

  it('displays submission failure toast and does not display thank-you screen when database persistence fails', async () => {
    vi.mocked(submitResponseAction).mockResolvedValueOnce({
      success: false,
      error: 'Database service is currently unavailable. Please contact the administrator.',
    })

    const singleQuestionForm: Form = {
      ...mockForm,
      questions: [
        {
          id: 'q1',
          type: 'short_text',
          title: 'Your Name',
          required: false,
        },
      ],
    }

    render(<FormPlayer form={singleQuestionForm} />)
    fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/i }))

    const submitBtn = screen.getByRole('button', { name: /Enviar|Submit/i })
    await act(async () => {
      fireEvent.click(submitBtn)
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    expect(toast.error).toHaveBeenCalledWith(
      'Database service is currently unavailable. Please contact the administrator.'
    )
    expect(screen.queryByText(/Pesquisa concluída!|Survey completed!/i)).not.toBeInTheDocument()
    expect(screen.getByText('Your Name')).toBeInTheDocument()
  })

  it('resets in-memory answers, validation errors, and localStorage submission marker when clicking back to start', async () => {
    vi.mocked(submitResponseAction).mockResolvedValueOnce({
      success: true,
    })

    render(<FormPlayer form={mockForm} />)

    // Start survey
    fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/i }))

    // Fill Q1
    const inputQ1 = screen.getByRole('textbox')
    fireEvent.change(inputQ1, { target: { value: 'Frontend Engineer' } })
    expect(inputQ1).toHaveValue('Frontend Engineer')

    // Click OK to go to Q2
    fireEvent.click(screen.getByRole('button', { name: /OK/i }))

    // Fill Q2
    const inputQ2 = screen.getByRole('textbox')
    fireEvent.change(inputQ2, { target: { value: 'Looking forward to results' } })

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Enviar|Submit/i })
    await act(async () => {
      fireEvent.click(submitBtn)
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // Check thank you screen
    expect(screen.getByText('Thanks for participating!')).toBeInTheDocument()
    expect(window.localStorage.getItem('survey_submitted_test-form-id')).toBe('true')

    // Click "Voltar ao início"
    const backBtn = screen.getByRole('button', { name: /Voltar ao início|Back to start/i })
    fireEvent.click(backBtn)

    // Should be on welcome screen
    expect(screen.getByText('Research Survey')).toBeInTheDocument()
    // LocalStorage marker should be removed
    expect(window.localStorage.getItem('survey_submitted_test-form-id')).toBeNull()

    // Start survey again
    fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/i }))

    // Verify Q1 textbox is now empty
    const freshInputQ1 = screen.getByRole('textbox')
    expect(freshInputQ1).toHaveValue('')
  })

  it('resets answers and validation errors when returning to start after declining consent', () => {
    const consentForm: Form = {
      ...mockForm,
      questions: [
        {
          id: 'q01-consentimento',
          type: 'dropdown',
          title: 'Termo de Consentimento',
          options: ['Sim, concordo.', 'Não concordo.'],
          required: true,
        },
      ],
    }

    render(<FormPlayer form={consentForm} />)

    // Start survey
    fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/i }))

    // First trigger a validation error by clicking OK without selecting an option
    fireEvent.click(screen.getByRole('button', { name: /OK/i }))
    expect(screen.getByText(/Este campo é obrigatório/i)).toBeInTheDocument()

    // Now select "Não concordo." (dropdown selection automatically proceeds)
    fireEvent.click(screen.getByRole('button', { name: /Não concordo\./i }))

    // Should show termination screen
    expect(screen.getByText('Agradecemos o seu tempo')).toBeInTheDocument()

    // Click "Voltar ao início"
    const backBtn = screen.getByRole('button', { name: /Voltar ao início/i })
    fireEvent.click(backBtn)

    // Welcome screen displayed
    expect(screen.getByText('Práticas de engenharia de software no desenvolvimento de jogos')).toBeInTheDocument()

    // Start survey again
    fireEvent.click(screen.getByRole('button', { name: /Iniciar pesquisa/i }))

    // Question 1 should be displayed with no option selected and no validation error
    expect(screen.queryByText(/Este campo é obrigatório/i)).not.toBeInTheDocument()
    const optionBtn = screen.getByRole('button', { name: /Não concordo\./i })
    expect(optionBtn).toBeInTheDocument()
  })
})
