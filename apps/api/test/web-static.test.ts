import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app'
import { testConfig } from './helpers'

let dir: string
let app: FastifyInstance

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'pbc-web-'))
  await mkdir(path.join(dir, 'assets'))
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><div id="app"></div>')
  await writeFile(path.join(dir, 'assets', 'app.js'), 'console.log("app")')
  app = await buildApp(testConfig({ webDistDir: dir }), { checkDb: async () => true })
})

afterAll(async () => {
  await app.close()
  await rm(dir, { recursive: true, force: true })
})

describe('web static serving', () => {
  it('serves index.html at the root', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<div id="app"></div>')
  })

  it('serves static assets', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/app.js' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('javascript')
  })

  it('falls back to index.html for client-side routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/characters/42' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<div id="app"></div>')
  })

  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ code: 'NOT_FOUND', message: 'Route not found' })
  })

  it('returns a JSON 404 for non-GET unknown routes', async () => {
    const res = await app.inject({ method: 'POST', url: '/characters/42' })
    expect(res.statusCode).toBe(404)
  })

  it('keeps the API working', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
  })
})
