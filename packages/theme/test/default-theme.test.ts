import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { TOKEN_CATEGORIES, validateTheme } from '../src/index'
import {
  DEFAULT_THEME_PATH,
  renderDefaultTokensCss,
  TOKENS_CSS_HEADER,
  TOKENS_CSS_PATH,
} from '../scripts/default-tokens'

describe('default theme', () => {
  it('is a valid theme with id "default"', async () => {
    const result = validateTheme(JSON.parse(await readFile(DEFAULT_THEME_PATH, 'utf8')))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.theme.id).toBe('default')
  })

  it('defines every category except image', async () => {
    const theme = JSON.parse(await readFile(DEFAULT_THEME_PATH, 'utf8'))
    for (const category of TOKEN_CATEGORIES.filter((c) => c !== 'image')) {
      expect(Object.keys(theme.tokens[category] ?? {}).length, category).toBeGreaterThan(0)
    }
  })

  it('renders tokens.css with the generated-file header', async () => {
    expect((await renderDefaultTokensCss()).startsWith(`${TOKENS_CSS_HEADER}\n:root {\n`)).toBe(
      true,
    )
  })

  it('keeps apps/web/src/theme/tokens.css in sync with theme.json', async () => {
    const actual = await readFile(TOKENS_CSS_PATH, 'utf8')
    expect(actual, 'tokens.css is out of date: run pnpm theme:build').toBe(
      await renderDefaultTokensCss(),
    )
  })
})
