import { createKnexConfig, db as appDb } from '../config/db'
import knex from 'knex'

const command = process.argv[2]
const db = knex(createKnexConfig())

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
  await Promise.allSettled([db.destroy(), appDb.destroy()])
}

run().catch((err) => {
  console.error(err)
  void Promise.allSettled([db.destroy(), appDb.destroy()]).finally(() => process.exit(1))
})
