import 'dotenv/config'
import type { Knex } from 'knex'

const config: Knex.Config = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: {
    directory: 'src/database/migrations',
    extension: 'ts',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: 'src/database/seeds',
    extension: 'ts',
  },
}

export default config
