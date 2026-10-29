import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DiceError, parse, roll } from '../src/index'
import { seededRng } from './helpers'

const formulaAlphabet = fc.constantFrom(...'0123456789dDkhlminax+-*/(),{}_ '.split(''))
const anyText = fc.oneof(fc.string(), fc.string({ unit: formulaAlphabet, maxLength: 40 }))

describe('dice properties', () => {
  it('NdM always totals between N and N*M', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 2, max: 1000 }),
        fc.integer(),
        (n, m, seed) => {
          const result = roll(`${n}d${m}`, { rng: seededRng(seed) })
          expect(result.rolls[0]?.results).toHaveLength(n)
          expect(result.total).toBeGreaterThanOrEqual(n)
          expect(result.total).toBeLessThanOrEqual(n * m)
        },
      ),
    )
  })

  it('kh and kl keep exactly k dice and sum only those', () => {
    fc.assert(
      fc.property(
        fc
          .integer({ min: 1, max: 20 })
          .chain((n) => fc.tuple(fc.constant(n), fc.integer({ min: 1, max: n }))),
        fc.constantFrom('kh', 'kl'),
        fc.integer(),
        ([n, k], mode, seed) => {
          const result = roll(`${n}d6${mode}${k}`, { rng: seededRng(seed) })
          const die = result.rolls[0]
          if (!die) throw new Error('missing roll')
          expect(die.kept).toHaveLength(k)
          const keptValues = die.kept.map((i) => die.results[i] as number)
          const dropped = die.results.filter((_, i) => !die.kept.includes(i))
          expect(result.total).toBe(keptValues.reduce((a, b) => a + b, 0))
          for (const value of keptValues) {
            for (const other of dropped) {
              if (mode === 'kh') expect(value).toBeGreaterThanOrEqual(other)
              else expect(value).toBeLessThanOrEqual(other)
            }
          }
        },
      ),
    )
  })

  it('parse only ever throws DiceError', () => {
    fc.assert(
      fc.property(anyText, (text) => {
        try {
          parse(text)
        } catch (err) {
          return err instanceof DiceError
        }
        return true
      }),
    )
  })

  it('roll only ever throws DiceError', () => {
    fc.assert(
      fc.property(anyText, fc.integer(), (text, seed) => {
        try {
          roll(text, { vars: { a: 2, ax: 3 }, rng: seededRng(seed) })
        } catch (err) {
          return err instanceof DiceError
        }
        return true
      }),
    )
  })

  it('is deterministic for the same formula, vars and rng seed', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('4d6kh3+{forza}', '2d20kl1-1', 'max(1d6,1d8)*2', '{forza}d10/3'),
        fc.integer(),
        (formula, seed) => {
          const opts = { vars: { forza: 4 } }
          expect(roll(formula, { ...opts, rng: seededRng(seed) })).toEqual(
            roll(formula, { ...opts, rng: seededRng(seed) }),
          )
        },
      ),
    )
  })
})
