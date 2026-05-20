"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const SEED = [
    {
        vendor: 'Google Play',
        title: 'Google Play $5',
        value_usd_cents: 500,
        threshold_points: 500,
        description: 'Redeem on Google Play for apps, games, books, and more.',
        image_url: null,
    },
    {
        vendor: 'Steam',
        title: 'Steam $5',
        value_usd_cents: 500,
        threshold_points: 500,
        description: 'Steam Wallet credit for games and in-game items.',
        image_url: null,
    },
    {
        vendor: 'Amazon',
        title: 'Amazon $5',
        value_usd_cents: 500,
        threshold_points: 500,
        description: 'Use on Amazon for anything in the catalog.',
        image_url: null,
    },
    {
        vendor: 'Udemy',
        title: 'Udemy $10',
        value_usd_cents: 1000,
        threshold_points: 1000,
        description: 'Apply toward any Udemy course.',
        image_url: null,
    },
    {
        vendor: 'Coursera',
        title: 'Coursera $10',
        value_usd_cents: 1000,
        threshold_points: 1000,
        description: 'Use on Coursera courses and specializations.',
        image_url: null,
    },
    {
        vendor: 'edX',
        title: 'edX $10',
        value_usd_cents: 1000,
        threshold_points: 1000,
        description: 'Use on edX courses and programs.',
        image_url: null,
    },
];
async function up(knex) {
    for (const row of SEED) {
        const exists = await knex('gift_cards').where({ title: row.title }).first();
        if (!exists)
            await knex('gift_cards').insert(row);
    }
}
async function down(knex) {
    await knex('gift_cards')
        .whereIn('title', SEED.map((s) => s.title))
        .delete();
}
