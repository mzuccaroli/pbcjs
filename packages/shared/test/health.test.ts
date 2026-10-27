import { describe, expect, it } from 'vitest'
import { Value } from '@sinclair/typebox/value'
import { HealthResponse } from '../src/index'

describe('HealthResponse', () => {
  it('accepts a healthy payload', () => {
    expect(Value.Check(HealthResponse, { status: 'ok', db: 'ok', version: '1.0.0' })).toBe(true)
  })

  it('accepts a degraded payload', () => {
    expect(Value.Check(HealthResponse, { status: 'degraded', db: 'down', version: '1.0.0' })).toBe(
      true,
    )
  })

  it('rejects unknown status values', () => {
    expect(Value.Check(HealthResponse, { status: 'broken', db: 'ok', version: '1.0.0' })).toBe(
      false,
    )
  })

  it('rejects a missing version', () => {
    expect(Value.Check(HealthResponse, { status: 'ok', db: 'ok' })).toBe(false)
  })
})
