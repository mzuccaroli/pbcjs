import path from 'node:path'
import { Type, type Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

const EnvSchema = Type.Object({
  PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 3000 }),
  HOST: Type.String({ default: '127.0.0.1' }),
  DATABASE_URL: Type.String({ minLength: 1 }),
  LOG_LEVEL: Type.Union(
    [
      Type.Literal('fatal'),
      Type.Literal('error'),
      Type.Literal('warn'),
      Type.Literal('info'),
      Type.Literal('debug'),
      Type.Literal('trace'),
      Type.Literal('silent'),
    ],
    { default: 'info' },
  ),
  APP_VERSION: Type.String({ default: '0.0.0-dev' }),
  WEB_DIST_DIR: Type.Optional(Type.String({ minLength: 1 })),
  MIGRATIONS_DIR: Type.String({ default: 'drizzle' }),
})

type Env = Static<typeof EnvSchema>

export type LogLevel = Env['LOG_LEVEL']

export interface AppConfig {
  port: number
  host: string
  databaseUrl: string
  logLevel: LogLevel
  appVersion: string
  webDistDir?: string
  migrationsDir: string
}

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const known: Record<string, string> = {}
  for (const key of Object.keys(EnvSchema.properties)) {
    const value = env[key]
    if (value !== undefined && value !== '') known[key] = value
  }

  const input = Value.Convert(EnvSchema, Value.Default(EnvSchema, known))
  if (!Value.Check(EnvSchema, input)) {
    const details = [...Value.Errors(EnvSchema, input)]
      .map((error) => `${error.path.slice(1) || '(root)'} ${error.message}`)
      .join('; ')
    throw new Error(`Invalid environment: ${details}`)
  }

  const parsed: Env = input
  return {
    port: parsed.PORT,
    host: parsed.HOST,
    databaseUrl: parsed.DATABASE_URL,
    logLevel: parsed.LOG_LEVEL,
    appVersion: parsed.APP_VERSION,
    webDistDir: parsed.WEB_DIST_DIR,
    migrationsDir: path.resolve(parsed.MIGRATIONS_DIR),
  }
}
