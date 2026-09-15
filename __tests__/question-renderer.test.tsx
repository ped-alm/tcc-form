import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuestionRenderer } from '@/components/form-player/question-renderer'
import { themes } from '@/lib/themes'
import { QuestionConfig } from '@/lib/database.types'

describe('QuestionRenderer Component', () => {
  const theme = themes.ocean

  it('renders short_text input and handles change', () => {
    const question: QuestionConfig = {
      id: 'q_name',
      type: 'short_text',
      title: 'Full Name',
      placeholder: 'Enter your name...',
    }
    const onChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <QuestionRenderer
        question={question}
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
        theme={theme}
      />
    )

    const input = screen.getByPlaceholderText('Enter your name...')
    expect(input).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'Margaret Hamilton' } })
    expect(onChange).toHaveBeenCalledWith('Margaret Hamilton')
  })

  it('renders checkboxes and toggles item selection', () => {
    const question: QuestionConfig = {
      id: 'q_tools',
      type: 'checkboxes',
      title: 'Tools Used',
      options: ['Git', 'Docker', 'Linux'],
    }
    const onChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <QuestionRenderer
        question={question}
        value={['Git']}
        onChange={onChange}
        onSubmit={onSubmit}
        theme={theme}
      />
    )

    expect(screen.getByText('Git')).toBeInTheDocument()
    expect(screen.getByText('Docker')).toBeInTheDocument()
    expect(screen.getByText('Linux')).toBeInTheDocument()

    // Click on Docker to toggle it on
    fireEvent.click(screen.getByText('Docker'))
    expect(onChange).toHaveBeenCalledWith(['Git', 'Docker'])
  })

  it('renders dropdown options and selects choice', () => {
    const question: QuestionConfig = {
      id: 'q_exp',
      type: 'dropdown',
      title: 'Years of Experience',
      options: ['< 1 year', '1-3 years', '3+ years'],
    }
    const onChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <QuestionRenderer
        question={question}
        value="< 1 year"
        onChange={onChange}
        onSubmit={onSubmit}
        theme={theme}
      />
    )

    const optionButton = screen.getByText('3+ years')
    expect(optionButton).toBeInTheDocument()
    fireEvent.click(optionButton)
    expect(onChange).toHaveBeenCalledWith('3+ years')
  })

  it('renders matrix question with rows and columns and selects cells', () => {
    const question: QuestionConfig = {
      id: 'q_matrix',
      type: 'matrix',
      title: 'Topic Knowledge',
      matrixRows: [
        { id: 'r_ci', label: 'Continuous Integration' },
      ],
      matrixColumns: [
        { id: 'c_none', label: 'None', shortLabel: '0' },
        { id: 'c_adv', label: 'Advanced', shortLabel: '2' },
      ],
    }
    const onChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <QuestionRenderer
        question={question}
        value={{}}
        onChange={onChange}
        onSubmit={onSubmit}
        theme={theme}
      />
    )

    expect(screen.getAllByText('Continuous Integration').length).toBeGreaterThan(0)

    const cellButton = screen.getByLabelText('Continuous Integration: Advanced')
    expect(cellButton).toBeInTheDocument()
    fireEvent.click(cellButton)

    expect(onChange).toHaveBeenCalledWith({ r_ci: 'c_adv' })
  })

  it('applies error styling when error prop is provided', () => {
    const question: QuestionConfig = {
      id: 'q_req',
      type: 'short_text',
      title: 'Required Field',
      required: true,
      placeholder: 'Type here...',
    }

    render(
      <QuestionRenderer
        question={question}
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        theme={theme}
        error="This field cannot be empty"
      />
    )

    const input = screen.getByPlaceholderText('Type here...')
    expect(input).toHaveStyle({ borderColor: '#EF4444' })
  })
})
