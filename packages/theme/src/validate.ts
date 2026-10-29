import { Value } from '@sinclair/typebox/value'
import { ThemeManifest } from './schema'

export interface ThemeValidationError {
  /** JSON pointer to the offending value, e.g. "/tokens/color/bg". */
  path: string
  message: string
}

export type ValidateThemeResult =
  { ok: true; theme: ThemeManifest } | { ok: false; errors: ThemeValidationError[] }

export function validateTheme(json: unknown): ValidateThemeResult {
  if (Value.Check(ThemeManifest, json)) return { ok: true, theme: json }
  const errors = [...Value.Errors(ThemeManifest, json)].map((error) => ({
    path: error.path,
    message: error.message,
  }))
  return { ok: false, errors }
}
