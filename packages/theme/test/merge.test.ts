import { describe, expect, it } from 'vitest'
import { mergeWithDefault, type ThemeManifest } from '../src/index'

const defaultTheme: ThemeManifest = {
  id: 'default',
  name: 'Default',
  version: '1.0.0',
  tokens: {
    color: { bg: '#000', text: '#fff' },
    font: { body: 'Lora' },
    radius: { base: '4px' },
  },
}

const theme: ThemeManifest = {
  id: 'dark',
  name: 'Dark',
  version: '2.0.0',
  tokens: {
    color: { text: '#eee', extra: '#123' },
    space: { '1': '1rem' },
  },
  layout: null,
}

describe('mergeWithDefault', () => {
  it('inherits missing tokens and keeps overrides and extras', () => {
    expect(mergeWithDefault(theme, defaultTheme)).toEqual({
      id: 'dark',
      name: 'Dark',
      version: '2.0.0',
      tokens: {
        color: { bg: '#000', text: '#eee', extra: '#123' },
        font: { body: 'Lora' },
        radius: { base: '4px' },
        space: { '1': '1rem' },
      },
      layout: null,
    })
  })

  it('keeps default key order with extras appended', () => {
    const merged = mergeWithDefault(theme, defaultTheme)
    expect(Object.keys(merged.tokens.color ?? {})).toEqual(['bg', 'text', 'extra'])
  })

  it('does not mutate its inputs', () => {
    const before = JSON.stringify([theme, defaultTheme])
    mergeWithDefault(theme, defaultTheme)
    expect(JSON.stringify([theme, defaultTheme])).toBe(before)
  })

  it('omits categories that are empty in both themes', () => {
    const merged = mergeWithDefault(theme, defaultTheme)
    expect(Object.keys(merged.tokens)).toEqual(['color', 'font', 'radius', 'space'])
  })
})
