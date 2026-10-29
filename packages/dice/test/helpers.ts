import { DiceError } from '../src/errors'
import type { Rng } from '../src/rng'

export function catchDiceError(fn: () => unknown): DiceError {
  try {
    fn()
  } catch (err) {
    if (err instanceof DiceError) return err
    throw err
  }
  throw new Error('expected a DiceError, but nothing was thrown')
}

/** Returns the given values in order; throws when exhausted. */
export function sequenceRng(values: number[]): Rng {
  let index = 0
  return () => {
    const value = values[index++]
    if (value === undefined) throw new Error('sequenceRng exhausted')
    return value
  }
}

/** Deterministic mulberry32-based RNG for property tests. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0
  return (min, max) => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296
    return min + Math.floor(r * (max - min + 1))
  }
}
