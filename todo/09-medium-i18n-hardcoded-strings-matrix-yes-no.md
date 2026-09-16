# Task: Complete Bilingual Localization in Question Renderer UI

**Severity**: MEDIUM  
**Category**: Maintainability & UI / UX  
**Status**: Resolved
**Files**: `components/form-player/question-renderer.tsx` (lines 148, 156, 172, 308-320, 502-511, 516), `lib/validation.ts` (lines 253-261)

---

### What is wrong
1. **Matrix Question hardcoded in Portuguese**:
   In `MatrixQuestion`, the header and progress counter are hardcoded in Portuguese:
   - Line 148: `<span>Avaliação dos tópicos</span>`
   - Line 156: `{answeredCount} de {rows.length} preenchidos`
   - Line 172: `<th>Tópico</th>`
   `MatrixQuestion` does not receive or use the `language` prop.
2. **Yes/No Question hardcoded in English**:
   In `QuestionRenderer` line 516:
   ```tsx
   case 'yes_no':
     return (
       <div className="flex gap-4">
         {['Yes', 'No'].map((option) => { ... })}
       </div>
     )
   ```
   The buttons render "Yes" and "No" even when the survey language is Portuguese (`language === 'pt'`).
3. **FileUpload Question hardcoded strings**:
   Lines 32, 100-102 display hardcoded English strings ("File upload is currently unavailable", "Click to upload", "Images & PDFs up to...").

### Why it matters
The survey is designed as bilingual research for both Brazilian and international game developers. Presenting Portuguese text to English-speaking respondents on matrix questions, or presenting English "Yes/No" buttons to Portuguese respondents, degrades the user experience, creates confusion, and harms response rates.

### Concrete recommended fix
1. Pass `language` to `MatrixQuestion`:
```tsx
interface MatrixQuestionProps {
  question: QuestionConfig
  value: Json
  onChange: (value: Json) => void
  theme: ThemeConfig
  onClearError?: () => void
  language?: 'pt' | 'en'
}
```
2. In `MatrixQuestion`, replace hardcoded strings with localized variables:
```tsx
const isEnglish = language === 'en'
const headerTitle = isEnglish ? 'Topic evaluation' : 'Avaliação dos tópicos'
const progressLabel = isEnglish
  ? `${answeredCount} of ${rows.length} completed`
  : `${answeredCount} de ${rows.length} preenchidos`
const columnTopicHeader = isEnglish ? 'Topic' : 'Tópico'
```
3. In `case 'yes_no'`, localize the options:
```tsx
const options = language === 'en' ? ['Yes', 'No'] : ['Sim', 'Não']
```

### Verification
1. Switch language toggle to English (`EN`) and navigate to the matrix question: verify all headers and progress indicators display in English.
2. Switch language toggle to Portuguese (`PT`) and view a `yes_no` question: verify buttons display "Sim" and "Não".
