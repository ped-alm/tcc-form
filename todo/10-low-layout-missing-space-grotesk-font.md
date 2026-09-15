# Task: Import Missing Space Grotesk Font for Forest Theme

**Severity**: LOW  
**Category**: Next.js & UI Architecture  
**Status**: Verified Issue  
**Files**: `app/layout.tsx` (lines 6-29, 44), `lib/themes.ts` (line 38)

---

### What is wrong
In `lib/themes.ts`, the `forest` theme configuration specifies:
```ts
forest: {
  id: 'forest',
  name: 'Forest',
  // ...
  fontFamily: "'Space Grotesk', sans-serif",
}
```
However, in `app/layout.tsx`, Google Fonts are imported using `next/font/google`:
```tsx
const dmSans = DM_Sans({ ... });
const plusJakarta = Plus_Jakarta_Sans({ ... });
const outfit = Outfit({ ... });
const sora = Sora({ ... });
const inter = Inter({ ... });
```
`Space_Grotesk` is never imported or configured in `app/layout.tsx`.

### Why it matters
When a form uses the `forest` theme, the browser fails to locate `Space Grotesk` (unless installed locally on the respondent's operating system) and silently falls back to the system generic `sans-serif`. This causes font popping, unexpected layout shifts (CLS), and visual inconsistency.

### Concrete recommended fix
1. In `app/layout.tsx`, import and initialize `Space_Grotesk`:
```tsx
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});
```
2. Include `${spaceGrotesk.variable}` in the `<body>` className in `app/layout.tsx`:
```tsx
<body className={`${dmSans.variable} ${plusJakarta.variable} ${outfit.variable} ${sora.variable} ${inter.variable} ${spaceGrotesk.variable} antialiased`}>
```
3. Update `lib/themes.ts` to reference `var(--font-space-grotesk), sans-serif`.

### Verification
Select or preview the form with `theme = 'forest'`. Inspect the font loaded via DevTools Network / Computed tab and verify `Space Grotesk` is loaded via `next/font`.
