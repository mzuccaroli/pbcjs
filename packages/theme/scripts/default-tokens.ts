import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toCssVariables } from '../src/css-vars'
import { validateTheme } from '../src/validate'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

export const DEFAULT_THEME_PATH = join(repoRoot, 'themes/default/theme.json')
export const TOKENS_CSS_PATH = join(repoRoot, 'apps/web/src/theme/tokens.css')
export const TOKENS_CSS_HEADER =
  '/* Generated from themes/default/theme.json by pnpm theme:build — do not edit */'

export async function renderDefaultTokensCss(): Promise<string> {
  const result = validateTheme(JSON.parse(await readFile(DEFAULT_THEME_PATH, 'utf8')))
  if (!result.ok) {
    const details = result.errors.map((e) => `  ${e.path} ${e.message}`).join('\n')
    throw new Error(`Invalid ${DEFAULT_THEME_PATH}:\n${details}`)
  }
  return `${TOKENS_CSS_HEADER}\n${toCssVariables(result.theme.tokens)}`
}
