import { DiceError } from './errors'
import { parse, type DiceAst, type DiceNode, type DiceOperand } from './parser'
import { cryptoRng, type Rng } from './rng'

export const MAX_DICE_PER_ROLL = 100
export const MIN_SIDES = 2
export const MAX_SIDES = 1000

export interface DieRoll {
  /** Resolved dice term, e.g. "4d6kh3". */
  die: string
  /** Every die rolled, in order. */
  results: number[]
  /** Indexes into results of the dice that count toward the total. */
  kept: number[]
}

export interface RollResult {
  total: number
  formula: string
  resolved: string
  rolls: DieRoll[]
}

export interface EvaluateOptions {
  vars?: Record<string, number>
  rng?: Rng
}

interface Context {
  vars: Record<string, number>
  rng: Rng
  diceUsed: number
  rolls: DieRoll[]
}

type VarNode = Extract<DiceOperand, { type: 'var' }>
type DiceTerm = Extract<DiceNode, { type: 'dice' }>

export function evaluate(ast: DiceAst, opts: EvaluateOptions = {}): RollResult {
  const ctx: Context = {
    vars: opts.vars ?? {},
    rng: opts.rng ?? cryptoRng,
    diceUsed: 0,
    rolls: [],
  }
  const total = evalNode(ast.root, ctx)
  return { total, formula: ast.source, resolved: render(ast.root, ctx.vars), rolls: ctx.rolls }
}

export function roll(formula: string, opts: EvaluateOptions = {}): RollResult {
  return evaluate(parse(formula), opts)
}

function evalNode(node: DiceNode, ctx: Context): number {
  switch (node.type) {
    case 'num':
      return node.value
    case 'var':
      return lookup(node, ctx.vars)
    case 'group':
      return evalNode(node.expr, ctx)
    case 'neg':
      return 0 - evalNode(node.expr, ctx)
    case 'call':
      return Math[node.fn](...node.args.map((arg) => evalNode(arg, ctx)))
    case 'dice':
      return evalDice(node, ctx)
    case 'binary': {
      const left = evalNode(node.left, ctx)
      const right = evalNode(node.right, ctx)
      switch (node.op) {
        case '+':
          return left + right
        case '-':
          return left - right
        case '*':
          return left * right
        case '/':
          if (right === 0) throw new DiceError('DICE_DIVISION_BY_ZERO', 'Division by zero')
          return Math.floor(left / right)
      }
    }
  }
}

function evalDice(node: DiceTerm, ctx: Context): number {
  const count = operandValue(node.count, ctx.vars)
  const sides = operandValue(node.sides, ctx.vars)
  if (!Number.isInteger(count) || count < 1) {
    throw new DiceError('DICE_LIMIT', `Dice count must be an integer of at least 1, got ${count}`)
  }
  if (!Number.isInteger(sides) || sides < MIN_SIDES || sides > MAX_SIDES) {
    throw new DiceError(
      'DICE_LIMIT',
      `Dice sides must be an integer between ${MIN_SIDES} and ${MAX_SIDES}, got ${sides}`,
    )
  }
  if (node.keep && (node.keep.n < 1 || node.keep.n > count)) {
    throw new DiceError('DICE_INVALID_KEEP', `Cannot keep ${node.keep.n} of ${count} dice`)
  }
  if (ctx.diceUsed + count > MAX_DICE_PER_ROLL) {
    throw new DiceError('DICE_LIMIT', `At most ${MAX_DICE_PER_ROLL} dice per roll`)
  }
  ctx.diceUsed += count

  const results = Array.from({ length: count }, () => ctx.rng(1, sides))
  const kept = node.keep
    ? keepIndexes(results, node.keep.mode, node.keep.n)
    : results.map((_, i) => i)
  const keepSuffix = node.keep ? `${node.keep.mode}${node.keep.n}` : ''
  ctx.rolls.push({ die: `${count}d${sides}${keepSuffix}`, results, kept })
  return kept.reduce((sum, i) => sum + (results[i] as number), 0)
}

/** Indexes of the n highest (kh) or lowest (kl) results; ties keep the lower index. */
function keepIndexes(results: number[], mode: 'kh' | 'kl', n: number): number[] {
  return results
    .map((_, i) => i)
    .sort((a, b) => {
      const diff = (results[b] as number) - (results[a] as number)
      return (mode === 'kh' ? diff : -diff) || a - b
    })
    .slice(0, n)
    .sort((a, b) => a - b)
}

function operandValue(operand: DiceOperand, vars: Record<string, number>): number {
  return operand.type === 'num' ? operand.value : lookup(operand, vars)
}

function lookup(node: VarNode, vars: Record<string, number>): number {
  const value = vars[node.name]
  if (!Object.hasOwn(vars, node.name) || value === undefined) {
    throw new DiceError('DICE_UNKNOWN_VARIABLE', `Unknown variable "{${node.name}}"`, node.pos)
  }
  return value
}

function render(node: DiceNode, vars: Record<string, number>): string {
  switch (node.type) {
    case 'num':
      return String(node.value)
    case 'var':
      return String(lookup(node, vars))
    case 'group':
      return `(${render(node.expr, vars)})`
    case 'neg':
      return `-${render(node.expr, vars)}`
    case 'binary':
      return `${render(node.left, vars)}${node.op}${render(node.right, vars)}`
    case 'call':
      return `${node.fn}(${node.args.map((arg) => render(arg, vars)).join(',')})`
    case 'dice': {
      const keepSuffix = node.keep ? `${node.keep.mode}${node.keep.n}` : ''
      return `${render(node.count, vars)}d${render(node.sides, vars)}${keepSuffix}`
    }
  }
}
