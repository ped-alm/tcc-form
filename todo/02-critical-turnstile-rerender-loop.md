# Task: Fix Cloudflare Turnstile Re-render Loop & Token Invalidation

**Severity**: CRITICAL  
**Category**: React / UX & Correctness  
**Status**: Verified Issue  
**Files**: `components/form-player/turnstile-widget.tsx` (lines 71-154), `components/form-player/form-player.tsx` (lines 788-796)

---

### What is wrong
In `components/form-player/turnstile-widget.tsx`, the widget initialization `useEffect` includes callback props in its dependency array:
```tsx
useEffect(() => {
  if (!siteKey || !containerRef.current) return
  ...
}, [siteKey, onToken, onError, onExpire, theme, size, language])
```
In `components/form-player/form-player.tsx`, the parent passes unstable inline arrow functions on every render:
```tsx
<TurnstileWidget
  ref={turnstileRef}
  onToken={(token) => setTurnstileToken(token)}
  onError={() => setTurnstileToken(null)}
  onExpire={() => setTurnstileToken(null)}
  theme={['lavender', 'minimal'].includes(form.theme || 'ocean') ? 'light' : 'dark'}
  language={language}
  className="mt-6 mb-2"
/>
```
Whenever the user interacts with the final question (e.g. typing text into an input or selecting a rating), `FormPlayer` re-renders. Every re-render creates fresh instances of `onToken`, `onError`, and `onExpire`, triggering the `useEffect` cleanup (`window.turnstile.remove()`) and re-creating the Cloudflare Turnstile widget via `window.turnstile.render()`.

### Why it matters
1. **Wiped Tokens**: If the respondent solves the Cloudflare verification challenge first and then finishes answering the question, any keystroke or selection immediately destroys the Turnstile widget and wipes the solved token. The respondent is blocked from submitting because `turnstileToken` is cleared or expired.
2. **Infinite Loops & Flashing UI**: On text inputs, typing causes the Turnstile iframe to violently flash, reload, and re-render on every character, creating severe layout thrashing and an unusable experience.
3. **Form Lockout**: If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set in production, respondents may be completely unable to submit the survey.

### Concrete recommended fix
In `components/form-player/turnstile-widget.tsx`:
1. Use `useRef` (or `useLatest`) to hold the latest callback functions so they do not trigger effect re-executions:
```tsx
const onTokenRef = useRef(onToken)
const onErrorRef = useRef(onError)
const onExpireRef = useRef(onExpire)

useEffect(() => {
  onTokenRef.current = onToken
  onErrorRef.current = onError
  onExpireRef.current = onExpire
})
```
2. In the `renderWidget` callback, call `onTokenRef.current(token)`, `onErrorRef.current(err)`, and `onExpireRef.current()`.
3. Remove `onToken`, `onError`, `onExpire` from the `useEffect` dependency array:
```tsx
useEffect(() => {
  if (!siteKey || !containerRef.current) return
  // widget setup...
}, [siteKey, theme, size, language])
```

### Verification
1. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to a testing key (e.g., Cloudflare's always-pass key `1x00000000000000000000AA`).
2. Navigate to the last question of the survey.
3. Solve the Turnstile challenge so the token is acquired.
4. Type in the input field.
5. Verify that the Turnstile widget remains mounted, does not re-render, and does not lose the verification checkmark or token.
