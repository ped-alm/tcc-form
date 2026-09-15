# Task: Modernize React 19 Ref Handling in Turnstile Widget

**Severity**: LOW  
**Category**: React 19 / Modern Best Practices  
**Status**: Verified Issue  
**Files**: `components/form-player/turnstile-widget.tsx` (line 42)

---

### What is wrong
In `components/form-player/turnstile-widget.tsx`:
```tsx
export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  function TurnstileWidget(
    {
      siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      // ...
    },
    ref
  ) { ... }
)
```
In React 19, `forwardRef` is deprecated / legacy. `ref` is now passed directly as a standard component prop.

### Why it matters
React 19 simplifies ref forwarding by treating `ref` as a normal prop. Keeping legacy `forwardRef` wrappers adds unnecessary wrapper boilerplate, incurs minor compiler overhead, and violates 2026 React 19 coding guidelines.

### Concrete recommended fix
Refactor `TurnstileWidget` to accept `ref` directly as a prop:
```tsx
export function TurnstileWidget({
  ref,
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  onToken,
  onError,
  onExpire,
  theme = 'auto',
  size = 'flexible',
  language,
  className,
}: TurnstileWidgetProps & { ref?: React.Ref<TurnstileWidgetRef> }) {
  // ...
}
```

### Verification
Run `npm test` and verify tests using `ref` with `TurnstileWidget` continue to compile and function without React warnings.
