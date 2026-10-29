import { describe, expect, it } from 'vitest'
import { runCli } from '../src/cli'
import { sequenceRng } from './helpers'

function run(argv: string[], values: number[] = []) {
  const out: string[] = []
  const err: string[] = []
  const code = runCli(
    argv,
    { out: (l) => out.push(l), err: (l) => err.push(l) },
    sequenceRng(values),
  )
  return { code, out, err }
}

describe('runCli', () => {
  it('prints total, formula, resolved formula and dice detail', () => {
    const { code, out, err } = run(['4d6kh3+{forza}', '--var', 'forza=3'], [6, 4, 1, 1])
    expect(code).toBe(0)
    expect(err).toEqual([])
    expect(out).toEqual([
      'total: 14',
      'formula: 4d6kh3+{forza}',
      'resolved: 4d6kh3+3',
      '4d6kh3: [6, 4, 1, (1)]',
    ])
  })

  it('prints the RollResult as JSON with --json', () => {
    const { code, out } = run(['--json', '2d6'], [3, 5])
    expect(code).toBe(0)
    expect(JSON.parse(out.join('\n'))).toEqual({
      total: 8,
      formula: '2d6',
      resolved: '2d6',
      rolls: [{ die: '2d6', results: [3, 5], kept: [0, 1] }],
    })
  })

  it('accepts negative variable values', () => {
    const { code, out } = run(['1d4+{malus}', '--var', 'malus=-2'], [4])
    expect(code).toBe(0)
    expect(out[0]).toBe('total: 2')
  })

  it('exits 1 with code, message and caret for an invalid formula', () => {
    const { code, out, err } = run(['2d'])
    expect(code).toBe(1)
    expect(out).toEqual([])
    expect(err).toEqual([
      'DICE_SYNTAX: Expected the number of sides, found end of formula',
      '  2d',
      '    ^',
    ])
  })

  it('exits 1 without caret for errors that have no position', () => {
    const { code, err } = run(['1/0'])
    expect(code).toBe(1)
    expect(err).toEqual(['DICE_DIVISION_BY_ZERO: Division by zero'])
  })

  it.each([[[]], [['1d6', '2d6']], [['1d6', '--var']], [['1d6', '--var', 'forza=tre']]])(
    'exits 2 with usage for %j',
    (argv) => {
      const { code, err } = run(argv)
      expect(code).toBe(2)
      expect(err.at(-1)).toBe('Usage: roll "<formula>" [--var name=integer]... [--json]')
    },
  )
})
