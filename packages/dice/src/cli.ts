import { pathToFileURL } from 'node:url'
import { DiceError } from './errors'
import { roll, type RollResult } from './evaluate'
import type { Rng } from './rng'

export interface CliIo {
  out(line: string): void
  err(line: string): void
}

const USAGE = 'Usage: roll "<formula>" [--var name=integer]... [--json]'
const VAR_ARG = /^([a-z][a-z0-9_]*)=(-?\d+)$/

export function runCli(argv: string[], io: CliIo, rng?: Rng): number {
  let formula: string | undefined
  let json = false
  const vars: Record<string, number> = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg === '--json') {
      json = true
    } else if (arg === '--var') {
      const spec = argv[++i] ?? ''
      const match = VAR_ARG.exec(spec)
      if (!match) return usageError(io, `Invalid --var "${spec}", expected name=integer`)
      vars[match[1] as string] = Number(match[2])
    } else if (formula === undefined) {
      formula = arg
    } else {
      return usageError(io, `Unexpected argument "${arg}"`)
    }
  }
  if (formula === undefined) return usageError(io, 'Missing formula')

  let result: RollResult
  try {
    result = roll(formula, { vars, rng })
  } catch (err) {
    if (!(err instanceof DiceError)) throw err
    io.err(`${err.code}: ${err.message}`)
    if (err.position !== undefined) {
      io.err(`  ${formula}`)
      io.err(`  ${' '.repeat(err.position)}^`)
    }
    return 1
  }

  if (json) {
    io.out(JSON.stringify(result, null, 2))
  } else {
    io.out(`total: ${result.total}`)
    io.out(`formula: ${result.formula}`)
    io.out(`resolved: ${result.resolved}`)
    for (const die of result.rolls) {
      const values = die.results.map((v, i) => (die.kept.includes(i) ? String(v) : `(${v})`))
      io.out(`${die.die}: [${values.join(', ')}]`)
    }
  }
  return 0
}

function usageError(io: CliIo, message: string): number {
  io.err(message)
  io.err(USAGE)
  return 2
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = runCli(process.argv.slice(2), {
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  })
}
