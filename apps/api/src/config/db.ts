import fs from 'node:fs'
import path from 'node:path'
import knex, { type Knex } from 'knex'
import { env } from './env'
import { logger } from '../utils/logger'

export const db = knex(createKnexConfig())

type MigrationExtension = 'js' | 'ts'

interface MigrationFile {
  fullPath: string
  storedName: string
}

export function createKnexConfig(): Knex.Config {
  const isDevelopment = env.NODE_ENV === 'development'
  const sourceExtension: MigrationExtension = __filename.endsWith('.js') ? 'js' : 'ts'
  const migrationsDirectory = path.join(__dirname, '../database/migrations')

  return {
    client: 'pg',
    connection: env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: migrationsDirectory,
      extension: sourceExtension,
      migrationSource: createStableMigrationSource(migrationsDirectory, sourceExtension),
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

function createStableMigrationSource(
  directory: string,
  sourceExtension: MigrationExtension,
): Knex.MigrationSource<MigrationFile> {
  return {
    async getMigrations() {
      return fs
        .readdirSync(directory)
        .filter((fileName) => fileName.endsWith(`.${sourceExtension}`))
        .sort()
        .map((fileName) => ({
          fullPath: path.join(directory, fileName),
          storedName: sourceExtension === 'js' ? fileName.replace(/\.js$/, '.ts') : fileName,
        }))
    },
    getMigrationName(migration) {
      return migration.storedName
    },
    async getMigration(migration) {
      const mod = (await import(migration.fullPath)) as Knex.Migration & { default?: Knex.Migration }
      return mod.default ?? mod
    },
  }
}
