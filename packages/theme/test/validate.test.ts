import { describe, expect, it } from 'vitest'
import { validateTheme, type TokenCategory } from '../src/index'

const base = { id: 'dark-fantasy', name: 'Dark Fantasy', version: '1.0.0', tokens: {} }

function withTokens(tokens: Record<string, unknown>) {
  return { ...base, tokens }
}

function acceptsToken(category: TokenCategory, value: string): boolean {
  return validateTheme(withTokens({ [category]: { x: value } })).ok
}

describe('validateTheme', () => {
  it('accepts a minimal theme and returns it', () => {
    expect(validateTheme(base)).toEqual({ ok: true, theme: base })
  })

  it('accepts a theme using every category and the reserved fields', () => {
    const theme = {
      ...base,
      tokens: {
        color: { bg: '#14110f', 'chat-action': '#c9a96e' },
        font: { body: 'Lora', heading: 'Cinzel' },
        radius: { base: '4px' },
        space: { '1': '0.25rem', '2': '0.5rem' },
        image: { logo: 'assets/logo.png' },
      },
      layout: null,
      components: { anything: true },
    }
    expect(validateTheme(theme).ok).toBe(true)
  })

  it.each([
    '#abc',
    '#AABBCC',
    '#aabbccdd',
    'rgb(1, 2, 3)',
    'rgba(1,2,3,0.5)',
    'rgb(1 2 3 / 50%)',
    'hsl(120deg, 50%, 50%)',
    'hsla(120, 50%, 50%, 0.3)',
  ])('accepts color %j', (value) => {
    expect(acceptsToken('color', value)).toBe(true)
  })

  it.each([
    'red',
    '#abcd',
    '#ggg',
    'rgb(1,2)',
    'rgb(a,b,c)',
    'var(--x)',
    'url(x)',
    'rgb(1,2,3);',
    '#fff; } body { display: none',
  ])('rejects color %j', (value) => {
    expect(acceptsToken('color', value)).toBe(false)
  })

  it.each(['Lora', "system-ui, -apple-system, 'Segoe UI', roboto, sans-serif", '"Cinzel", serif'])(
    'accepts font %j',
    (value) => {
      expect(acceptsToken('font', value)).toBe(true)
    },
  )

  it.each(['Lora; color: red', 'Lora}', 'url(x)', '<script>', 'Lora\\', ''])(
    'rejects font %j',
    (value) => {
      expect(acceptsToken('font', value)).toBe(false)
    },
  )

  it.each(['0', '4px', '0.5rem', '1.25em', '50%'])('accepts length %j', (value) => {
    expect(acceptsToken('radius', value)).toBe(true)
    expect(acceptsToken('space', value)).toBe(true)
  })

  it.each(['4', '4 px', '-1px', '4px;', 'calc(1px + 2px)', '1vh'])('rejects length %j', (value) => {
    expect(acceptsToken('radius', value)).toBe(false)
    expect(acceptsToken('space', value)).toBe(false)
  })

  it.each(['assets/logo.png', 'assets/img/bg.webp', 'assets/a.b.svg', 'assets/photo.jpeg'])(
    'accepts image %j',
    (value) => {
      expect(acceptsToken('image', value)).toBe(true)
    },
  )

  it.each([
    'logo.png',
    '/assets/logo.png',
    'assets/../secret.png',
    'assets//x.png',
    'assets/x.exe',
    'assets/x.png?x=1',
    'https://evil.example/x.png',
  ])('rejects image %j', (value) => {
    expect(acceptsToken('image', value)).toBe(false)
  })

  it.each(['chat-action', '1', 'h1'])('accepts token key %j', (key) => {
    expect(validateTheme(withTokens({ color: { [key]: '#000' } })).ok).toBe(true)
  })

  it.each(['Bg', '-bg', 'bg_x', ''])('rejects token key %j', (key) => {
    expect(validateTheme(withTokens({ color: { [key]: '#000' } })).ok).toBe(false)
  })

  it.each([
    ['id with spaces', { ...base, id: 'Dark Fantasy' }],
    ['id starting with dash', { ...base, id: '-dark' }],
    ['id too long', { ...base, id: 'a'.repeat(64) }],
    ['empty name', { ...base, name: '' }],
    ['name too long', { ...base, name: 'a'.repeat(81) }],
    ['short version', { ...base, version: '1.0' }],
    ['prefixed version', { ...base, version: 'v1.0.0' }],
    ['unknown top-level field', { ...base, author: 'me' }],
    ['unknown token category', withTokens({ shadow: { base: '0' } })],
    ['missing tokens', { id: 'x', name: 'X', version: '1.0.0' }],
  ])('rejects %s', (_label, theme) => {
    expect(validateTheme(theme).ok).toBe(false)
  })

  it('accepts a pre-release version', () => {
    expect(validateTheme({ ...base, version: '1.0.0-beta.1' }).ok).toBe(true)
  })

  it('reports errors with JSON-pointer paths', () => {
    const result = validateTheme(withTokens({ color: { bg: 'red' } }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.path === '/tokens/color/bg')).toBe(true)
    expect(result.errors.every((e) => typeof e.message === 'string')).toBe(true)
  })

  it.each([null, 'theme', 42, []])('rejects non-object input %j', (input) => {
    expect(validateTheme(input).ok).toBe(false)
  })
})
