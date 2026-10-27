import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'

const base = { DATABASE_URL: 'postgres://pbc:pw@localhost:5432/pbc' }

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(base)
    expect(config).toEqual({
      port: 3000,
      host: '127.0.0.1',
      databaseUrl: base.DATABASE_URL,
      logLevel: 'info',
      appVersion: '0.0.0-dev',
      webDistDir: undefined,
      migrationsDir: path.resolve('drizzle'),
    })
  })

  it('converts and maps provided values', () => {
    const config = loadConfig({
      ...base,
      PORT: '8080',
      HOST: '0.0.0.0',
      LOG_LEVEL: 'debug',
      APP_VERSION: '1.2.3',
      WEB_DIST_DIR: '/app/public',
      MIGRATIONS_DIR: '/app/drizzle',
    })
    expect(config.port).toBe(8080)
    expect(config.host).toBe('0.0.0.0')
    expect(config.logLevel).toBe('debug')
    expect(config.appVersion).toBe('1.2.3')
    expect(config.webDistDir).toBe('/app/public')
    expect(config.migrationsDir).toBe('/app/drizzle')
  })

  it('treats empty strings as missing', () => {
    expect(loadConfig({ ...base, PORT: '' }).port).toBe(3000)
  })

  it('throws when DATABASE_URL is missing', () => {
    expect(() => loadConfig({})).toThrow(/Invalid environment: .*DATABASE_URL/)
  })

  it('throws on an invalid port', () => {
    expect(() => loadConfig({ ...base, PORT: 'abc' })).toThrow(/PORT/)
  })

  it('throws on an unknown log level', () => {
    expect(() => loadConfig({ ...base, LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/)
  })
})
