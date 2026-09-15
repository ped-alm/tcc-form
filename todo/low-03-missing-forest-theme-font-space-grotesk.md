# Issue: Missing Font Asset for 'forest' Theme

**Severity**: LOW  
**Category**: Frontend & Styling  
**File and line**: `lib/themes.ts:38`, `app/layout.tsx:1-29`

### What is wrong
`lib/themes.ts` assigns `Space Grotesk` as the font family for the `forest` preset:
```typescript
forest: {
  id: 'forest',
  name: 'Forest',
  primaryColor: '#10B981',
  backgroundColor: '#022C22',
  textColor: '#ECFDF5',
  accentColor: '#34D399',
  fontFamily: "'Space Grotesk', sans-serif",
}
```
However, `app/layout.tsx` imports only `DM_Sans`, `Plus_Jakarta_Sans`, `Outfit`, `Sora`, and `Inter`. `Space_Grotesk` is never loaded.

### Why it matters
When a form is styled with the `forest` theme, the browser cannot find `Space Grotesk` and falls back to system generic `sans-serif`, degrading visual polish and design fidelity.

### Concrete recommended fix
Either:
1. Import `Space_Grotesk` in `app/layout.tsx`:
   ```typescript
   import { Space_Grotesk } from "next/font/google";
   const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
   ```
   Add its variable to the `<body>` class list.
2. Or change `forest`'s `fontFamily` in `lib/themes.ts` to one of the already loaded fonts (e.g. `'Plus Jakarta Sans', sans-serif`).
