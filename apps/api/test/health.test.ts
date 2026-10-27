import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import { testConfig } from './helpers'

let app: FastifyInstance | undefined

afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('GET /api/health', () => {
  it('returns 200 when the database is reachable', async () => {
    app = await buildApp(testConfig(), { checkDb: async () => true })
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok', db: 'ok', version: '1.2.3' })
  })

  it('returns 503 when the database is down', async () => {
    app = await buildApp(testConfig(), { checkDb: async () => false })
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ status: 'degraded', db: 'down', version: '1.2.3' })
  })

  it('returns 503 when the database check throws', async () => {
    app = await buildApp(testConfig(), {
      checkDb: async () => {
        throw new Error('boom')
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ status: 'degraded', db: 'down', version: '1.2.3' })
  })
})
