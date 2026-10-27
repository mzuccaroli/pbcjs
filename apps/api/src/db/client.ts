import pg from 'pg'
import { sql } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

export type Db = NodePgDatabase<typeof schema>

export interface DbHandle {
  db: Db
  ping: () => Promise<boolean>
  close: () => Promise<void>
}

export function createDb(url: string, onError?: (err: Error) => void): DbHandle {
  const pool = new pg.Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5_000 })
  pool.on('error', (err) => onError?.(err))
  const db = drizzle(pool, { schema })

  return {
    db,
    ping: async () => {
      try {
        await db.execute(sql`select 1`)
        return true
      } catch {
        return false
      }
    },
    close: () => pool.end(),
  }
}
