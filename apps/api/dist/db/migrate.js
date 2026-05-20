"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../config/db");
const knex_1 = __importDefault(require("knex"));
const command = process.argv[2];
const db = (0, knex_1.default)((0, db_1.createKnexConfig)());
async function run() {
    if (command === 'latest') {
        const [batch, migrations] = await db.migrate.latest();
        if (migrations.length === 0) {
            console.log('Already up to date.');
        }
        else {
            console.log(`Batch ${batch} run: ${migrations.length} migration(s)`);
            migrations.forEach((m) => console.log(' ↑', m));
        }
    }
    else if (command === 'rollback') {
        const [batch, migrations] = await db.migrate.rollback();
        if (migrations.length === 0) {
            console.log('Already at the base migration.');
        }
        else {
            console.log(`Batch ${batch} rolled back: ${migrations.length} migration(s)`);
            migrations.forEach((m) => console.log(' ↓', m));
        }
    }
    else if (command === 'rollback-all') {
        const [batch, migrations] = await db.migrate.rollback({}, true);
        console.log(`All batches rolled back: ${migrations.length} migration(s)`);
        migrations.forEach((m) => console.log(' ↓', m));
    }
    else {
        console.error(`Unknown command: ${command}. Use latest | rollback | rollback-all`);
        process.exit(1);
    }
    await db.destroy();
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
