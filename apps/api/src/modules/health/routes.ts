import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { HealthResponse } from '@pbcjs/shared'

export interface HealthRoutesOptions {
  checkDb: () => Promise<boolean>
  version: string
}

export const healthRoutes: FastifyPluginAsyncTypebox<HealthRoutesOptions> = async (app, opts) => {
  app.get(
    '/health',
    { schema: { response: { 200: HealthResponse, 503: HealthResponse } } },
    async (_request, reply) => {
      const dbOk = await opts.checkDb().catch((err: unknown) => {
        app.log.warn({ err }, 'health: db check failed')
        return false
      })
      return reply.code(dbOk ? 200 : 503).send({
        status: dbOk ? 'ok' : 'degraded',
        db: dbOk ? 'ok' : 'down',
        version: opts.version,
      })
    },
  )
}
