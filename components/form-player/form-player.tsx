'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Form, QuestionConfig, Json, ThemePreset } from '@/lib/database.types'
import { getTheme, getThemeCSSVariables, themeList } from '@/lib/themes'
import { motion, AnimatePresence } from 'framer-motion'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown, Check, ArrowRight, Palette, Globe } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { QuestionRenderer } from './question-renderer'
import { toast } from 'sonner'
import {
  surveyTranslations,
  SurveyLanguage,
  convertAnswersLanguage,
  EXAMPLE_FORM_ID,
  EXAMPLE_FORM_SLUG,
} from '@/lib/example-form'

interface FormPlayerProps {
  form: Form
}

export function FormPlayer({ form }: FormPlayerProps) {
  const supabase = createClient()
  const [language, setLanguage] = useState<SurveyLanguage>('pt')

  const isSurveyForm =
    form.id === EXAMPLE_FORM_ID ||
    form.slug === EXAMPLE_FORM_SLUG ||
    Boolean(form.questions && (form.questions as QuestionConfig[]).some(q => q.id === 'q01-consentimento'))

  const activeTranslation = isSurveyForm ? surveyTranslations[language] : null
  const questions = activeTranslation ? activeTranslation.questions : ((form.questions as QuestionConfig[]) || [])
  const formTitle = activeTranslation ? activeTranslation.title : form.title
  const formDescription = activeTranslation ? activeTranslation.description : form.description
  const badgeText = activeTranslation ? activeTranslation.badge : 'Pesquisa de TCC • PUC Minas • ~7 min'

  const handleLanguageChange = (newLang: SurveyLanguage) => {
    if (newLang === language) return
    setAnswers(prev => convertAnswersLanguage(prev, language, newLang))
    setLanguage(newLang)
    setErrors({})
  }

  const [currentThemePreset, setCurrentThemePreset] = useState<ThemePreset>(form.theme || 'ocean')
  const theme = getTheme(currentThemePreset)
  const themeStyles = getThemeCSSVariables(theme)

  useEffect(() => {
    if (form.theme) {
      setCurrentThemePreset(form.theme)
    }
  }, [form.theme])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const [terminationReason, setTerminationReason] = useState<'consent_declined' | 'not_eligible' | null>(null)
  const [answers, setAnswers] = useState<Record<string, Json>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [direction, setDirection] = useState(0)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const skipNextValidationRef = useRef(false)

  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const isFirstQuestion = !hasStarted
  const progress = !hasStarted ? 0 : questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0

  const validateCurrentQuestion = useCallback(() => {
    if (!hasStarted || !currentQuestion) return true
    
    const answer = answers[currentQuestion.id]
    
    if (currentQuestion.required) {
      if (currentQuestion.type === 'matrix') {
        const rows = currentQuestion.matrixRows || []
        const currentAnswers = (typeof answer === 'object' && answer !== null && !Array.isArray(answer))
          ? (answer as Record<string, string>)
          : {}
        const answeredCount = rows.filter(r => Boolean(currentAnswers[r.id])).length
        if (answeredCount < rows.length) {
          setErrors({
            ...errors,
            [currentQuestion.id]: activeTranslation
              ? activeTranslation.rateAllTopicsError
              : 'Por favor, avalie todos os tópicos antes de continuar',
          })
          return false
        }
      } else {
        if (answer === undefined || answer === null || answer === '') {
          setErrors({
            ...errors,
            [currentQuestion.id]: activeTranslation
              ? activeTranslation.requiredFieldError
              : 'Este campo é obrigatório',
          })
          return false
        }
        
        if (Array.isArray(answer) && answer.length === 0) {
          setErrors({
            ...errors,
            [currentQuestion.id]: activeTranslation
              ? activeTranslation.selectAtLeastOneError
              : 'Selecione pelo menos uma opção',
          })
          return false
        }
      }
    }

    // Type-specific validation
    if (answer && currentQuestion.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(String(answer))) {
        setErrors({
          ...errors,
          [currentQuestion.id]: activeTranslation
            ? activeTranslation.validEmailError
            : 'Por favor, insira um e-mail válido',
        })
        return false
      }
    }

    if (answer && currentQuestion.type === 'url') {
      try {
        new URL(String(answer))
      } catch {
        setErrors({
          ...errors,
          [currentQuestion.id]: activeTranslation
            ? activeTranslation.validUrlError
            : 'Por favor, insira uma URL válida',
        })
        return false
      }
    }

    if (answer && currentQuestion.type === 'phone') {
      const phoneRegex = /^[+]?[\d\s\-().]+$/
      if (!phoneRegex.test(String(answer))) {
        setErrors({
          ...errors,
          [currentQuestion.id]: activeTranslation
            ? activeTranslation.validPhoneError
            : 'Por favor, insira um telefone válido',
        })
        return false
      }
    }

    // Clear error if valid
    const newErrors = { ...errors }
    delete newErrors[currentQuestion.id]
    setErrors(newErrors)
    return true
  }, [hasStarted, currentQuestion, answers, errors, activeTranslation])

  const handleSubmit = useCallback(async () => {
    if (!validateCurrentQuestion()) return
    
    setIsSubmitting(true)
    
    const insertData = {
      form_id: form.id,
      answers: {
        ...answers,
        _survey_language: language,
      },
    }
    const { error } = await supabase
      .from('responses')
      .insert(insertData as never)

    if (error) {
      toast.error(language === 'en' ? 'Error submitting response' : 'Erro ao registrar resposta')
      setIsSubmitting(false)
    } else {
      setIsSubmitted(true)
    }
  }, [validateCurrentQuestion, form.id, answers, supabase, language])

  const goToNext = useCallback((skipValidation?: boolean) => {
    if (!hasStarted) {
      setHasStarted(true)
      return
    }

    // Check both the parameter and the ref for skip validation
    const shouldSkip = skipValidation || skipNextValidationRef.current
    skipNextValidationRef.current = false // Reset the ref
    
    if (!shouldSkip && !validateCurrentQuestion()) return

    // Early termination routing for Q1 and Q2 (checks both Portuguese and English)
    const q1Answer = answers['q01-consentimento']
    if (currentQuestion?.id === 'q01-consentimento' && (q1Answer === 'Não concordo.' || q1Answer === 'I do not agree.')) {
      setTerminationReason('consent_declined')
      setIsSubmitted(true)
      return
    }
    const q2Answer = answers['q02-atuacao-software']
    if (currentQuestion?.id === 'q02-atuacao-software' && (q2Answer === 'Não.' || q2Answer === 'No.')) {
      setTerminationReason('not_eligible')
      setIsSubmitted(true)
      return
    }
    
    if (isLastQuestion) {
      handleSubmit()
    } else {
      setDirection(1)
      setCurrentIndex(prev => Math.min(prev + 1, questions.length - 1))
    }
  }, [hasStarted, isLastQuestion, questions.length, validateCurrentQuestion, currentQuestion, answers, handleSubmit])

  const goToPrevious = useCallback(() => {
    if (!hasStarted) return
    setDirection(-1)
    if (currentIndex === 0) {
      setHasStarted(false)
    } else {
      setCurrentIndex(prev => Math.max(prev - 1, 0))
    }
  }, [hasStarted, currentIndex])

  const updateAnswer = (questionId: string, value: Json) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    // Clear error when user starts typing
    if (errors[questionId]) {
      const newErrors = { ...errors }
      delete newErrors[questionId]
      setErrors(newErrors)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitted || isSubmitting) return
      
      if (e.key === 'Enter' && !e.shiftKey) {
        if (!hasStarted) {
          e.preventDefault()
          setHasStarted(true)
          return
        }
        // Don't submit on enter for textarea
        if (currentQuestion?.type === 'long_text') {
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault()
            goToNext()
          }
          return
        }
        e.preventDefault()
        goToNext()
      }
      
      if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault()
        goToPrevious()
      }
      
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasStarted, currentQuestion, goToNext, goToPrevious, isSubmitted, isSubmitting])

  // Scroll/wheel navigation
  useEffect(() => {
    let lastScrollTime = 0
    const scrollThreshold = 500 // ms between scroll navigations
    const deltaThreshold = 50 // minimum scroll delta to trigger navigation

    const handleWheel = (e: WheelEvent) => {
      if (isSubmitted || isSubmitting) return
      
      // Don't interfere with scrollable inputs like textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'TEXTAREA') return
      
      const now = Date.now()
      if (now - lastScrollTime < scrollThreshold) return
      
      // Check if scroll delta is significant enough
      if (Math.abs(e.deltaY) < deltaThreshold) return
      
      if (e.deltaY > 0) {
        // Scrolling down - go to next question
        goToNext()
      } else {
        // Scrolling up - go to previous question
        goToPrevious()
      }
      
      lastScrollTime = now
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [goToNext, goToPrevious, isSubmitted, isSubmitting])

  // Thank you / Termination screen
  if (isSubmitted) {
    let thankTitle = activeTranslation?.completedSuccessTitle || form.thank_you_message || 'Obrigado pela participação!'
    let thankDesc = activeTranslation?.completedSuccessDesc || 'Sua resposta foi registrada com sucesso. Agradecemos sua colaboração com a pesquisa de TCC da PUC Minas.'

    if (terminationReason === 'consent_declined') {
      thankTitle = activeTranslation?.completedConsentDeclinedTitle || 'Participação encerrada'
      thankDesc = activeTranslation?.completedConsentDeclinedDesc || 'Agradecemos o seu tempo. Sua preferência de não concordar com o termo de participação foi registrada e nenhuma informação adicional foi solicitada.'
    } else if (terminationReason === 'not_eligible') {
      thankTitle = activeTranslation?.completedNotEligibleTitle || 'Agradecemos o seu interesse'
      thankDesc = activeTranslation?.completedNotEligibleDesc || 'Esta pesquisa tem como público-alvo profissionais que atuaram diretamente no desenvolvimento de software de pelo menos um jogo digital. Como você indicou que não atende a esse critério, o questionário foi encerrado.'
    }

    return (
      <div 
        className="min-h-screen flex items-center justify-center p-6"
        style={{ 
          ...themeStyles,
          backgroundColor: theme.backgroundColor,
          fontFamily: theme.fontFamily,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-lg"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 mx-auto mb-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${theme.primaryColor}20` }}
          >
            <Check className="w-10 h-10" style={{ color: theme.primaryColor }} />
          </motion.div>
          <h1 
            className="text-3xl md:text-4xl font-bold mb-4"
            style={{ color: theme.textColor }}
          >
            {thankTitle}
          </h1>
          <p 
            className="text-base sm:text-lg opacity-75 leading-relaxed mb-8"
            style={{ color: theme.textColor }}
          >
            {thankDesc}
          </p>

          <Button
            variant="outline"
            onClick={() => {
              setIsSubmitted(false)
              setTerminationReason(null)
              setCurrentIndex(0)
              setHasStarted(false)
            }}
            className="rounded-xl border px-6 py-2.5 text-sm font-medium transition-all hover:scale-105"
            style={{
              borderColor: `${theme.textColor}30`,
              color: theme.textColor,
            }}
          >
            {activeTranslation?.backToStart || 'Voltar ao início'}
          </Button>
          
          {/* OpenForm branding */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12"
          >
            <a 
              href="/"
              className="inline-flex items-center gap-2 text-sm opacity-50 hover:opacity-70 transition-opacity"
              style={{ color: theme.textColor }}
            >
              <span>Powered by</span>
              <span className="font-semibold">OpenForm</span>
            </a>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  // Empty form
  if (questions.length === 0) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-6"
        style={{ 
          backgroundColor: theme.backgroundColor,
          fontFamily: theme.fontFamily,
        }}
      >
        <p style={{ color: theme.textColor }} className="opacity-50">
          This form has no questions yet.
        </p>
      </div>
    )
  }

  const slideVariants = {
    enter: (direction: number) => ({
      y: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      y: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      y: direction > 0 ? -100 : 100,
      opacity: 0,
    }),
  }

  return (
    <div 
      ref={containerRef}
      className="min-h-screen flex flex-col"
      style={{ 
        ...themeStyles,
        backgroundColor: theme.backgroundColor,
        fontFamily: theme.fontFamily,
      }}
    >
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Progress 
          value={progress} 
          className="h-1 rounded-none"
          style={{ 
            backgroundColor: `${theme.primaryColor}20`,
          }}
          indicatorStyle={{
            backgroundColor: theme.primaryColor,
          }}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6 pt-12 pb-24">
        <div className={`w-full ${hasStarted && currentQuestion?.type === 'matrix' ? 'max-w-4xl lg:max-w-5xl' : 'max-w-2xl'}`}>
          <AnimatePresence mode="wait" custom={direction}>
            {!hasStarted ? (
              <motion.div
                key="welcome"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div 
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border"
                    style={{
                      borderColor: `${theme.primaryColor}40`,
                      backgroundColor: `${theme.primaryColor}15`,
                      color: theme.primaryColor,
                    }}
                  >
                    {badgeText}
                  </div>

                  {/* Language switcher pill in welcome header */}
                  {isSurveyForm && (
                    <div 
                      className="inline-flex items-center p-1 rounded-full border text-xs font-medium"
                      style={{
                        borderColor: `${theme.textColor}25`,
                        backgroundColor: `${theme.textColor}08`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleLanguageChange('pt')}
                        className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
                          language === 'pt' ? 'font-semibold shadow-sm' : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: language === 'pt' ? theme.primaryColor : 'transparent',
                          color: language === 'pt' ? theme.backgroundColor : theme.textColor,
                        }}
                      >
                        <span>🇧🇷</span>
                        <span>Português</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLanguageChange('en')}
                        className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
                          language === 'en' ? 'font-semibold shadow-sm' : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: language === 'en' ? theme.primaryColor : 'transparent',
                          color: language === 'en' ? theme.backgroundColor : theme.textColor,
                        }}
                      >
                        <span>🇺🇸</span>
                        <span>English</span>
                      </button>
                    </div>
                  )}
                </div>

                <h1 
                  className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight"
                  style={{ color: theme.textColor }}
                >
                  {formTitle}
                </h1>

                {formDescription && (
                  <div 
                    className="text-sm sm:text-base opacity-80 leading-relaxed whitespace-pre-line border-l-2 pl-4 py-1"
                    style={{ 
                      color: theme.textColor,
                      borderColor: theme.primaryColor,
                    }}
                  >
                    {formDescription}
                  </div>
                )}

                {/* Dedicated Language Preference Selection */}
                {isSurveyForm && (
                  <div 
                    className="p-4 sm:p-5 rounded-2xl border space-y-3 transition-all"
                    style={{
                      borderColor: `${theme.primaryColor}35`,
                      backgroundColor: `${theme.primaryColor}0c`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 shrink-0" style={{ color: theme.primaryColor }} />
                      <span className="text-xs sm:text-sm font-semibold tracking-wide uppercase opacity-80" style={{ color: theme.textColor }}>
                        {activeTranslation?.languagePrompt || 'Prefere responder em qual idioma?'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleLanguageChange('pt')}
                        className="flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                        style={{
                          borderColor: language === 'pt' ? theme.primaryColor : `${theme.textColor}20`,
                          backgroundColor: language === 'pt' ? `${theme.primaryColor}18` : 'transparent',
                          color: theme.textColor,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl leading-none">🇧🇷</span>
                          <div>
                            <div className="font-semibold text-sm sm:text-base">Português</div>
                            <div className="text-xs opacity-65">Responder pesquisa em português</div>
                          </div>
                        </div>
                        {language === 'pt' && (
                          <div 
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                            style={{ backgroundColor: theme.primaryColor, color: theme.backgroundColor }}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLanguageChange('en')}
                        className="flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                        style={{
                          borderColor: language === 'en' ? theme.primaryColor : `${theme.textColor}20`,
                          backgroundColor: language === 'en' ? `${theme.primaryColor}18` : 'transparent',
                          color: theme.textColor,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl leading-none">🇺🇸</span>
                          <div>
                            <div className="font-semibold text-sm sm:text-base">English</div>
                            <div className="text-xs opacity-65">Answer survey in English</div>
                          </div>
                        </div>
                        {language === 'en' && (
                          <div 
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                            style={{ backgroundColor: theme.primaryColor, color: theme.backgroundColor }}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex items-center gap-4">
                  <Button
                    onClick={() => setHasStarted(true)}
                    className="h-12 px-7 text-base font-semibold rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ 
                      backgroundColor: theme.primaryColor,
                      color: theme.backgroundColor,
                    }}
                  >
                    {activeTranslation?.startButton || 'Iniciar pesquisa'}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>

                  <span 
                    className="text-sm opacity-50"
                    style={{ color: theme.textColor }}
                  >
                    {activeTranslation?.pressEnter || 'pressione'} <kbd className="font-mono font-medium">{activeTranslation?.enterKey || 'Enter ↵'}</kbd>
                  </span>
                </div>
              </motion.div>
            ) : currentQuestion ? (
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                {/* Question number */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-4 flex items-center gap-2"
                >
                  <span 
                    className="text-base font-semibold"
                    style={{ color: theme.primaryColor }}
                  >
                    {currentQuestion.displayNumber ?? (currentIndex + 1)}
                  </span>
                  <ArrowRight className="w-4 h-4" style={{ color: theme.primaryColor }} />
                </motion.div>

                {/* Question */}
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 leading-snug"
                  style={{ color: theme.textColor }}
                >
                  {currentQuestion.title || 'Untitled question'}
                  {currentQuestion.required && (
                    <span style={{ color: theme.primaryColor }} className="ml-1">*</span>
                  )}
                </motion.h2>

                {currentQuestion.description && (
                  <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm sm:text-base opacity-75 mb-6 whitespace-pre-line leading-relaxed"
                    style={{ color: theme.textColor }}
                  >
                    {currentQuestion.description}
                  </motion.p>
                )}

                {/* Answer input */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="mt-6"
                >
                  <QuestionRenderer
                    question={currentQuestion}
                    value={answers[currentQuestion.id]}
                    onChange={(value) => updateAnswer(currentQuestion.id, value)}
                    theme={theme}
                    language={language}
                    error={errors[currentQuestion.id]}
                    onSubmit={(skipValidation?: boolean) => {
                      if (skipValidation) {
                        skipNextValidationRef.current = true
                      }
                      goToNext(skipValidation)
                    }}
                    onClearError={() => {
                      if (errors[currentQuestion.id]) {
                        const newErrors = { ...errors }
                        delete newErrors[currentQuestion.id]
                        setErrors(newErrors)
                      }
                    }}
                  />
                </motion.div>

                {/* Error message */}
                <AnimatePresence>
                  {errors[currentQuestion.id] && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-4 text-sm font-medium"
                      style={{ color: '#EF4444' }}
                    >
                      {errors[currentQuestion.id]}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Action buttons */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8 flex items-center gap-4"
                >
                  <Button
                    onClick={() => goToNext()}
                    disabled={isSubmitting}
                    className="h-12 px-6 text-base font-medium rounded-xl transition-all hover:scale-[1.02]"
                    style={{ 
                      backgroundColor: theme.primaryColor,
                      color: theme.backgroundColor,
                    }}
                  >
                    {isSubmitting ? (
                      activeTranslation?.submittingButton || 'Enviando...'
                    ) : isLastQuestion ? (
                      <>
                        {activeTranslation?.submitButton || 'Enviar'}
                        <Check className="w-4 h-4 ml-2" />
                      </>
                    ) : (
                      <>
                        {activeTranslation?.nextButton || 'OK'}
                        <Check className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <span 
                    className="text-sm opacity-50"
                    style={{ color: theme.textColor }}
                  >
                    {activeTranslation?.pressEnter || 'pressione'} <kbd className="font-mono font-medium">{activeTranslation?.enterKey || 'Enter ↵'}</kbd>
                  </span>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </main>

      {/* Navigation footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevious}
            disabled={isFirstQuestion}
            className="h-10 w-10 p-0"
            style={{ color: theme.textColor }}
          >
            <ChevronUp className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToNext()}
            disabled={isSubmitting}
            className="h-10 w-10 p-0"
            style={{ color: theme.textColor }}
          >
            <ChevronDown className="w-5 h-5" />
          </Button>

          {isSurveyForm && (
            <div 
              className="flex items-center p-0.5 rounded-lg border text-xs font-medium ml-1"
              style={{ 
                borderColor: `${theme.textColor}25`,
                backgroundColor: `${theme.textColor}08`,
              }}
            >
              <button
                type="button"
                onClick={() => handleLanguageChange('pt')}
                className={`px-2 py-1 rounded transition-all text-xs font-semibold ${
                  language === 'pt' ? 'shadow-sm' : 'opacity-50 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: language === 'pt' ? theme.primaryColor : 'transparent',
                  color: language === 'pt' ? theme.backgroundColor : theme.textColor,
                }}
                title="Responder em Português"
              >
                PT
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('en')}
                className={`px-2 py-1 rounded transition-all text-xs font-semibold ${
                  language === 'en' ? 'shadow-sm' : 'opacity-50 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: language === 'en' ? theme.primaryColor : 'transparent',
                  color: language === 'en' ? theme.backgroundColor : theme.textColor,
                }}
                title="Answer in English"
              >
                EN
              </button>
            </div>
          )}

          {/* Theme switcher button
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-3 flex items-center gap-2 rounded-lg border border-transparent hover:border-black/10 dark:hover:border-white/10"
                style={{ color: theme.textColor }}
                aria-label="Change theme"
              >
                <Palette className="w-4 h-4" />
                <span className="text-xs font-medium">{theme.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-44 p-1.5 shadow-xl bg-white text-slate-900 border border-slate-200">
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Select Theme
              </div>
              {themeList.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => setCurrentThemePreset(t.id)}
                  className="flex items-center justify-between cursor-pointer py-1.5 px-2 rounded text-xs hover:bg-slate-100"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0 flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: t.backgroundColor }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: t.primaryColor }}
                      />
                    </span>
                    <span>{t.name}</span>
                  </div>
                  {t.id === currentThemePreset && (
                    <Check className="w-3.5 h-3.5 text-blue-600 ml-2" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          */}
        </div>

        {/* Progress bar with percentage */}
        <div 
          className="flex items-center gap-2 sm:gap-3"
          aria-label={activeTranslation ? activeTranslation.progressTooltip(Math.round(progress)) : `Progress: ${Math.round(progress)}% completed`}
          title={activeTranslation ? activeTranslation.progressTooltip(Math.round(progress)) : `${Math.round(progress)}% completed`}
        >
          <div className="w-24 sm:w-36 md:w-48">
            <Progress 
              value={progress} 
              className="h-2 rounded-full"
              style={{ 
                backgroundColor: `${theme.primaryColor}25`,
              }}
              indicatorStyle={{
                backgroundColor: theme.primaryColor,
              }}
            />
          </div>
          <span 
            className="text-xs sm:text-sm font-medium tabular-nums"
            style={{ color: theme.textColor }}
          >
            {Math.round(progress)}%
          </span>
        </div>

        {/* OpenForm branding */}
        <a 
          href="/dashboard"
          className="text-sm opacity-50 hover:opacity-70 transition-opacity"
          style={{ color: theme.textColor }}
        >
          Powered by <span className="font-semibold">OpenForm</span>
        </a>
      </footer>
    </div>
  )
}

