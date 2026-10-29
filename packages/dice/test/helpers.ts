import { DiceError } from '../src/errors'

export function catchDiceError(fn: () => unknown): DiceError {
  try {
    fn()
  } catch (err) {
    if (err instanceof DiceError) return err
    throw err
  }
  throw new Error('expected a DiceError, but nothing was thrown')
}
