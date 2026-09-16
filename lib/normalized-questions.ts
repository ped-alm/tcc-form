import { v4 as uuidv4 } from 'uuid'
import {
  QuestionConfig,
  QuestionType,
  MatrixRow,
  MatrixColumn,
  NormalizedQuestion,
  NormalizedQuestionOption,
  NormalizedMatrixRow,
  NormalizedMatrixColumn,
  NormalizedQuestionInsert,
} from './database.types'

export interface NormalizedFormBundle {
  questions: (NormalizedQuestionInsert & { id: string })[]
  options: {
    id: string
    question_id: string
    label: string
    value: string | null
    order_index: number
    is_exclusive: boolean
  }[]
  matrixRows: {
    id: string
    question_id: string
    row_key: string
    label: string
    description: string | null
    order_index: number
  }[]
  matrixColumns: {
    id: string
    question_id: string
    col_key: string
    label: string
    short_label: string | null
    order_index: number
  }[]
}

/**
 * Normalizes an array of QuestionConfig objects into relational table rows.
 */
export function normalizeQuestionConfigs(
  formId: string,
  configs: QuestionConfig[]
): NormalizedFormBundle {
  const questions: NormalizedFormBundle['questions'] = []
  const options: NormalizedFormBundle['options'] = []
  const matrixRows: NormalizedFormBundle['matrixRows'] = []
  const matrixColumns: NormalizedFormBundle['matrixColumns'] = []

  configs.forEach((config, qIdx) => {
    const questionId = uuidv4()

    questions.push({
      id: questionId,
      form_id: formId,
      question_key: config.id || `q_${qIdx + 1}`,
      order_index: qIdx + 1,
      type: config.type,
      title: config.title,
      description: config.description || null,
      display_number: config.displayNumber ? String(config.displayNumber) : null,
      required: Boolean(config.required),
      placeholder: config.placeholder || null,
      min_value: config.minValue ?? null,
      max_value: config.maxValue ?? null,
      max_select: config.maxSelect ?? null,
      exclusive_options: config.exclusiveOptions || null,
    })

    if (config.options && Array.isArray(config.options)) {
      config.options.forEach((opt, optIdx) => {
        options.push({
          id: uuidv4(),
          question_id: questionId,
          label: opt,
          value: opt,
          order_index: optIdx + 1,
          is_exclusive: Boolean(config.exclusiveOptions?.includes(opt)),
        })
      })
    }

    if (config.matrixRows && Array.isArray(config.matrixRows)) {
      config.matrixRows.forEach((row, rowIdx) => {
        matrixRows.push({
          id: uuidv4(),
          question_id: questionId,
          row_key: row.id || `row_${rowIdx + 1}`,
          label: row.label,
          description: row.description || null,
          order_index: rowIdx + 1,
        })
      })
    }

    if (config.matrixColumns && Array.isArray(config.matrixColumns)) {
      config.matrixColumns.forEach((col, colIdx) => {
        matrixColumns.push({
          id: uuidv4(),
          question_id: questionId,
          col_key: col.id || `col_${colIdx + 1}`,
          label: col.label,
          short_label: col.shortLabel || null,
          order_index: colIdx + 1,
        })
      })
    }
  })

  return {
    questions,
    options,
    matrixRows,
    matrixColumns,
  }
}

/**
 * Reconstructs QuestionConfig[] from relational table query results.
 */
export function reconstructQuestionConfigs(bundle: {
  questions: NormalizedQuestion[]
  options?: NormalizedQuestionOption[]
  matrixRows?: NormalizedMatrixRow[]
  matrixColumns?: NormalizedMatrixColumn[]
}): QuestionConfig[] {
  const sortedQuestions = [...bundle.questions].sort((a, b) => a.order_index - b.order_index)

  const optionsByQuestionId = new Map<string, NormalizedQuestionOption[]>()
  if (bundle.options) {
    bundle.options.forEach(opt => {
      const list = optionsByQuestionId.get(opt.question_id) || []
      list.push(opt)
      optionsByQuestionId.set(opt.question_id, list)
    })
  }

  const matrixRowsByQuestionId = new Map<string, NormalizedMatrixRow[]>()
  if (bundle.matrixRows) {
    bundle.matrixRows.forEach(row => {
      const list = matrixRowsByQuestionId.get(row.question_id) || []
      list.push(row)
      matrixRowsByQuestionId.set(row.question_id, list)
    })
  }

  const matrixColsByQuestionId = new Map<string, NormalizedMatrixColumn[]>()
  if (bundle.matrixColumns) {
    bundle.matrixColumns.forEach(col => {
      const list = matrixColsByQuestionId.get(col.question_id) || []
      list.push(col)
      matrixColsByQuestionId.set(col.question_id, list)
    })
  }

  return sortedQuestions.map(q => {
    const opts = (optionsByQuestionId.get(q.id) || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map(o => o.label)

    const mRows = (matrixRowsByQuestionId.get(q.id) || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map(
        (r): MatrixRow => ({
          id: r.row_key,
          label: r.label,
          description: r.description || undefined,
        })
      )

    const mCols = (matrixColsByQuestionId.get(q.id) || [])
      .sort((a, b) => a.order_index - b.order_index)
      .map(
        (c): MatrixColumn => ({
          id: c.col_key,
          label: c.label,
          shortLabel: c.short_label || undefined,
        })
      )

    const config: QuestionConfig = {
      id: q.question_key,
      type: q.type as QuestionType,
      title: q.title,
      description: q.description || undefined,
      displayNumber: q.display_number || undefined,
      required: q.required,
      placeholder: q.placeholder || undefined,
      minValue: q.min_value !== null ? Number(q.min_value) : undefined,
      maxValue: q.max_value !== null ? Number(q.max_value) : undefined,
      maxSelect: q.max_select !== null ? q.max_select : undefined,
      exclusiveOptions: q.exclusive_options && q.exclusive_options.length > 0 ? q.exclusive_options : undefined,
      options: opts.length > 0 ? opts : undefined,
      matrixRows: mRows.length > 0 ? mRows : undefined,
      matrixColumns: mCols.length > 0 ? mCols : undefined,
    }

    return config
  })
}
