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

  it('renders matrix question with Portuguese localization by default or when language="pt"', () => {
    const question: QuestionConfig = {
      id: 'q_matrix_pt',
      type: 'matrix',
      title: 'Avaliação de Conhecimento',
      matrixRows: [
        { id: 'r1', label: 'Testes Unitários' },
        { id: 'r2', label: 'Integração Contínua' },
      ],
      matrixColumns: [
        { id: 'c1', label: 'Básico', shortLabel: '1' },
      ],
    }

    render(
      <QuestionRenderer
        question={question}
        value={{ r1: 'c1' }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        theme={theme}
        language="pt"
      />
    )

    expect(screen.getByText('Avaliação dos tópicos')).toBeInTheDocument()
    expect(screen.getByText('1 de 2 preenchidos')).toBeInTheDocument()
    expect(screen.getByText('Tópico')).toBeInTheDocument()
  })

  it('renders matrix question with English localization when language="en"', () => {
    const question: QuestionConfig = {
      id: 'q_matrix_en',
      type: 'matrix',
      title: 'Knowledge Evaluation',
      matrixRows: [
        { id: 'r1', label: 'Unit Testing' },
        { id: 'r2', label: 'Continuous Integration' },
      ],
      matrixColumns: [
        { id: 'c1', label: 'Basic', shortLabel: '1' },
      ],
    }

    render(
      <QuestionRenderer
        question={question}
        value={{ r1: 'c1' }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        theme={theme}
        language="en"
      />
    )

    expect(screen.getByText('Topic evaluation')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 completed')).toBeInTheDocument()
    expect(screen.getByText('Topic')).toBeInTheDocument()
  })

  it('renders yes_no question with Portuguese options "Sim" and "Não"', () => {
    const question: QuestionConfig = {
      id: 'q_yn_pt',
      type: 'yes_no',
      title: 'Você concorda?',
    }
    const onChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <QuestionRenderer
        question={question}
        value="Sim"
        onChange={onChange}
        onSubmit={onSubmit}
        theme={theme}
        language="pt"
      />
    )

    const simButton = screen.getByRole('button', { name: /sim/i })
    const naoButton = screen.getByRole('button', { name: /não/i })
    expect(simButton).toBeInTheDocument()
    expect(naoButton).toBeInTheDocument()

    fireEvent.click(naoButton)
    expect(onChange).toHaveBeenCalledWith('Não')
    expect(onSubmit).toHaveBeenCalledWith(true)
  })

  it('renders yes_no question with English options "Yes" and "No"', () => {
    const question: QuestionConfig = {
      id: 'q_yn_en',
      type: 'yes_no',
      title: 'Do you agree?',
    }
    const onChange = vi.fn()
    const onSubmit = vi.fn()

    render(
      <QuestionRenderer
        question={question}
        value="Yes"
        onChange={onChange}
        onSubmit={onSubmit}
        theme={theme}
        language="en"
      />
    )

    const yesButton = screen.getByRole('button', { name: /yes/i })
    const noButton = screen.getByRole('button', { name: /no/i })
    expect(yesButton).toBeInTheDocument()
    expect(noButton).toBeInTheDocument()

    fireEvent.click(noButton)
    expect(onChange).toHaveBeenCalledWith('No')
    expect(onSubmit).toHaveBeenCalledWith(true)
  })

  it('renders file_upload question with localized strings', () => {
    const question: QuestionConfig = {
      id: 'q_upload',
      type: 'file_upload',
      title: 'Upload Document',
      maxFileSize: 5,
    }

    const { rerender } = render(
      <QuestionRenderer
        question={question}
        value={null}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        theme={theme}
        language="pt"
      />
    )

    expect(screen.getByText('Clique para enviar')).toBeInTheDocument()
    expect(screen.getByText('Imagens e PDFs de até 5MB')).toBeInTheDocument()

    rerender(
      <QuestionRenderer
        question={question}
        value={null}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        theme={theme}
        language="en"
      />
    )

    expect(screen.getByText('Click to upload')).toBeInTheDocument()
    expect(screen.getByText('Images & PDFs up to 5MB')).toBeInTheDocument()
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
