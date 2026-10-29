import { TOKEN_CATEGORIES, type ThemeManifest, type ThemeTokens } from './schema'

/** Fills tokens missing from theme with the default theme's; extra keys are kept. */
export function mergeWithDefault(theme: ThemeManifest, defaultTheme: ThemeManifest): ThemeManifest {
  const tokens: ThemeTokens = {}
  for (const category of TOKEN_CATEGORIES) {
    const merged = { ...defaultTheme.tokens[category], ...theme.tokens[category] }
    if (Object.keys(merged).length > 0) tokens[category] = merged
  }
  return { ...theme, tokens }
}
