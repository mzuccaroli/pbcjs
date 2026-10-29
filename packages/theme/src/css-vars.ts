import { TOKEN_CATEGORIES, type ThemeTokens } from './schema'

export interface CssVariablesOptions {
  /** Prefix for image paths, e.g. "/themes/dark". */
  assetBaseUrl?: string
}

export function toCssVariables(tokens: ThemeTokens, opts: CssVariablesOptions = {}): string {
  const lines: string[] = []
  for (const category of TOKEN_CATEGORIES) {
    for (const [key, value] of Object.entries(tokens[category] ?? {})) {
      const cssValue = category === 'image' ? imageUrl(value, opts.assetBaseUrl) : value
      lines.push(`  --pbc-${category}-${key}: ${cssValue};`)
    }
  }
  return lines.length === 0 ? ':root {\n}\n' : `:root {\n${lines.join('\n')}\n}\n`
}

function imageUrl(path: string, assetBaseUrl: string | undefined): string {
  const url = assetBaseUrl === undefined ? path : `${assetBaseUrl.replace(/\/+$/, '')}/${path}`
  return `url('${url}')`
}
