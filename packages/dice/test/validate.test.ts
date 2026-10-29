import { describe, expect, it } from 'vitest'
import { validate } from '../src/index'

describe('validate', () => {
  it('accepts a valid formula', () => {
    expect(validate('4d6kh3+{forza}')).toEqual({ ok: true, errors: [] })
  })

  it('reports syntax errors with position instead of throwing', () => {
    const result = validate('2d6+')
    expect(result.ok).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.code).toBe('DICE_SYNTAX')
    expect(result.errors[0]?.position).toBe(4)
  })

  it('reports every unknown variable when knownVars is given', () => {
    const result = validate('1d20+{forza}+{agilita}+{mira}', { knownVars: ['forza'] })
    expect(result.ok).toBe(false)
    expect(result.errors.map((e) => [e.code, e.position])).toEqual([
      ['DICE_UNKNOWN_VARIABLE', 13],
      ['DICE_UNKNOWN_VARIABLE', 23],
    ])
  })

  it('checks variables used as dice count and sides', () => {
    const result = validate('{pool}d{facce}', { knownVars: ['pool'] })
    expect(result.errors.map((e) => e.position)).toEqual([7])
  })

  it('does not check variables without knownVars', () => {
    expect(validate('{qualsiasi}+1').ok).toBe(true)
  })

  it('does not evaluate limits', () => {
    expect(validate('500d6').ok).toBe(true)
  })

  it.each(['}}}', '', 'kh', '((('])('never throws on %j', (formula) => {
    expect(validate(formula).ok).toBe(false)
  })
})
