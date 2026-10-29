import { describe, expect, it } from 'vitest'
import { parse } from '../src/index'
import { catchDiceError } from './helpers'

describe('parse', () => {
  it('parses dice with keep plus a variable', () => {
    expect(parse('4d6kh3+{forza}')).toEqual({
      source: '4d6kh3+{forza}',
      root: {
        type: 'binary',
        op: '+',
        left: {
          type: 'dice',
          count: { type: 'num', value: 4 },
          sides: { type: 'num', value: 6 },
          keep: { mode: 'kh', n: 3 },
        },
        right: { type: 'var', name: 'forza', pos: 7 },
      },
    })
  })

  it('treats d20 as 1d20', () => {
    expect(parse('d20').root).toEqual({
      type: 'dice',
      count: { type: 'num', value: 1 },
      sides: { type: 'num', value: 20 },
    })
  })

  it('accepts variables as dice count and sides', () => {
    expect(parse('{forza}d{facce}').root).toEqual({
      type: 'dice',
      count: { type: 'var', name: 'forza', pos: 0 },
      sides: { type: 'var', name: 'facce', pos: 8 },
    })
  })

  it('gives * and / precedence over + and -', () => {
    expect(parse('1+2*3').root).toEqual({
      type: 'binary',
      op: '+',
      left: { type: 'num', value: 1 },
      right: {
        type: 'binary',
        op: '*',
        left: { type: 'num', value: 2 },
        right: { type: 'num', value: 3 },
      },
    })
  })

  it('is left associative', () => {
    expect(parse('8-2-1').root).toEqual({
      type: 'binary',
      op: '-',
      left: {
        type: 'binary',
        op: '-',
        left: { type: 'num', value: 8 },
        right: { type: 'num', value: 2 },
      },
      right: { type: 'num', value: 1 },
    })
  })

  it('keeps parentheses as group nodes', () => {
    expect(parse('(1+2)*3').root).toEqual({
      type: 'binary',
      op: '*',
      left: {
        type: 'group',
        expr: {
          type: 'binary',
          op: '+',
          left: { type: 'num', value: 1 },
          right: { type: 'num', value: 2 },
        },
      },
      right: { type: 'num', value: 3 },
    })
  })

  it('parses unary minus', () => {
    expect(parse('-2d6').root).toEqual({
      type: 'neg',
      expr: {
        type: 'dice',
        count: { type: 'num', value: 2 },
        sides: { type: 'num', value: 6 },
      },
    })
  })

  it('parses min and max with two or more arguments', () => {
    expect(parse('max(1,2,3)').root).toEqual({
      type: 'call',
      fn: 'max',
      args: [
        { type: 'num', value: 1 },
        { type: 'num', value: 2 },
        { type: 'num', value: 3 },
      ],
    })
  })

  it('is case insensitive for d, kh, kl, min and max', () => {
    expect(parse('2D20KL1').root).toEqual(parse('2d20kl1').root)
    expect(parse('MIN(1,2)').root).toEqual(parse('min(1,2)').root)
  })

  it('ignores whitespace', () => {
    expect(parse(' 4 d 6 kh 3 + 2 ').root).toEqual(parse('4d6kh3+2').root)
    expect(parse(' 4 d 6 kh 3 + {forza} ').root).toMatchObject({
      right: { type: 'var', name: 'forza', pos: 14 },
    })
  })

  it.each([
    ['', 0],
    ['2d', 2],
    ['2d6+', 4],
    ['2x6', 1],
    ['(1+2', 4],
    ['{Forza}', 1],
    ['{forza', 0],
    ['2d6kh', 5],
    ['min(1)', 5],
    ['1 2', 2],
    ['2d6d6', 3],
    ['2d6#', 3],
    ['99999999999999999999', 0],
    ['1'.repeat(201), 200],
  ])('rejects %j with DICE_SYNTAX at position %i', (formula, position) => {
    const err = catchDiceError(() => parse(formula))
    expect(err.code).toBe('DICE_SYNTAX')
    expect(err.position).toBe(position)
  })

  it('accepts a formula of exactly 200 characters', () => {
    const formula = `${'1+'.repeat(99)}11`
    expect(formula).toHaveLength(200)
    expect(() => parse(formula)).not.toThrow()
  })
})
