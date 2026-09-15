import { describe, it, expect } from 'vitest'
import { themes, themeList, getTheme, getThemeCSSVariables } from '@/lib/themes'
import { ThemePreset } from '@/lib/database.types'
import { cn } from '@/lib/utils'

describe('themes', () => {
  it('should have all 6 core theme presets configured', () => {
    expect(themeList).toHaveLength(6)
    const expectedThemes = ['midnight', 'ocean', 'sunset', 'forest', 'lavender', 'minimal']
    expectedThemes.forEach((t) => {
      expect(themes[t as keyof typeof themes]).toBeDefined()
      expect(themes[t as keyof typeof themes].primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(themes[t as keyof typeof themes].backgroundColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
    })
  })

  it('should return the requested theme or fallback to ocean', () => {
    expect(getTheme('forest').id).toBe('forest')
    expect(getTheme('sunset').id).toBe('sunset')
    // Fallback for non-existent preset
    expect(getTheme('non-existent' as unknown as ThemePreset).id).toBe('ocean')
  })

  it('should generate valid CSS custom properties', () => {
    const vars = getThemeCSSVariables(themes.forest)
    expect(vars).toEqual({
      '--theme-primary': '#10B981',
      '--theme-background': '#022C22',
      '--theme-text': '#ECFDF5',
      '--theme-accent': '#34D399',
      '--theme-font': "'Space Grotesk', sans-serif",
    })
  })
})

describe('cn utility', () => {
  it('should merge classes and handle Tailwind conflicts', () => {
    expect(cn('p-4', 'bg-red-500')).toBe('p-4 bg-red-500')
    // Override bg-red-500 with bg-blue-500
    expect(cn('p-4 bg-red-500', 'bg-blue-500')).toBe('p-4 bg-blue-500')
    // Handle falsy values and conditional classes
    expect(cn('btn', false && 'hidden', null, undefined, 'btn-primary')).toBe('btn btn-primary')
  })
})
