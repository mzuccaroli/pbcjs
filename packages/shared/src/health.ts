import { Type, type Static } from '@sinclair/typebox'

export const HealthResponse = Type.Object({
  status: Type.Union([Type.Literal('ok'), Type.Literal('degraded')]),
  db: Type.Union([Type.Literal('ok'), Type.Literal('down')]),
  version: Type.String(),
})

export type HealthResponse = Static<typeof HealthResponse>
