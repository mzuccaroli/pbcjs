import { DiceError } from './errors'

export const MAX_FORMULA_LENGTH = 200

export type Punct = '+' | '-' | '*' | '/' | '(' | ')' | ','

export type Token =
  | { kind: 'int'; value: number; pos: number }
  | { kind: 'var'; name: string; pos: number }
  | { kind: 'punct'; value: Punct; pos: number }
  | { kind: 'd'; pos: number }
  | { kind: 'keep'; mode: 'kh' | 'kl'; pos: number }
  | { kind: 'fn'; name: 'min' | 'max'; pos: number }
  | { kind: 'eof'; pos: number }

const PUNCT = '+-*/(),'
const VAR_NAME = /^[a-z][a-z0-9_]*$/
const DIGIT = /[0-9]/
const LETTER = /[a-z]/i
const SPACE = /\s/

export function tokenize(formula: string): Token[] {
  if (formula.length > MAX_FORMULA_LENGTH) {
    throw new DiceError(
      'DICE_SYNTAX',
      `Formula is longer than ${MAX_FORMULA_LENGTH} characters`,
      MAX_FORMULA_LENGTH,
    )
  }

  const tokens: Token[] = []
  let i = 0
  while (i < formula.length) {
    const ch = formula.charAt(i)

    if (SPACE.test(ch)) {
      i++
    } else if (PUNCT.includes(ch)) {
      tokens.push({ kind: 'punct', value: ch as Punct, pos: i })
      i++
    } else if (DIGIT.test(ch)) {
      const start = i
      while (i < formula.length && DIGIT.test(formula.charAt(i))) i++
      const value = Number(formula.slice(start, i))
      if (!Number.isSafeInteger(value)) {
        throw new DiceError('DICE_SYNTAX', 'Number is too large', start)
      }
      tokens.push({ kind: 'int', value, pos: start })
    } else if (ch === '{') {
      const end = formula.indexOf('}', i)
      if (end === -1) throw new DiceError('DICE_SYNTAX', 'Unclosed variable', i)
      const name = formula.slice(i + 1, end)
      if (!VAR_NAME.test(name)) {
        throw new DiceError('DICE_SYNTAX', `Invalid variable name "${name}"`, i + 1)
      }
      tokens.push({ kind: 'var', name, pos: i })
      i = end + 1
    } else if (LETTER.test(ch)) {
      const start = i
      while (i < formula.length && LETTER.test(formula.charAt(i))) i++
      tokens.push(wordToken(formula.slice(start, i).toLowerCase(), start))
    } else {
      throw new DiceError('DICE_SYNTAX', `Unexpected character "${ch}"`, i)
    }
  }
  tokens.push({ kind: 'eof', pos: formula.length })
  return tokens
}

function wordToken(word: string, pos: number): Token {
  switch (word) {
    case 'd':
      return { kind: 'd', pos }
    case 'kh':
    case 'kl':
      return { kind: 'keep', mode: word, pos }
    case 'min':
    case 'max':
      return { kind: 'fn', name: word, pos }
    default:
      throw new DiceError('DICE_SYNTAX', `Unknown word "${word}"`, pos)
  }
}
