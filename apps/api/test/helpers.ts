import type { AppConfig } from '../src/config'

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    host: '127.0.0.1',
    databaseUrl: 'postgres://unused:unused@127.0.0.1:1/unused',
    logLevel: 'silent',
    appVersion: '1.2.3',
    migrationsDir: 'drizzle',
    ...overrides,
  }
}
