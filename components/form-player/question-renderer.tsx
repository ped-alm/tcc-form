'use client'

import { useState, useRef, useCallback } from 'react'
import { QuestionConfig, ThemeConfig, Json } from '@/lib/database.types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { motion } from 'framer-motion'
import { Star, Upload, Check, X, FileText, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface FileUploadValue {
  name: string
  url: string
  type: string
  size?: number
  // Keeps the shape assignable to Json, since answers are stored as JSONB
  [key: string]: Json | undefined
}

interface FileUploadQuestionProps {
  question: QuestionConfig
  value: FileUploadValue | null
  onChange: (value: FileUploadValue | null) => void
  theme: ThemeConfig
}

function FileUploadQuestion({ question, value, onChange, theme }: FileUploadQuestionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (file: File) => {
    setUploadError(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        // If R2 is not configured, fall back to base64
        if (response.status === 503 && !result.configured) {
          // Fall back to base64 for local/demo usage
          const reader = new FileReader()
          reader.onload = () => {
            onChange({
              name: file.name,
              type: file.type,
              size: file.size,
              url: reader.result as string, // base64 data URL
            })
            setIsUploading(false)
          }
          reader.onerror = () => {
            setUploadError('Failed to read file')
            setIsUploading(false)
          }
          reader.readAsDataURL(file)
          return
        }
        
        throw new Error(result.error || 'Upload failed')
      }

      // Success - store the R2 URL
      onChange({
        name: result.file.name,
        type: result.file.type,
        size: result.file.size,
        url: result.url,
      })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }, [onChange])

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleFileSelect(file)
          }
          // Reset input so same file can be selected again
          e.target.value = ''
        }}
      />
      
      {value ? (
        <div 
          className="p-4 rounded-xl border-2 flex items-center gap-4"
          style={{ borderColor: theme.primaryColor }}
        >
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${theme.primaryColor}20` }}
          >
            {value.type?.startsWith('image/') ? (
              <ImageIcon className="w-6 h-6" style={{ color: theme.primaryColor }} />
            ) : (
              <FileText className="w-6 h-6" style={{ color: theme.primaryColor }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate" style={{ color: theme.textColor }}>
              {value.name}
            </p>
            {value.size && (
              <p className="text-sm opacity-50" style={{ color: theme.textColor }}>
                {(value.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
          <button
            onClick={() => onChange(null)}
            className="p-2 rounded-lg transition-colors hover:opacity-70"
            style={{ color: theme.textColor }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : isUploading ? (
        <div 
          className="w-full p-8 rounded-xl border-2 border-dashed flex flex-col items-center gap-3"
          style={{ 
            borderColor: theme.primaryColor,
            color: theme.textColor,
          }}
        >
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.primaryColor }} />
          <p className="font-medium">Uploading...</p>
        </div>
      ) : (
        <div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-8 rounded-xl border-2 border-dashed flex flex-col items-center gap-3 transition-colors"
            style={{ 
              borderColor: uploadError ? '#EF4444' : `${theme.textColor}30`,
              color: theme.textColor,
            }}
          >
            <Upload className="w-8 h-8 opacity-50" />
            <div className="text-center">
              <p className="font-medium">Click to upload</p>
              <p className="text-sm opacity-50 mt-1">
                Images & PDFs up to {question.maxFileSize || 10}MB
              </p>
            </div>
          </motion.button>
          {uploadError && (
            <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: '#EF4444' }}>
              <AlertCircle className="w-4 h-4" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface MatrixQuestionProps {
  question: QuestionConfig
  value: Json
  onChange: (value: Json) => void
  theme: ThemeConfig
  onClearError?: () => void
}

function MatrixQuestion({ question, value, onChange, theme, onClearError }: MatrixQuestionProps) {
  const rows = question.matrixRows || []
  const columns = question.matrixColumns || []
  const currentAnswers = (typeof value === 'object' && value !== null && !Array.isArray(value))
    ? (value as Record<string, string>)
    : {}

  const handleSelect = (rowId: string, colId: string) => {
    const nextAnswers = { ...currentAnswers, [rowId]: colId }
    onChange(nextAnswers)
    onClearError?.()
  }

  const answeredCount = rows.filter(r => Boolean(currentAnswers[r.id])).length

  return (
    <div className="w-full space-y-4">
      {/* Progress indicator for matrix */}
      <div 
        className="flex items-center justify-between text-xs sm:text-sm font-medium px-1"
        style={{ color: theme.textColor }}
      >
        <span className="opacity-70">Avaliação dos tópicos</span>
        <span 
          className="px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums"
          style={{ 
            backgroundColor: `${theme.primaryColor}20`,
            color: theme.primaryColor,
          }}
        >
          {answeredCount} de {rows.length} preenchidos
        </span>
      </div>

      {/* Desktop / Tablet view */}
      <div 
        className="hidden md:block overflow-x-auto rounded-2xl border p-4 shadow-sm"
        style={{ 
          borderColor: `${theme.textColor}15`,
          backgroundColor: `${theme.textColor}05`,
        }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b" style={{ borderColor: `${theme.textColor}15` }}>
              <th className="text-left py-3.5 px-4 font-semibold text-sm" style={{ color: theme.textColor }}>
                Tópico
              </th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="text-center py-3.5 px-2 font-medium text-xs sm:text-sm"
                  style={{ color: theme.textColor }}
                >
                  <div className="font-semibold whitespace-nowrap">{col.shortLabel || col.label}</div>
                  {col.shortLabel && col.shortLabel !== col.label && (
                    <div className="text-[11px] opacity-60 font-normal whitespace-nowrap mt-0.5">{col.label}</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selectedCol = currentAnswers[row.id]
              const isRowComplete = Boolean(selectedCol)
              return (
                <tr
                  key={row.id}
                  className="border-b last:border-b-0 transition-colors"
                  style={{ 
                    borderColor: `${theme.textColor}10`,
                    backgroundColor: isRowComplete ? `${theme.primaryColor}06` : 'transparent',
                  }}
                >
                  <td className="py-3 px-4 text-left align-middle max-w-xs">
                    <div className="font-medium text-sm sm:text-base leading-snug" style={{ color: theme.textColor }}>
                      {row.label}
                    </div>
                    {row.description && (
                      <div className="text-xs opacity-65 mt-1 leading-normal" style={{ color: theme.textColor }}>
                        {row.description}
                      </div>
                    )}
                  </td>
                  {columns.map((col) => {
                    const isSelected = selectedCol === col.id
                    return (
                      <td key={col.id} className="py-3 px-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleSelect(row.id, col.id)}
                          className={`w-9 h-9 mx-auto rounded-full flex items-center justify-center transition-all cursor-pointer border-2 ${
                            isSelected
                              ? 'scale-105 shadow-sm'
                              : 'hover:scale-105 opacity-65 hover:opacity-100'
                          }`}
                          style={{
                            borderColor: isSelected ? theme.primaryColor : `${theme.textColor}35`,
                            backgroundColor: isSelected ? theme.primaryColor : 'transparent',
                            color: isSelected ? theme.backgroundColor : theme.textColor,
                          }}
                          aria-label={`${row.label}: ${col.label}`}
                          title={`${row.label}: ${col.label}`}
                        >
                          {isSelected ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <span className="text-xs font-semibold">{col.shortLabel || col.label.charAt(0)}</span>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile view: Stacked card per row */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => {
          const selectedCol = currentAnswers[row.id]
          const isRowComplete = Boolean(selectedCol)
          return (
            <div
              key={row.id}
              className="p-3.5 rounded-xl border transition-colors space-y-2.5"
              style={{
                borderColor: isRowComplete ? theme.primaryColor : `${theme.textColor}20`,
                backgroundColor: isRowComplete ? `${theme.primaryColor}08` : `${theme.textColor}05`,
              }}
            >
              <div>
                <div className="font-semibold text-sm" style={{ color: theme.textColor }}>
                  {row.label}
                </div>
                {row.description && (
                  <div className="text-xs opacity-70 mt-0.5" style={{ color: theme.textColor }}>
                    {row.description}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                {columns.map((col) => {
                  const isSelected = selectedCol === col.id
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => handleSelect(row.id, col.id)}
                      className="py-2 px-1 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5"
                      style={{
                        borderColor: isSelected ? theme.primaryColor : `${theme.textColor}25`,
                        backgroundColor: isSelected ? theme.primaryColor : 'transparent',
                        color: isSelected ? theme.backgroundColor : theme.textColor,
                      }}
                    >
                      <span className="text-xs font-semibold">{col.shortLabel || col.label}</span>
                      {isSelected && <Check className="w-3 h-3" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface QuestionRendererProps {
  question: QuestionConfig
  value: Json
  onChange: (value: Json) => void
  theme: ThemeConfig
  error?: string
  onSubmit: (skipValidation?: boolean) => void
  onClearError?: () => void
  language?: 'pt' | 'en'
}

export function QuestionRenderer({ 
  question, 
  value, 
  onChange, 
  theme,
  error,
  onSubmit,
  onClearError,
  language = 'pt'
}: QuestionRendererProps) {
  const [isFocused, setIsFocused] = useState(false)
  const isEnglish = language === 'en'

  const inputStyles = {
    borderColor: error ? '#EF4444' : isFocused ? theme.primaryColor : `${theme.textColor}30`,
    color: theme.textColor,
    backgroundColor: 'transparent',
  }

  switch (question.type) {
    case 'short_text':
    case 'email':
    case 'phone':
    case 'url':
    case 'number':
      return (
        <Input
          type={question.type === 'number' ? 'number' : question.type === 'email' ? 'email' : 'text'}
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={question.placeholder || (isEnglish ? 'Type your answer here...' : 'Digite sua resposta aqui...')}
          className="text-xl md:text-2xl h-auto py-3 px-0 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:opacity-40"
          style={inputStyles}
          autoFocus
        />
      )

    case 'long_text':
      return (
        <Textarea
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={question.placeholder || (isEnglish ? 'Type your answer here...' : 'Digite sua resposta aqui...')}
          className="text-lg md:text-xl min-h-[150px] p-4 border-2 rounded-xl bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:opacity-40 resize-none"
          style={inputStyles}
          autoFocus
        />
      )

    case 'date':
      return (
        <Input
          type="date"
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="text-xl md:text-2xl h-auto py-3 px-0 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          style={inputStyles}
          autoFocus
        />
      )

    case 'dropdown':
      return (
        <div className="space-y-3">
          {(question.options || []).map((option, index) => {
            const isSelected = value === option
            return (
              <motion.button
                key={index}
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange(option)
                  onClearError?.()
                  onSubmit(true)
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all"
                style={{
                  borderColor: isSelected ? theme.primaryColor : `${theme.textColor}20`,
                  backgroundColor: isSelected ? `${theme.primaryColor}10` : 'transparent',
                  color: theme.textColor,
                }}
              >
                <div 
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                  style={{ 
                    borderColor: isSelected ? theme.primaryColor : `${theme.textColor}40`,
                    backgroundColor: isSelected ? theme.primaryColor : 'transparent',
                  }}
                >
                  {isSelected ? (
                    <Check className="w-4 h-4" style={{ color: theme.backgroundColor }} />
                  ) : (
                    <span className="text-sm font-medium" style={{ color: theme.textColor }}>
                      {String.fromCharCode(65 + index)}
                    </span>
                  )}
                </div>
                <span className="text-lg">{option}</span>
              </motion.button>
            )
          })}
        </div>
      )

    case 'checkboxes':
      const selectedValues: string[] = Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
      const exclusiveOptions = question.exclusiveOptions || []
      const maxSelect = question.maxSelect

      return (
        <div className="space-y-3">
          {(question.options || []).map((option, index) => {
            const isSelected = selectedValues.includes(option)
            const isExclusive = exclusiveOptions.includes(option)
            return (
              <motion.button
                key={index}
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  let newValues: string[]
                  if (isSelected) {
                    newValues = selectedValues.filter(v => v !== option)
                  } else {
                    if (isExclusive) {
                      newValues = [option]
                    } else {
                      const withoutExclusive = selectedValues.filter(v => !exclusiveOptions.includes(v))
                      if (maxSelect && withoutExclusive.length >= maxSelect) {
                        toast.error(
                          isEnglish
                            ? `You can select up to ${maxSelect} options`
                            : `Você pode selecionar no máximo ${maxSelect} opções`
                        )
                        return
                      }
                      newValues = [...withoutExclusive, option]
                    }
                  }
                  onChange(newValues)
                  onClearError?.()
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all"
                style={{
                  borderColor: isSelected ? theme.primaryColor : `${theme.textColor}20`,
                  backgroundColor: isSelected ? `${theme.primaryColor}10` : 'transparent',
                  color: theme.textColor,
                }}
              >
                <div 
                  className="w-8 h-8 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors"
                  style={{ 
                    borderColor: isSelected ? theme.primaryColor : `${theme.textColor}40`,
                    backgroundColor: isSelected ? theme.primaryColor : 'transparent',
                  }}
                >
                  {isSelected ? (
                    <Check className="w-4 h-4" style={{ color: theme.backgroundColor }} />
                  ) : (
                    <span className="text-sm font-medium" style={{ color: theme.textColor }}>
                      {String.fromCharCode(65 + index)}
                    </span>
                  )}
                </div>
                <span className="text-base sm:text-lg">{option}</span>
              </motion.button>
            )
          })}
          <p className="text-sm opacity-60 mt-2 font-medium" style={{ color: theme.textColor }}>
            {maxSelect
              ? isEnglish
                ? `Select up to ${maxSelect} options (${selectedValues.length}/${maxSelect} selected)`
                : `Selecione até ${maxSelect} opções (${selectedValues.length}/${maxSelect} selecionadas)`
              : isEnglish
                ? 'Select all options that apply'
                : 'Selecione todas as opções que se aplicam'}
          </p>
        </div>
      )

    case 'matrix':
      return (
        <MatrixQuestion
          question={question}
          value={value}
          onChange={onChange}
          theme={theme}
          onClearError={onClearError}
        />
      )

    case 'yes_no':
      return (
        <div className="flex gap-4">
          {['Yes', 'No'].map((option) => {
            const isSelected = value === option
            return (
              <motion.button
                key={option}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange(option)
                  onClearError?.()
                  onSubmit(true)
                }}
                className="flex-1 flex items-center justify-center gap-3 p-5 rounded-xl border-2 transition-all"
                style={{
                  borderColor: isSelected ? theme.primaryColor : `${theme.textColor}20`,
                  backgroundColor: isSelected ? `${theme.primaryColor}10` : 'transparent',
                  color: theme.textColor,
                }}
              >
                <div 
                  className="w-8 h-8 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors"
                  style={{ 
                    borderColor: isSelected ? theme.primaryColor : `${theme.textColor}40`,
                    backgroundColor: isSelected ? theme.primaryColor : 'transparent',
                  }}
                >
                  {isSelected ? (
                    <Check className="w-4 h-4" style={{ color: theme.backgroundColor }} />
                  ) : (
                    <span className="text-sm font-medium" style={{ color: theme.textColor }}>
                      {option[0]}
                    </span>
                  )}
                </div>
                <span className="text-xl font-medium">{option}</span>
              </motion.button>
            )
          })}
        </div>
      )

    case 'rating':
      const maxRating = question.maxValue || 5
      const currentRating = typeof value === 'number' ? value : 0
      return (
        <div className="flex gap-2">
          {Array.from({ length: maxRating }).map((_, index) => {
            const starValue = index + 1
            const isActive = starValue <= currentRating
            return (
              <motion.button
                key={index}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onChange(starValue)}
                className="p-1"
              >
                <Star
                  className="w-10 h-10 md:w-12 md:h-12 transition-colors"
                  fill={isActive ? theme.primaryColor : 'transparent'}
                  style={{ 
                    color: isActive ? theme.primaryColor : `${theme.textColor}30`,
                  }}
                />
              </motion.button>
            )
          })}
        </div>
      )

    case 'opinion_scale':
      const minScale = question.minValue || 1
      const maxScale = question.maxValue || 10
      const scaleValue = typeof value === 'number' ? value : null
      return (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: maxScale - minScale + 1 }).map((_, index) => {
            const num = minScale + index
            const isSelected = scaleValue === num
            return (
              <motion.button
                key={num}
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange(num)
                  onClearError?.()
                  onSubmit(true)
                }}
                className="w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 flex items-center justify-center text-lg font-medium transition-all"
                style={{
                  borderColor: isSelected ? theme.primaryColor : `${theme.textColor}30`,
                  backgroundColor: isSelected ? theme.primaryColor : 'transparent',
                  color: isSelected ? theme.backgroundColor : theme.textColor,
                }}
              >
                {num}
              </motion.button>
            )
          })}
        </div>
      )

    case 'file_upload':
      return (
        <FileUploadQuestion
          question={question}
          value={value as FileUploadValue | null}
          onChange={onChange}
          theme={theme}
        />
      )

    default:
      return (
        <p style={{ color: theme.textColor }} className="opacity-50">
          Unsupported question type: {question.type}
        </p>
      )
  }
}

