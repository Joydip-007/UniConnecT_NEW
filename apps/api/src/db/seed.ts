import path from 'node:path'
import { createKnexConfig } from '../config/db'
import knex from 'knex'

const config = createKnexConfig()
const sourceExtension = __filename.endsWith('.js') ? 'js' : 'ts'
const db = knex({
  ...config,
  seeds: {
    directory: path.join(__dirname, '../database/seeds'),
    extension: sourceExtension,
  },
})

async function run() {
  await db.seed.run()
  console.log('Seed complete.')
  await db.destroy()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
