import { loadConfig } from './config'
import { createDb } from './db/client'
import { runMigrations } from './db/migrate'
import { buildApp } from './app'

const config = loadConfig(process.env)
const handle = createDb(config.databaseUrl, (err) => console.error('postgres pool error', err))
await runMigrations(handle.db, config.migrationsDir)
const app = await buildApp(config, { checkDb: handle.ping })

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down')
  await app.close()
  await handle.close()
  process.exit(0)
}
process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))

await app.listen({ port: config.port, host: config.host })
