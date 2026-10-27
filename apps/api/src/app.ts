import Fastify from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { AppConfig } from './config'
import { healthRoutes } from './modules/health/routes'

export interface AppDeps {
  checkDb: () => Promise<boolean>
}

export async function buildApp(config: AppConfig, deps: AppDeps) {
  const app = Fastify({
    logger: { level: config.logLevel },
  }).withTypeProvider<TypeBoxTypeProvider>()

  await app.register(healthRoutes, {
    prefix: '/api',
    checkDb: deps.checkDb,
    version: config.appVersion,
  })

  await app.ready()
  return app
}
