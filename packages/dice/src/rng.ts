import { randomInt } from 'node:crypto'

/** Returns an integer between min and max, both inclusive. */
export type Rng = (min: number, max: number) => number

export const cryptoRng: Rng = (min, max) => randomInt(min, max + 1)
