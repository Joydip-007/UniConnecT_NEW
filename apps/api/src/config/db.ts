import path from 'node:path'
import knex, { type Knex } from 'knex'
import { env } from './env'
import { logger } from '../utils/logger'

export const db = knex(createKnexConfig())

export function createKnexConfig(): Knex.Config {
  const isDevelopment = env.NODE_ENV === 'development'

  return {
    client: 'pg',
    connection: env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: path.join(__dirname, '../database/migrations'),
      extension: 'ts',
      tableName: 'knex_migrations',
    },
    log: isDevelopment
      ? {
          warn(message) {
            logger.warn('Knex warning', { message })
          },
          error(message) {
            logger.error('Knex error', { message })
          },
          deprecate(message) {
            logger.warn('Knex deprecation', { message })
          },
          debug(message) {
            logger.info('Knex debug', { message })
          },
        }
      : undefined,
  }
}
