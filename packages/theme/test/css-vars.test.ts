import { describe, expect, it } from 'vitest'
import { toCssVariables } from '../src/index'

describe('toCssVariables', () => {
  it('emits categories in fixed order with --pbc- prefixes', () => {
    const css = toCssVariables({
      image: { logo: 'assets/logo.png' },
      color: { bg: '#000', 'chat-action': '#111' },
      space: { '2': '1rem', '1': '0.5rem' },
      font: { body: "'Segoe UI', sans-serif" },
      radius: { base: '4px' },
    })
    expect(css).toBe(
      [
        ':root {',
        '  --pbc-color-bg: #000;',
        '  --pbc-color-chat-action: #111;',
        "  --pbc-font-body: 'Segoe UI', sans-serif;",
        '  --pbc-radius-base: 4px;',
        '  --pbc-space-1: 0.5rem;',
        '  --pbc-space-2: 1rem;',
        "  --pbc-image-logo: url('assets/logo.png');",
        '}',
        '',
      ].join('\n'),
    )
  })

  it('prefixes image paths with assetBaseUrl', () => {
    const css = toCssVariables(
      { image: { logo: 'assets/logo.png' } },
      { assetBaseUrl: '/themes/dark/' },
    )
    expect(css).toContain("--pbc-image-logo: url('/themes/dark/assets/logo.png');")
  })

  it('emits an empty block without tokens', () => {
    expect(toCssVariables({})).toBe(':root {\n}\n')
  })
})
