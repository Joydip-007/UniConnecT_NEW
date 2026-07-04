import type { Knex } from 'knex'

const PATHS = [
  {
    title: 'Interview prep 101',
    description: 'A one-week crash course on acing your first technical and behavioural interviews.',
    category: 'career', difficulty: 'beginner', estimated_days: 5,
    badge_name: 'Interview ready', badge_icon: '🎤',
    units: [
      { title: 'How interviews actually work', type: 'read', content: { body: 'Formats, what screeners look for, and how to prepare a one-page story sheet.' } },
      { title: 'Telling your story (STAR method)', type: 'read', content: { body: 'Structure behavioural answers: Situation, Task, Action, Result — with two worked examples.' } },
      { title: 'Practice: write your STAR answers', type: 'exercise', content: { body: 'Draft STAR answers for "a conflict you resolved" and "a project you led".' } },
      { title: 'Technical interview warm-up', type: 'read', content: { body: 'Thinking aloud, clarifying questions, and complexity trade-offs.' } },
      { title: 'Checkpoint quiz', type: 'quiz', content: { questions: [
        { q: 'What does the A in STAR stand for?', options: ['Answer', 'Action', 'Attitude', 'Analysis'], answer: 1 },
        { q: 'Best first move on an unclear problem?', options: ['Start coding', 'Ask clarifying questions', 'Guess', 'Skip it'], answer: 1 },
      ] }, completion_rule: { passScore: 70 } },
    ],
  },
  {
    title: 'Git basics',
    description: 'From init to your first merged pull request in five short days.',
    category: 'tools', difficulty: 'beginner', estimated_days: 5,
    badge_name: 'Git graduate', badge_icon: '🌿',
    units: [
      { title: 'Repositories, commits and the log', type: 'read', content: { body: 'git init, add, commit, log — what a commit really is.' } },
      { title: 'Branching without fear', type: 'read', content: { body: 'Branches as movable pointers; create, switch, delete.' } },
      { title: 'Practice: branch and commit', type: 'exercise', content: { body: 'Create a branch, make two commits, inspect with git log --graph.' } },
      { title: 'Merging and resolving conflicts', type: 'read', content: { body: 'Fast-forward vs merge commits; anatomy of a conflict marker.' } },
      { title: 'Checkpoint quiz', type: 'quiz', content: { questions: [
        { q: 'A branch is…', options: ['A copy of all files', 'A movable pointer to a commit', 'A remote server', 'A tag'], answer: 1 },
        { q: 'Which command shows commit history?', options: ['git status', 'git log', 'git show-all', 'git list'], answer: 1 },
      ] }, completion_rule: { passScore: 70 } },
    ],
  },
]

export async function up(knex: Knex) {
  for (const path of PATHS) {
    const { units, badge_name, badge_icon, ...pathRow } = path
    const [inserted] = await knex('skill_paths')
      .insert({ ...pathRow, badge_name, badge_icon, university_id: null })
      .returning('id')
    await knex('skill_path_units').insert(
      units.map((u, i) => ({
        path_id: inserted.id,
        display_order: i + 1,
        title: u.title,
        type: u.type,
        content: JSON.stringify(u.content),
        completion_rule: JSON.stringify('completion_rule' in u ? u.completion_rule : {}),
      })),
    )
    await knex('badges').insert({
      name: badge_name,
      description: `Completed the ${path.title} path`,
      icon_url: badge_icon,
      category: 'path',
      trigger_type: 'path_completed',
      trigger_count: 1,
      points: 25,
      skill_path_id: inserted.id,
    })
  }
}

export async function down(knex: Knex) {
  const titles = PATHS.map((p) => p.title)
  const ids = (await knex('skill_paths').whereIn('title', titles).whereNull('university_id').select('id')).map(
    (r: { id: string }) => r.id,
  )
  await knex('badges').whereIn('skill_path_id', ids).delete()
  await knex('skill_paths').whereIn('id', ids).delete() // units cascade
}
