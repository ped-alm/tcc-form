# Issue: Wheel Event Listener Hijacking & Scroll Debounce Reset

**Severity**: MEDIUM  
**Category**: React & User Experience / Performance  
**File and line**: `components/form-player/form-player.tsx:288-320`

### What is wrong
The form player registers a global `wheel` event listener to advance questions on mouse wheel scroll:
1. **Debounce Reset**: The debounce variable `let lastScrollTime = 0` is scoped inside the `useEffect` closure. Because the effect's dependencies change on every keystroke (`goToNext` is recreated whenever `answers` change), the effect re-runs and resets `lastScrollTime` to 0 on every typed character.
2. **Scroll Hijacking**: The wheel handler only excludes `target.tagName === 'TEXTAREA'`. For questions with large matrix tables, dropdown option lists, or checkbox options, scrolling down within the list triggers `goToNext()` and forcefully skips the question.

### Why it matters
Users attempting to scroll down to view all options or matrix rows are involuntarily advanced to the next question before finishing their answer. This creates significant frustration, causes incomplete answers, and breaks form usability on desktop browsers.

### Concrete recommended fix
1. Move `lastScrollTime` to a `useRef(0)` so it persists across renders without triggering effect cleanups:
   ```typescript
   const lastScrollTimeRef = useRef(0)
   ```
2. Check whether the event target or its parent is scrollable before triggering navigation:
   ```typescript
   let el: HTMLElement | null = e.target as HTMLElement
   while (el && el !== containerRef.current) {
     if (el.scrollHeight > el.clientHeight && ['auto', 'scroll'].includes(window.getComputedStyle(el).overflowY)) {
       return // Let the internal container scroll
     }
     el = el.parentElement
   }
   ```
3. Provide a user setting or prop to disable wheel-based question navigation.
