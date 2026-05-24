import { createKnexConfig } from '../config/db'
import knex from 'knex'

const command = process.argv[2]
// Use a minimal pool for the migration script — no need for the shared app pool
const db = knex({ ...createKnexConfig(), pool: { min: 1, max: 1 } })

async function run() {
  if (command === 'latest') {
    const [batch, migrations] = await db.migrate.latest()
    if (migrations.length === 0) {
      console.log('Already up to date.')
    } else {
      console.log(`Batch ${batch} run: ${migrations.length} migration(s)`)
      migrations.forEach((m: string) => console.log(' ↑', m))
    }
  } else if (command === 'rollback') {
    const [batch, migrations] = await db.migrate.rollback()
    if (migrations.length === 0) {
      console.log('Already at the base migration.')
    } else {
      console.log(`Batch ${batch} rolled back: ${migrations.length} migration(s)`)
      migrations.forEach((m: string) => console.log(' ↓', m))
    }
  } else if (command === 'rollback-all') {
    const [batch, migrations] = await db.migrate.rollback({}, true)
    console.log(`All batches rolled back: ${migrations.length} migration(s)`)
    migrations.forEach((m: string) => console.log(' ↓', m))
  } else {
    console.error(`Unknown command: ${command}. Use latest | rollback | rollback-all`)
    process.exit(1)
  }
  await db.destroy()
}

run().catch((err) => {
  console.error(err)
  void db.destroy().finally(() => process.exit(1))
})
