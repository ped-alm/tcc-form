# Issue: Hardcoded TCC Survey Domain Coupling in Generic Components

**Severity**: LOW  
**Category**: Architecture & Maintainability  
**File and line**: `components/form-player/form-player.tsx:35-39`, `208-220`, `lib/example-form.ts`

### What is wrong
The generic `FormPlayer` component contains hardcoded checks specifically for Pedro's TCC research survey:
```typescript
const isSurveyForm =
  form.id === EXAMPLE_FORM_ID ||
  form.slug === EXAMPLE_FORM_SLUG ||
  Boolean(form.questions && (form.questions as QuestionConfig[]).some(q => q.id === 'q01-consentimento'))
```
It also includes hardcoded string comparisons for early termination:
```typescript
const q1Answer = answers['q01-consentimento']
if (currentQuestion?.id === 'q01-consentimento' && (q1Answer === 'Não concordo.' || q1Answer === 'I do not agree.')) {
  setTerminationReason('consent_declined')
  setIsSubmitted(true)
  return
}
```

### Why it matters
This couples a general-purpose TypeForm clone to one specific survey dataset. If another user creates a form containing questions with ID `q01-consentimento`, unwanted survey translations and termination rules will trigger unexpectedly.

### Concrete recommended fix
Extract survey-specific features into generic configuration:
1. Support form-level multilingual translations through a generic `translations` JSON property on `forms`.
2. Model early termination and conditional routing inside `QuestionConfig` as logic jumps:
   ```typescript
   interface LogicJump {
     condition: 'equals' | 'not_equals'
     value: string
     action: 'terminate' | 'jump_to'
     target?: string
     messageTitle?: string
     messageDescription?: string
   }
   ```
3. Evaluate logic jumps dynamically rather than hardcoding string comparisons.
