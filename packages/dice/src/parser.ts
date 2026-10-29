import { DiceError } from './errors'
import { tokenize, type Punct, type Token } from './lexer'

export type DiceOperand =
  { type: 'num'; value: number } | { type: 'var'; name: string; pos: number }

export type DiceNode =
  | DiceOperand
  | {
      type: 'dice'
      count: DiceOperand
      sides: DiceOperand
      keep?: { mode: 'kh' | 'kl'; n: number }
    }
  | { type: 'neg'; expr: DiceNode }
  | { type: 'binary'; op: '+' | '-' | '*' | '/'; left: DiceNode; right: DiceNode }
  | { type: 'call'; fn: 'min' | 'max'; args: DiceNode[] }
  | { type: 'group'; expr: DiceNode }

export interface DiceAst {
  source: string
  root: DiceNode
}

export function parse(formula: string): DiceAst {
  const parser = new Parser(tokenize(formula))
  const root = parser.expr()
  parser.expectEnd()
  return { source: formula, root }
}

class Parser {
  private index = 0

  constructor(private readonly tokens: Token[]) {}

  expr(): DiceNode {
    let left = this.term()
    for (;;) {
      const token = this.peek()
      if (token.kind !== 'punct' || (token.value !== '+' && token.value !== '-')) return left
      this.next()
      left = { type: 'binary', op: token.value, left, right: this.term() }
    }
  }

  expectEnd(): void {
    if (this.peek().kind !== 'eof') throw this.error('Unexpected token')
  }

  private term(): DiceNode {
    let left = this.unary()
    for (;;) {
      const token = this.peek()
      if (token.kind !== 'punct' || (token.value !== '*' && token.value !== '/')) return left
      this.next()
      left = { type: 'binary', op: token.value, left, right: this.unary() }
    }
  }

  private unary(): DiceNode {
    if (this.isPunct('-')) {
      this.next()
      return { type: 'neg', expr: this.unary() }
    }
    return this.primary()
  }

  private primary(): DiceNode {
    const token = this.peek()
    switch (token.kind) {
      case 'int': {
        this.next()
        const operand: DiceOperand = { type: 'num', value: token.value }
        return this.peek().kind === 'd' ? this.dice(operand) : operand
      }
      case 'var': {
        this.next()
        const operand: DiceOperand = { type: 'var', name: token.name, pos: token.pos }
        return this.peek().kind === 'd' ? this.dice(operand) : operand
      }
      case 'd':
        return this.dice({ type: 'num', value: 1 })
      case 'fn':
        return this.call(token.name)
      case 'punct':
        if (token.value === '(') {
          this.next()
          const expr = this.expr()
          this.expectPunct(')')
          return { type: 'group', expr }
        }
        break
    }
    throw this.error('Expected a number, dice, variable, function or "("')
  }

  private dice(count: DiceOperand): DiceNode {
    this.next() // consume "d"
    const sidesToken = this.peek()
    let sides: DiceOperand
    if (sidesToken.kind === 'int') {
      sides = { type: 'num', value: sidesToken.value }
    } else if (sidesToken.kind === 'var') {
      sides = { type: 'var', name: sidesToken.name, pos: sidesToken.pos }
    } else {
      throw this.error('Expected the number of sides')
    }
    this.next()

    const keepToken = this.peek()
    if (keepToken.kind !== 'keep') return { type: 'dice', count, sides }
    this.next()
    const nToken = this.peek()
    if (nToken.kind !== 'int') throw this.error(`Expected a number after "${keepToken.mode}"`)
    this.next()
    return { type: 'dice', count, sides, keep: { mode: keepToken.mode, n: nToken.value } }
  }

  private call(fn: 'min' | 'max'): DiceNode {
    this.next() // consume function name
    this.expectPunct('(')
    const args = [this.expr()]
    while (this.isPunct(',')) {
      this.next()
      args.push(this.expr())
    }
    if (args.length < 2) throw this.error(`${fn}() needs at least 2 arguments`)
    this.expectPunct(')')
    return { type: 'call', fn, args }
  }

  private peek(): Token {
    return this.tokens[this.index] as Token
  }

  private next(): void {
    if (this.peek().kind !== 'eof') this.index++
  }

  private isPunct(value: Punct): boolean {
    const token = this.peek()
    return token.kind === 'punct' && token.value === value
  }

  private expectPunct(value: Punct): void {
    if (!this.isPunct(value)) throw this.error(`Expected "${value}"`)
    this.next()
  }

  private error(message: string): DiceError {
    const token = this.peek()
    const found = token.kind === 'eof' ? 'end of formula' : describe(token)
    return new DiceError('DICE_SYNTAX', `${message}, found ${found}`, token.pos)
  }
}

function describe(token: Token): string {
  switch (token.kind) {
    case 'int':
      return `"${token.value}"`
    case 'var':
      return `"{${token.name}}"`
    case 'punct':
      return `"${token.value}"`
    case 'd':
      return '"d"'
    case 'keep':
      return `"${token.mode}"`
    case 'fn':
      return `"${token.name}"`
    case 'eof':
      return 'end of formula'
  }
}
