import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { createDb, type DbHandle } from '../src/db/client'
import { runMigrations } from '../src/db/migrate'
import { settings } from '../src/db/schema'
import { buildApp } from '../src/app'
import { testConfig } from './helpers'

let container: StartedPostgreSqlContainer
let handle: DbHandle

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start()
  handle = createDb(container.getConnectionUri())
  await runMigrations(handle.db, path.resolve(import.meta.dirname, '../drizzle'))
}, 120_000)

afterAll(async () => {
  await handle?.close()
  await container?.stop()
})

describe('database', () => {
  it('creates the settings table', async () => {
    await handle.db.insert(settings).values({ key: 'game.name', value: 'Test Game' })
    const rows = await handle.db.select().from(settings)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key: 'game.name', value: 'Test Game' })
    expect(rows[0]?.updatedAt).toBeInstanceOf(Date)
  })

  it('is idempotent when migrations run twice', async () => {
    await expect(
      runMigrations(handle.db, path.resolve(import.meta.dirname, '../drizzle')),
    ).resolves.toBeUndefined()
  })

  it('ping returns true for a reachable database', async () => {
    expect(await handle.ping()).toBe(true)
  })

  it('ping returns false for an unreachable database', async () => {
    const unreachable = createDb('postgres://x:y@127.0.0.1:1/z')
    expect(await unreachable.ping()).toBe(false)
    await unreachable.close()
  })

  it('health endpoint reports the real database as ok', async () => {
    const app = await buildApp(testConfig(), { checkDb: handle.ping })
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok', db: 'ok' })
    await app.close()
  })
})
