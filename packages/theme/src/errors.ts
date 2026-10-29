export type ThemeErrorCode = 'THEME_CSS_INVALID'

export class ThemeError extends Error {
  readonly code: ThemeErrorCode

  constructor(code: ThemeErrorCode, message: string) {
    super(message)
    this.name = 'ThemeError'
    this.code = code
  }
}
