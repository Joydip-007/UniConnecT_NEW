"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
const db_1 = require("../config/db");
const knex_1 = __importDefault(require("knex"));
const config = (0, db_1.createKnexConfig)();
const db = (0, knex_1.default)({
    ...config,
    seeds: {
        directory: node_path_1.default.join(__dirname, '../database/seeds'),
        extension: 'ts',
    },
});
async function run() {
    await db.seed.run();
    console.log('Seed complete.');
    await db.destroy();
}
run().catch((err) => {
    console.error(err);
    process.exit(1);
});
