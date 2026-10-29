export type DiceErrorCode =
  | 'DICE_SYNTAX'
  | 'DICE_UNKNOWN_VARIABLE'
  | 'DICE_LIMIT'
  | 'DICE_DIVISION_BY_ZERO'
  | 'DICE_INVALID_KEEP'

export class DiceError extends Error {
  readonly code: DiceErrorCode
  readonly position?: number

  constructor(code: DiceErrorCode, message: string, position?: number) {
    super(message)
    this.name = 'DiceError'
    this.code = code
    this.position = position
  }
}
