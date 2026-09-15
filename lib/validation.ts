import { z } from 'zod'
import { QuestionConfig, Json } from '@/lib/database.types'
import {
  surveyTranslations,
  SurveyLanguage,
} from '@/lib/example-form'

/**
 * Validates survey answers using Zod and configuration rules.
 */
export function validateAnswers(
  answers: Record<string, Json>,
  questions: QuestionConfig[],
  language: SurveyLanguage
): { isValid: boolean; errors: Record<string, string>; sanitized: Record<string, Json> } {
  const errors: Record<string, string> = {}
  const sanitized: Record<string, Json> = {}

  // Allowed metadata
  if (answers._survey_language) {
    sanitized._survey_language = answers._survey_language
  }

  for (const question of questions) {
    const value = answers[question.id]

    // Check required constraint
    const isMissing =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === 'object' && Object.keys(value).length === 0)

    if (question.required && isMissing) {
      errors[question.id] =
        language === 'en'
          ? 'This field is required'
          : 'Este campo é obrigatório'
      continue
    }

    if (isMissing) {
      // Optional question unanswered - skip further validation
      continue
    }

    // Type-specific validations
    switch (question.type) {
      case 'dropdown': {
        const strSchema = z.string().max(500)
        const parseResult = strSchema.safeParse(value)
        if (!parseResult.success) {
          errors[question.id] = language === 'en' ? 'Invalid selection' : 'Seleção inválida'
          continue
        }
        if (question.options && question.options.length > 0) {
          if (!question.options.includes(parseResult.data)) {
            // Also check alternate language options if applicable
            const isSurvey = questions.some(q => q.id === 'q01-consentimento')
            const otherLang: SurveyLanguage = language === 'en' ? 'pt' : 'en'
            const altQuestion = isSurvey
              ? surveyTranslations[otherLang]?.questions.find(q => q.id === question.id)
              : null
            const validOptions = [...(question.options || []), ...(altQuestion?.options || [])]

            if (!validOptions.includes(parseResult.data)) {
              errors[question.id] =
                language === 'en' ? 'Selected option is not allowed' : 'Opção selecionada não permitida'
              continue
            }
          }
        }
        sanitized[question.id] = parseResult.data
        break
      }

      case 'checkboxes': {
        const arrSchema = z.array(z.string().max(500)).max(50)
        const parseResult = arrSchema.safeParse(value)
        if (!parseResult.success) {
          errors[question.id] = language === 'en' ? 'Invalid format' : 'Formato inválido'
          continue
        }

        const selectedItems = parseResult.data

        if (question.maxSelect && selectedItems.length > question.maxSelect) {
          errors[question.id] =
            language === 'en'
              ? `You can select up to ${question.maxSelect} options`
              : `Você pode selecionar no máximo ${question.maxSelect} opções`
          continue
        }

        if (question.options && question.options.length > 0) {
          const isSurvey = questions.some(q => q.id === 'q01-consentimento')
          const otherLang: SurveyLanguage = language === 'en' ? 'pt' : 'en'
          const altQuestion = isSurvey
            ? surveyTranslations[otherLang]?.questions.find(q => q.id === question.id)
            : null
          const validOptions = new Set([...(question.options || []), ...(altQuestion?.options || [])])

          const hasInvalid = selectedItems.some(item => !validOptions.has(item))
          if (hasInvalid) {
            errors[question.id] =
              language === 'en' ? 'One or more selected options are invalid' : 'Uma ou mais opções são inválidas'
            continue
          }
        }

        sanitized[question.id] = selectedItems
        break
      }

      case 'matrix': {
        const matrixObjSchema = z.record(z.string(), z.string().max(100))
        const parseResult = matrixObjSchema.safeParse(value)
        if (!parseResult.success) {
          errors[question.id] = language === 'en' ? 'Invalid matrix response' : 'Resposta da matriz inválida'
          continue
        }

        const matrixData = parseResult.data
        const validRowIds = new Set(question.matrixRows?.map(r => r.id) || [])
        const validColIds = new Set(question.matrixColumns?.map(c => c.id) || [])

        if (question.required && question.matrixRows) {
          const missingRows = question.matrixRows.some(row => !matrixData[row.id])
          if (missingRows) {
            errors[question.id] =
              language === 'en'
                ? 'Please rate all topics before continuing'
                : 'Por favor, avalie todos os tópicos antes de continuar'
            continue
          }
        }

        // Validate that keys and values belong to defined rows/columns
        let valid = true
        for (const [rId, cId] of Object.entries(matrixData)) {
          if (validRowIds.size > 0 && !validRowIds.has(rId)) {
            valid = false
            break
          }
          if (validColIds.size > 0 && !validColIds.has(cId)) {
            valid = false
            break
          }
        }

        if (!valid) {
          errors[question.id] =
            language === 'en' ? 'Invalid matrix row or column value' : 'Valor de linha ou coluna de matriz inválido'
          continue
        }

        sanitized[question.id] = matrixData
        break
      }

      case 'short_text': {
        const textSchema = z.string().max(1000)
        const parseResult = textSchema.safeParse(value)
        if (!parseResult.success) {
          errors[question.id] =
            language === 'en' ? 'Text exceeds maximum allowed length' : 'Texto excede o limite máximo permitido'
          continue
        }
        sanitized[question.id] = parseResult.data
        break
      }

      case 'long_text': {
        const longTextSchema = z.string().max(10000)
        const parseResult = longTextSchema.safeParse(value)
        if (!parseResult.success) {
          errors[question.id] =
            language === 'en' ? 'Text exceeds maximum allowed length' : 'Texto excede o limite máximo permitido'
          continue
        }
        sanitized[question.id] = parseResult.data
        break
      }

      case 'email': {
        const emailSchema = z.string().email().max(254)
        const parseResult = emailSchema.safeParse(value)
        if (!parseResult.success) {
          errors[question.id] =
            language === 'en' ? 'Please enter a valid email address' : 'Por favor, insira um e-mail válido'
          continue
        }
        sanitized[question.id] = parseResult.data
        break
      }

      case 'url': {
        const urlSchema = z.string().url().max(2048)
        const parseResult = urlSchema.safeParse(value)
        if (!parseResult.success) {
          errors[question.id] =
            language === 'en' ? 'Please enter a valid URL' : 'Por favor, insira uma URL válida'
          continue
        }
        sanitized[question.id] = parseResult.data
        break
      }

      case 'phone': {
        const phoneRegex = /^[+]?[\d\s\-().]{5,30}$/
        if (typeof value !== 'string' || !phoneRegex.test(value)) {
          errors[question.id] =
            language === 'en' ? 'Please enter a valid phone number' : 'Por favor, insira um telefone válido'
          continue
        }
        sanitized[question.id] = value
        break
      }

      case 'number': {
        const num = Number(value)
        if (isNaN(num)) {
          errors[question.id] = language === 'en' ? 'Must be a valid number' : 'Deve ser um número válido'
          continue
        }
        if (question.minValue !== undefined && num < question.minValue) {
          errors[question.id] = language === 'en' ? `Minimum value is ${question.minValue}` : `Valor mínimo é ${question.minValue}`
          continue
        }
        if (question.maxValue !== undefined && num > question.maxValue) {
          errors[question.id] = language === 'en' ? `Maximum value is ${question.maxValue}` : `Valor máximo é ${question.maxValue}`
          continue
        }
        sanitized[question.id] = num
        break
      }

      case 'rating':
      case 'opinion_scale': {
        const num = Number(value)
        const min = question.minValue ?? 1
        const max = question.maxValue ?? (question.type === 'rating' ? 5 : 10)
        if (isNaN(num) || num < min || num > max) {
          errors[question.id] =
            language === 'en' ? `Value must be between ${min} and ${max}` : `Valor deve ser entre ${min} e ${max}`
          continue
        }
        sanitized[question.id] = num
        break
      }

      case 'yes_no': {
        const validValues = ['Sim', 'Não', 'Yes', 'No', true, false]
        if (!validValues.includes(value as string | boolean)) {
          errors[question.id] = language === 'en' ? 'Invalid selection' : 'Seleção inválida'
          continue
        }
        sanitized[question.id] = value
        break
      }

      default: {
        // Safe string fallback bounded to 2000 chars
        if (typeof value === 'string') {
          sanitized[question.id] = value.slice(0, 2000)
        } else {
          sanitized[question.id] = value
        }
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  }
}
