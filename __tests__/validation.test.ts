import { describe, it, expect } from 'vitest'
import { validateAnswers, validateSurveyAnswers } from '@/lib/validation'
import { QuestionConfig } from '@/lib/database.types'

describe('validateAnswers', () => {
  it('should validate required fields correctly', () => {
    const questions: QuestionConfig[] = [
      {
        id: 'q1',
        type: 'short_text',
        title: 'Your Name',
        required: true,
      },
    ]

    // Missing value
    const result1 = validateAnswers({}, questions, 'pt')
    expect(result1.isValid).toBe(false)
    expect(result1.errors['q1']).toBe('Este campo é obrigatório')

    // Empty string
    const result2 = validateAnswers({ q1: '' }, questions, 'en')
    expect(result2.isValid).toBe(false)
    expect(result2.errors['q1']).toBe('This field is required')

    // Empty array
    const result3 = validateAnswers({ q1: [] }, questions, 'pt')
    expect(result3.isValid).toBe(false)

    // Valid value
    const result4 = validateAnswers({ q1: 'Ada Lovelace' }, questions, 'en')
    expect(result4.isValid).toBe(true)
    expect(result4.sanitized['q1']).toBe('Ada Lovelace')
  })

  it('should allow optional fields to remain unanswered', () => {
    const questions: QuestionConfig[] = [
      {
        id: 'q1',
        type: 'short_text',
        title: 'Feedback',
        required: false,
      },
    ]

    const result = validateAnswers({}, questions, 'en')
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual({})
    expect(result.sanitized['q1']).toBeUndefined()
  })

  it('should preserve _survey_language in sanitized output', () => {
    const questions: QuestionConfig[] = []
    const result = validateAnswers({ _survey_language: 'en' }, questions, 'en')
    expect(result.sanitized._survey_language).toBe('en')
  })

  describe('dropdown validation', () => {
    const questions: QuestionConfig[] = [
      {
        id: 'q_role',
        type: 'dropdown',
        title: 'Role',
        required: true,
        options: ['Developer', 'Designer', 'Manager'],
      },
    ]

    it('should accept allowed options', () => {
      const result = validateAnswers({ q_role: 'Developer' }, questions, 'en')
      expect(result.isValid).toBe(true)
      expect(result.sanitized['q_role']).toBe('Developer')
    })

    it('should reject unlisted options', () => {
      const result = validateAnswers({ q_role: 'Hacker' }, questions, 'en')
      expect(result.isValid).toBe(false)
      expect(result.errors['q_role']).toBe('Selected option is not allowed')
    })

    it('should reject non-string or excessively long options', () => {
      const result = validateAnswers({ q_role: 'A'.repeat(501) }, questions, 'en')
      expect(result.isValid).toBe(false)
      expect(result.errors['q_role']).toBe('Invalid selection')
    })
  })

  describe('checkboxes validation', () => {
    const questions: QuestionConfig[] = [
      {
        id: 'q_skills',
        type: 'checkboxes',
        title: 'Skills',
        required: true,
        options: ['TypeScript', 'Rust', 'Go'],
        maxSelect: 2,
      },
    ]

    it('should accept valid selections within maxSelect', () => {
      const result = validateAnswers({ q_skills: ['TypeScript', 'Rust'] }, questions, 'en')
      expect(result.isValid).toBe(true)
      expect(result.sanitized['q_skills']).toEqual(['TypeScript', 'Rust'])
    })

    it('should reject selections exceeding maxSelect', () => {
      const result = validateAnswers({ q_skills: ['TypeScript', 'Rust', 'Go'] }, questions, 'en')
      expect(result.isValid).toBe(false)
      expect(result.errors['q_skills']).toBe('You can select up to 2 options')
    })

    it('should reject invalid checkbox options', () => {
      const result = validateAnswers({ q_skills: ['Cobol'] }, questions, 'pt')
      expect(result.isValid).toBe(false)
      expect(result.errors['q_skills']).toBe('Uma ou mais opções são inválidas')
    })

    it('should reject non-array checkbox values', () => {
      const result = validateAnswers({ q_skills: 'TypeScript' as unknown as string[] }, questions, 'en')
      expect(result.isValid).toBe(false)
      expect(result.errors['q_skills']).toBe('Invalid format')
    })
  })

  describe('matrix validation', () => {
    const questions: QuestionConfig[] = [
      {
        id: 'q_matrix',
        type: 'matrix',
        title: 'Knowledge Level',
        required: true,
        matrixRows: [
          { id: 'r1', label: 'Docker' },
          { id: 'r2', label: 'Kubernetes' },
        ],
        matrixColumns: [
          { id: 'c1', label: 'Beginner' },
          { id: 'c2', label: 'Advanced' },
        ],
      },
    ]

    it('should pass when all rows are rated with valid columns', () => {
      const result = validateAnswers(
        { q_matrix: { r1: 'c1', r2: 'c2' } },
        questions,
        'en'
      )
      expect(result.isValid).toBe(true)
      expect(result.sanitized['q_matrix']).toEqual({ r1: 'c1', r2: 'c2' })
    })

    it('should fail when required rows are missing', () => {
      const result = validateAnswers(
        { q_matrix: { r1: 'c1' } },
        questions,
        'pt'
      )
      expect(result.isValid).toBe(false)
      expect(result.errors['q_matrix']).toBe('Por favor, avalie todos os tópicos antes de continuar')
    })

    it('should fail when row or column IDs are invalid', () => {
      const result = validateAnswers(
        { q_matrix: { r1: 'c_invalid', r2: 'c2' } },
        questions,
        'en'
      )
      expect(result.isValid).toBe(false)
      expect(result.errors['q_matrix']).toBe('Invalid matrix row or column value')
    })
  })

  describe('text inputs validation', () => {
    it('should enforce short_text length boundary', () => {
      const questions: QuestionConfig[] = [
        { id: 'q_short', type: 'short_text', title: 'Short', required: true },
      ]
      const valid = validateAnswers({ q_short: 'Hello World' }, questions, 'en')
      expect(valid.isValid).toBe(true)

      const invalid = validateAnswers({ q_short: 'A'.repeat(1001) }, questions, 'en')
      expect(invalid.isValid).toBe(false)
      expect(invalid.errors['q_short']).toBe('Text exceeds maximum allowed length')
    })

    it('should enforce long_text length boundary', () => {
      const questions: QuestionConfig[] = [
        { id: 'q_long', type: 'long_text', title: 'Long', required: true },
      ]
      const valid = validateAnswers({ q_long: 'A'.repeat(10000) }, questions, 'pt')
      expect(valid.isValid).toBe(true)

      const invalid = validateAnswers({ q_long: 'A'.repeat(10001) }, questions, 'pt')
      expect(invalid.isValid).toBe(false)
      expect(invalid.errors['q_long']).toBe('Texto excede o limite máximo permitido')
    })
  })

  describe('contact and formatted inputs validation', () => {
    it('should validate email format', () => {
      const questions: QuestionConfig[] = [
        { id: 'q_email', type: 'email', title: 'Email', required: true },
      ]
      expect(validateAnswers({ q_email: 'user@example.com' }, questions, 'en').isValid).toBe(true)
      expect(validateAnswers({ q_email: 'not-an-email' }, questions, 'en').isValid).toBe(false)
    })

    it('should validate URL format', () => {
      const questions: QuestionConfig[] = [
        { id: 'q_url', type: 'url', title: 'URL', required: true },
      ]
      expect(validateAnswers({ q_url: 'https://pucminas.br' }, questions, 'en').isValid).toBe(true)
      expect(validateAnswers({ q_url: 'not a url' }, questions, 'en').isValid).toBe(false)
    })

    it('should validate phone format', () => {
      const questions: QuestionConfig[] = [
        { id: 'q_phone', type: 'phone', title: 'Phone', required: true },
      ]
      expect(validateAnswers({ q_phone: '+55 (31) 99999-8888' }, questions, 'pt').isValid).toBe(true)
      expect(validateAnswers({ q_phone: '123' }, questions, 'pt').isValid).toBe(false)
      expect(validateAnswers({ q_phone: 'abc-def-ghij' }, questions, 'pt').isValid).toBe(false)
    })
  })

  describe('numeric and scale inputs validation', () => {
    it('should validate number ranges', () => {
      const questions: QuestionConfig[] = [
        { id: 'q_num', type: 'number', title: 'Age', required: true, minValue: 18, maxValue: 100 },
      ]
      expect(validateAnswers({ q_num: 25 }, questions, 'en').isValid).toBe(true)
      expect(validateAnswers({ q_num: '30' }, questions, 'en').isValid).toBe(true)
      expect(validateAnswers({ q_num: 17 }, questions, 'en').isValid).toBe(false)
      expect(validateAnswers({ q_num: 101 }, questions, 'en').isValid).toBe(false)
      expect(validateAnswers({ q_num: 'NaN' }, questions, 'en').isValid).toBe(false)
    })

    it('should validate rating and opinion_scale', () => {
      const questions: QuestionConfig[] = [
        { id: 'q_rating', type: 'rating', title: 'Rating', required: true },
        { id: 'q_scale', type: 'opinion_scale', title: 'Scale', required: true, minValue: 0, maxValue: 10 },
      ]
      expect(validateAnswers({ q_rating: 4, q_scale: 8 }, questions, 'en').isValid).toBe(true)
      expect(validateAnswers({ q_rating: 6, q_scale: 8 }, questions, 'en').isValid).toBe(false)
      expect(validateAnswers({ q_rating: 4, q_scale: 11 }, questions, 'en').isValid).toBe(false)
    })

    it('should validate yes_no choices', () => {
      const questions: QuestionConfig[] = [
        { id: 'q_yn', type: 'yes_no', title: 'Agree?', required: true },
      ]
      expect(validateAnswers({ q_yn: 'Sim' }, questions, 'pt').isValid).toBe(true)
      expect(validateAnswers({ q_yn: 'No' }, questions, 'en').isValid).toBe(true)
      expect(validateAnswers({ q_yn: true }, questions, 'en').isValid).toBe(true)
      expect(validateAnswers({ q_yn: 'Maybe' }, questions, 'en').isValid).toBe(false)
    })
  })

  describe('localization options and validateSurveyAnswers', () => {
    const questions: QuestionConfig[] = [
      { id: 'q_req', type: 'short_text', title: 'Name', required: true },
      { id: 'q_cb', type: 'checkboxes', title: 'Choices', required: true, options: ['A', 'B'], maxSelect: 1 },
      {
        id: 'q_mat',
        type: 'matrix',
        title: 'Matrix',
        required: true,
        matrixRows: [{ id: 'r1', label: 'Row 1' }],
        matrixColumns: [{ id: 'c1', label: 'Col 1' }],
      },
      { id: 'q_mail', type: 'email', title: 'Email', required: false },
      { id: 'q_link', type: 'url', title: 'Link', required: false },
      { id: 'q_tel', type: 'phone', title: 'Phone', required: false },
    ]

    it('should return English validation error messages when called with { language: "en" }', () => {
      const result = validateSurveyAnswers(
        {
          q_cb: ['A', 'B'], // exceeds maxSelect
          q_mail: 'not-an-email',
          q_link: 'not-a-url',
          q_tel: 'invalid',
        },
        questions,
        { language: 'en' }
      )

      expect(result.isValid).toBe(false)
      expect(result.errors['q_req']).toBe('This field is required')
      expect(result.errors['q_mat']).toBe('Please rate all topics before continuing')
      expect(result.errors['q_cb']).toBe('You can select up to 1 options')
      expect(result.errors['q_mail']).toBe('Please enter a valid email address')
      expect(result.errors['q_link']).toBe('Please enter a valid URL')
      expect(result.errors['q_tel']).toBe('Please enter a valid phone number')
    })

    it('should return Portuguese validation error messages when called with { language: "pt" }', () => {
      const result = validateSurveyAnswers(
        {
          q_cb: ['A', 'B'], // exceeds maxSelect
          q_mail: 'not-an-email',
          q_link: 'not-a-url',
          q_tel: 'invalid',
        },
        questions,
        { language: 'pt' }
      )

      expect(result.isValid).toBe(false)
      expect(result.errors['q_req']).toBe('Este campo é obrigatório')
      expect(result.errors['q_mat']).toBe('Por favor, avalie todos os tópicos antes de continuar')
      expect(result.errors['q_cb']).toBe('Você pode selecionar no máximo 1 opções')
      expect(result.errors['q_mail']).toBe('Por favor, insira um e-mail válido')
      expect(result.errors['q_link']).toBe('Por favor, insira uma URL válida')
      expect(result.errors['q_tel']).toBe('Por favor, insira um telefone válido')
    })

    it('should return selectAtLeastOneError for empty/unanswered required checkboxes in English and Portuguese', () => {
      const cbOnly: QuestionConfig[] = [
        { id: 'q_cb', type: 'checkboxes', title: 'Choices', required: true, options: ['A', 'B'] },
      ]

      const enEmpty = validateAnswers({ q_cb: [] }, cbOnly, { language: 'en' })
      expect(enEmpty.errors['q_cb']).toBe('Please select at least one option')

      const ptEmpty = validateAnswers({ q_cb: [] }, cbOnly, { language: 'pt' })
      expect(ptEmpty.errors['q_cb']).toBe('Selecione pelo menos uma opção')

      const enMissing = validateAnswers({}, cbOnly, { language: 'en' })
      expect(enMissing.errors['q_cb']).toBe('Please select at least one option')

      const ptMissing = validateAnswers({}, cbOnly, { language: 'pt' })
      expect(ptMissing.errors['q_cb']).toBe('Selecione pelo menos uma opção')
    })

    it('should fall back to _survey_language when options parameter is omitted or empty', () => {
      const resultEn = validateAnswers(
        { _survey_language: 'en' },
        [{ id: 'q1', type: 'short_text', title: 'Q1', required: true }]
      )
      expect(resultEn.errors['q1']).toBe('This field is required')

      const resultPt = validateAnswers(
        { _survey_language: 'pt' },
        [{ id: 'q1', type: 'short_text', title: 'Q1', required: true }]
      )
      expect(resultPt.errors['q1']).toBe('Este campo é obrigatório')
    })
  })
})
