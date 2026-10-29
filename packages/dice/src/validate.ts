import { DiceError } from './errors'
import { parse, type DiceAst, type DiceNode, type DiceOperand } from './parser'

export interface ValidateOptions {
  knownVars?: string[]
}

export interface ValidateResult {
  ok: boolean
  errors: DiceError[]
}

/** Checks syntax and, when knownVars is given, variable names. Never throws. */
export function validate(formula: string, opts: ValidateOptions = {}): ValidateResult {
  let ast: DiceAst
  try {
    ast = parse(formula)
  } catch (err) {
    if (err instanceof DiceError) return { ok: false, errors: [err] }
    throw err
  }

  const errors: DiceError[] = []
  if (opts.knownVars) {
    const known = new Set(opts.knownVars)
    for (const v of collectVars(ast.root)) {
      if (!known.has(v.name)) {
        errors.push(new DiceError('DICE_UNKNOWN_VARIABLE', `Unknown variable "{${v.name}}"`, v.pos))
      }
    }
  }
  return { ok: errors.length === 0, errors }
}

type VarNode = Extract<DiceOperand, { type: 'var' }>

function collectVars(node: DiceNode): VarNode[] {
  switch (node.type) {
    case 'num':
      return []
    case 'var':
      return [node]
    case 'group':
    case 'neg':
      return collectVars(node.expr)
    case 'binary':
      return [...collectVars(node.left), ...collectVars(node.right)]
    case 'call':
      return node.args.flatMap(collectVars)
    case 'dice':
      return [...collectVars(node.count), ...collectVars(node.sides)]
  }
}
