import { describe, expect, it } from 'vitest'
import { roll, type Rng } from '../src/index'
import { catchDiceError, sequenceRng } from './helpers'

describe('roll', () => {
  it('rolls 4d6kh3 plus a variable', () => {
    const result = roll('4d6kh3+{forza}', { vars: { forza: 3 }, rng: sequenceRng([6, 4, 1, 1]) })
    expect(result).toEqual({
      total: 14,
      formula: '4d6kh3+{forza}',
      resolved: '4d6kh3+3',
      rolls: [{ die: '4d6kh3', results: [6, 4, 1, 1], kept: [0, 1, 2] }],
    })
  })

  it('keeps the highest, preferring lower indices on ties', () => {
    const result = roll('3d6kh1', { rng: sequenceRng([4, 6, 6]) })
    expect(result.total).toBe(6)
    expect(result.rolls[0]?.kept).toEqual([1])
  })

  it('keeps the lowest with kl', () => {
    const result = roll('3d20kl2', { rng: sequenceRng([12, 3, 7]) })
    expect(result.total).toBe(10)
    expect(result.rolls[0]?.kept).toEqual([1, 2])
  })

  it('keeps every die when there is no keep', () => {
    const result = roll('3d6', { rng: sequenceRng([1, 2, 3]) })
    expect(result.total).toBe(6)
    expect(result.rolls[0]?.kept).toEqual([0, 1, 2])
  })

  it('treats d20 as 1d20', () => {
    const result = roll('d20', { rng: sequenceRng([17]) })
    expect(result).toEqual({
      total: 17,
      formula: 'd20',
      resolved: '1d20',
      rolls: [{ die: '1d20', results: [17], kept: [0] }],
    })
  })

  it('applies precedence and keeps parentheses in resolved', () => {
    expect(roll('2+3*4').total).toBe(14)
    const grouped = roll('(2 + 3) * 4')
    expect(grouped.total).toBe(20)
    expect(grouped.resolved).toBe('(2+3)*4')
  })

  it('floors integer division', () => {
    expect(roll('7/2').total).toBe(3)
    expect(roll('-7/2').total).toBe(-4)
    expect(roll('(1d6+3)/2', { rng: sequenceRng([6]) }).total).toBe(4)
  })

  it('allows negative totals', () => {
    expect(roll('1d4-10', { rng: sequenceRng([2]) }).total).toBe(-8)
  })

  it('evaluates min and max', () => {
    const result = roll('max(1d6,3,2)', { rng: sequenceRng([1]) })
    expect(result.total).toBe(3)
    expect(result.resolved).toBe('max(1d6,3,2)')
    expect(roll('min(5,2,9)').total).toBe(2)
  })

  it('rolls a dice pool sized by a variable', () => {
    const result = roll('{forza}d6', { vars: { forza: 3 }, rng: sequenceRng([1, 2, 3]) })
    expect(result.total).toBe(6)
    expect(result.resolved).toBe('3d6')
    expect(result.rolls[0]?.die).toBe('3d6')
  })

  it('records rolls in formula order', () => {
    const result = roll('1d4+1d6', { rng: sequenceRng([3, 5]) })
    expect(result.rolls).toEqual([
      { die: '1d4', results: [3], kept: [0] },
      { die: '1d6', results: [5], kept: [0] },
    ])
  })

  it('asks the rng for values between 1 and sides', () => {
    const calls: Array<[number, number]> = []
    const rng: Rng = (min, max) => {
      calls.push([min, max])
      return min
    }
    roll('2d8', { rng })
    expect(calls).toEqual([
      [1, 8],
      [1, 8],
    ])
  })

  it('uses the crypto rng by default', () => {
    for (let i = 0; i < 50; i++) {
      const { total } = roll('3d6')
      expect(total).toBeGreaterThanOrEqual(3)
      expect(total).toBeLessThanOrEqual(18)
    }
  })

  it('allows exactly 100 dice per roll', () => {
    expect(roll('50d6+50d6').rolls).toHaveLength(2)
  })

  it.each(['1/0', '1/(2-2)'])('rejects division by zero in %j', (formula) => {
    expect(catchDiceError(() => roll(formula)).code).toBe('DICE_DIVISION_BY_ZERO')
  })

  it('rejects unknown variables with their position', () => {
    const err = catchDiceError(() => roll('1+{forza}'))
    expect(err.code).toBe('DICE_UNKNOWN_VARIABLE')
    expect(err.position).toBe(2)
  })

  it.each([
    ['101d6', {}],
    ['51d6+50d6', {}],
    ['1d1', {}],
    ['1d1001', {}],
    ['0d6', {}],
    ['{n}d6', { n: 0 }],
    ['{n}d6', { n: 2.5 }],
    ['2d{s}', { s: 1 }],
  ])('rejects %j with DICE_LIMIT', (formula, vars) => {
    expect(catchDiceError(() => roll(formula, { vars })).code).toBe('DICE_LIMIT')
  })

  it.each(['2d6kh3', '2d6kl0'])('rejects %j with DICE_INVALID_KEEP', (formula) => {
    expect(catchDiceError(() => roll(formula)).code).toBe('DICE_INVALID_KEEP')
  })

  it.each([
    ['{x}+1', { x: NaN }],
    ['{x}+1', { x: 1.5 }],
    ['{x}+1', { x: Infinity }],
    ['{x}d6', { x: Infinity }],
    ['9007199254740991*9007199254740991', {}],
    ['max(9007199254740991*9007199254740991,1)', {}],
  ])('rejects non-safe-integer values in %j with DICE_LIMIT', (formula, vars) => {
    expect(catchDiceError(() => roll(formula, { vars })).code).toBe('DICE_LIMIT')
  })

  it('never returns a negative zero total', () => {
    expect(Object.is(roll('0*-1').total, 0)).toBe(true)
    expect(Object.is(roll('-0').total, 0)).toBe(true)
  })
})
