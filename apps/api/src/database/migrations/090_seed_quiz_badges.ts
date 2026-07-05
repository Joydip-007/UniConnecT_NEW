import type { Knex } from 'knex'

export async function up(knex: Knex) {
  await knex('badges').insert([
    { name: 'First answer',  description: 'Scored 70%+ on a daily campus quiz',  icon_url: '🎯', category: 'social', trigger_type: 'quiz_win', trigger_count: 1,  points: 5  },
    { name: 'Quiz streak',   description: 'Won 5 daily campus quizzes',           icon_url: '🏆', category: 'social', trigger_type: 'quiz_win', trigger_count: 5,  points: 20 },
    { name: 'Quiz master',   description: 'Won 20 daily campus quizzes',          icon_url: '🧠', category: 'social', trigger_type: 'quiz_win', trigger_count: 20, points: 60 },
  ])
}

export async function down(knex: Knex) {
  await knex('badges').whereIn('name', ['First answer', 'Quiz streak', 'Quiz master']).delete()
}
