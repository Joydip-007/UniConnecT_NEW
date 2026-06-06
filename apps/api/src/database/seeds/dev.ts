import bcrypt from 'bcryptjs'
import type { Knex } from 'knex'
import { env } from '../../config/env'

// ─── Fixed IDs ───────────────────────────────────────────────────────────────
const UNI = '00000000-0000-4000-8000-000000000001'

// Users
const U_ADMIN  = '00000000-0000-4000-8000-000000000002'
const U_JOYDIP = '00000000-0000-4000-8000-000000000003'
const U_ALICE  = '00000000-0000-4000-8000-000000000010'
const U_BOB    = '00000000-0000-4000-8000-000000000011'
const U_CAROL  = '00000000-0000-4000-8000-000000000012'
const U_DAVE   = '00000000-0000-4000-8000-000000000013'
const U_EVE    = '00000000-0000-4000-8000-000000000014'
const U_FRANK  = '00000000-0000-4000-8000-000000000015'
const U_GRACE  = '00000000-0000-4000-8000-000000000016'
const U_HENRY  = '00000000-0000-4000-8000-000000000017'

// Posts
const P1    = '00000000-0000-4000-8000-000000000020'
const P2    = '00000000-0000-4000-8000-000000000021'
const P3    = '00000000-0000-4000-8000-000000000022'
const P4    = '00000000-0000-4000-8000-000000000023'
const P5    = '00000000-0000-4000-8000-000000000024'
const P_ANN1 = '00000000-0000-4000-8000-000000000025'
const P_ANN2 = '00000000-0000-4000-8000-000000000026'
const P_POLL = '00000000-0000-4000-8000-000000000027'

// Comments
const CMT1 = '00000000-0000-4000-8000-000000000110'
const CMT2 = '00000000-0000-4000-8000-000000000111'
const CMT3 = '00000000-0000-4000-8000-000000000112'
const CMT4 = '00000000-0000-4000-8000-000000000113'
const CMT5 = '00000000-0000-4000-8000-000000000114'

// Jobs
const J1 = '00000000-0000-4000-8000-000000000030'
const J2 = '00000000-0000-4000-8000-000000000031'
const J3 = '00000000-0000-4000-8000-000000000032'
const J4 = '00000000-0000-4000-8000-000000000033'
const J5 = '00000000-0000-4000-8000-000000000034'
const J6 = '00000000-0000-4000-8000-000000000035'
const J7 = '00000000-0000-4000-8000-000000000036'
const J8 = '00000000-0000-4000-8000-000000000037'

// Events
const E1 = '00000000-0000-4000-8000-000000000040'
const E2 = '00000000-0000-4000-8000-000000000041'
const E3 = '00000000-0000-4000-8000-000000000042'
const E4 = '00000000-0000-4000-8000-000000000043'
const E5 = '00000000-0000-4000-8000-000000000044'
const E6 = '00000000-0000-4000-8000-000000000045'
const E7 = '00000000-0000-4000-8000-000000000046'

// Groups
const G1 = '00000000-0000-4000-8000-000000000050'
const G2 = '00000000-0000-4000-8000-000000000051'
const G3 = '00000000-0000-4000-8000-000000000052'

// Conversations
const CONV1 = '00000000-0000-4000-8000-000000000060'
const CONV2 = '00000000-0000-4000-8000-000000000061'

// News
const NEWS1 = '00000000-0000-4000-8000-000000000070'
const NEWS2 = '00000000-0000-4000-8000-000000000071'
const NEWS3 = '00000000-0000-4000-8000-000000000072'
const NEWS4 = '00000000-0000-4000-8000-000000000073'

// Courses
const C1 = '00000000-0000-4000-8000-000000000080'
const C2 = '00000000-0000-4000-8000-000000000081'
const C3 = '00000000-0000-4000-8000-000000000082'

// Campus
const ROUTE1 = '00000000-0000-4000-8000-000000000090'
const LF1    = '00000000-0000-4000-8000-000000000100'
const LF2    = '00000000-0000-4000-8000-000000000101'

// Mentorship
const MR1 = '00000000-0000-4000-8000-000000000140'
const MR2 = '00000000-0000-4000-8000-000000000141'
const MR3 = '00000000-0000-4000-8000-000000000142'
const MR4 = '00000000-0000-4000-8000-000000000143'
const MR5 = '00000000-0000-4000-8000-000000000144'

// Polls
const POLL1  = '00000000-0000-4000-8000-000000000120'
const POPT1  = '00000000-0000-4000-8000-000000000121'
const POPT2  = '00000000-0000-4000-8000-000000000122'
const POPT3  = '00000000-0000-4000-8000-000000000123'
const POPT4  = '00000000-0000-4000-8000-000000000124'

// Tags
const TAG1 = '00000000-0000-4000-8000-000000000130'
const TAG2 = '00000000-0000-4000-8000-000000000131'
const TAG3 = '00000000-0000-4000-8000-000000000132'
const TAG4 = '00000000-0000-4000-8000-000000000133'

export async function seed(knex: Knex) {
  // ── 1. University ──────────────────────────────────────────────────────────
  const allowedDomains = knex.raw(
    "ARRAY['bscse.uiu.ac.bd','mscse.uiu.ac.bd','bsds.uiu.ac.bd','gmail.com']::text[]",
  )

  await knex('universities')
    .insert({
      id: UNI,
      name: 'United International University',
      domain: 'uiu.ac.bd',
      country: 'Bangladesh',
      plan: 'starter',
      allowed_email_domains: allowedDomains,
    })
    .onConflict('id')
    .merge({
      name: 'United International University',
      domain: 'uiu.ac.bd',
      country: 'Bangladesh',
      plan: 'starter',
      allowed_email_domains: allowedDomains,
    })

  // ── 2. Dev invitation ─────────────────────────────────────────────────────
  await knex('invitations')
    .insert({
      university_id: UNI,
      email: env.DEV_INVITE_EMAIL.toLowerCase(),
      role: env.DEV_INVITE_ROLE,
      token: env.DEV_INVITE_TOKEN,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })
    .onConflict('token')
    .merge({
      university_id: UNI,
      email: env.DEV_INVITE_EMAIL.toLowerCase(),
      role: env.DEV_INVITE_ROLE,
      is_used: false,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })

  // ── 3. Users ───────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('password123', 10)

  const userRows = [
    { id: U_ADMIN,  email: 'admin@uiu.ac.bd',                 role: 'admin'   },
    { id: U_JOYDIP, email: 'joydip.datta15@gmail.com',        role: 'admin'   },
    { id: U_ALICE,  email: 'alice.rahman@bscse.uiu.ac.bd',    role: 'student' },
    { id: U_BOB,    email: 'bob.hossain@bscse.uiu.ac.bd',     role: 'student' },
    { id: U_CAROL,  email: 'carol.ahmed@gmail.com',           role: 'alumni'  },
    { id: U_DAVE,   email: 'dave.chowdhury@gmail.com',        role: 'alumni'  },
    { id: U_EVE,    email: 'eve.islam@bscse.uiu.ac.bd',       role: 'faculty' },
    { id: U_FRANK,  email: 'frank.khan@bscse.uiu.ac.bd',      role: 'student' },
    { id: U_GRACE,  email: 'grace.begum@bscse.uiu.ac.bd',     role: 'student' },
    { id: U_HENRY,  email: 'henry.mia@gmail.com',             role: 'alumni'  },
  ]

  for (const u of userRows) {
    const username = u.email
      .split('@')[0]!
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, '')
      .replace(/[._]{2,}/g, '.')
      .replace(/^[._]+|[._]+$/g, '')
      .slice(0, 30)
    await knex('users')
      .insert({
        id: u.id,
        university_id: UNI,
        username,
        email: u.email,
        password_hash: hash,
        role: u.role,
        is_verified: true,
        is_active: true,
      })
      .onConflict('email')
      .merge({ password_hash: hash, role: u.role, is_verified: true, is_active: true })
  }

  // Re-fetch real IDs (email conflict merge keeps the original UUID)
  const fetchId = async (email: string, fallback: string) => {
    const row = await knex('users').where({ email }).select('id').first<{ id: string }>()
    return row?.id ?? fallback
  }

  const adminId  = await fetchId('admin@uiu.ac.bd',              U_ADMIN)
  const joydipId = await fetchId('joydip.datta15@gmail.com',     U_JOYDIP)
  const aliceId  = await fetchId('alice.rahman@bscse.uiu.ac.bd', U_ALICE)
  const bobId    = await fetchId('bob.hossain@bscse.uiu.ac.bd',  U_BOB)
  const carolId  = await fetchId('carol.ahmed@gmail.com',        U_CAROL)
  const daveId   = await fetchId('dave.chowdhury@gmail.com',     U_DAVE)
  const eveId    = await fetchId('eve.islam@bscse.uiu.ac.bd',    U_EVE)
  const frankId  = await fetchId('frank.khan@bscse.uiu.ac.bd',   U_FRANK)
  const graceId  = await fetchId('grace.begum@bscse.uiu.ac.bd',  U_GRACE)
  const henryId  = await fetchId('henry.mia@gmail.com',          U_HENRY)

  // ── 4. Profiles ───────────────────────────────────────────────────────────
  const profiles = [
    {
      user_id: adminId,
      full_name: 'Dev Admin',
      bio: 'Platform administrator for UniConnecT.',
      department: 'Administration',
      headline: 'Platform Administrator',
    },
    {
      user_id: joydipId,
      full_name: 'Joydip Datta',
      bio: 'Co-founder and lead developer of UniConnecT. Passionate about building tools that connect university communities.',
      department: 'Computer Science & Engineering',
      batch_year: '2023',
      headline: 'Software Engineer | UniConnecT Co-founder',
      skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'System Design'],
      is_open_to_work: false,
    },
    {
      user_id: aliceId,
      full_name: 'Alice Rahman',
      bio: 'Third-year CSE student at UIU, passionate about AI and machine learning. Currently exploring generative models.',
      department: 'Computer Science & Engineering',
      batch_year: '2025',
      headline: 'CS Student | AI & ML Enthusiast',
      skills: ['Python', 'Machine Learning', 'TensorFlow', 'Data Analysis', 'SQL'],
      is_open_to_work: true,
    },
    {
      user_id: bobId,
      full_name: 'Bob Hossain',
      bio: 'Final-year CS student and full-stack developer. Built and shipped three side projects in the last year.',
      department: 'Computer Science & Engineering',
      batch_year: '2024',
      headline: 'Full-Stack Developer | UIU Final Year',
      skills: ['React', 'Node.js', 'PostgreSQL', 'Docker', 'AWS'],
      is_open_to_work: true,
    },
    {
      user_id: carolId,
      full_name: 'Carol Ahmed',
      bio: 'UIU CSE alumna (2020), now Senior Software Engineer at BJIT. Love mentoring the next generation of engineers.',
      department: 'Computer Science & Engineering',
      batch_year: '2020',
      headline: 'Senior Software Engineer @ BJIT',
      skills: ['Java', 'Spring Boot', 'AWS', 'Microservices', 'System Design'],
      linkedin_url: 'https://linkedin.com/in/carol-ahmed-bjit',
      is_open_to_work: false,
    },
    {
      user_id: daveId,
      full_name: 'Dave Chowdhury',
      bio: 'Product Manager at Pathao. UIU CSE graduate (2019). Bridging the gap between engineering and business.',
      department: 'Computer Science & Engineering',
      batch_year: '2019',
      headline: 'Product Manager @ Pathao',
      skills: ['Product Management', 'Agile', 'SQL', 'UX Research', 'Analytics'],
      linkedin_url: 'https://linkedin.com/in/dave-chowdhury-pathao',
      is_open_to_work: false,
    },
    {
      user_id: eveId,
      full_name: 'Dr. Eve Islam',
      bio: 'Assistant Professor of CS at UIU. PhD from IIT Delhi. Research focus: NLP for low-resource Bangla text.',
      department: 'Computer Science & Engineering',
      headline: 'Assistant Professor @ UIU | NLP Researcher',
      skills: ['Natural Language Processing', 'Python', 'Research', 'Deep Learning', 'Teaching'],
      is_open_to_work: false,
    },
    {
      user_id: frankId,
      full_name: 'Frank Khan',
      bio: 'Competitive programmer and second-year CSE student. ICPC Asia Dhaka Regional participant.',
      department: 'Computer Science & Engineering',
      batch_year: '2026',
      headline: 'Competitive Programmer | UIU ACM Chapter',
      skills: ['C++', 'Algorithms', 'Data Structures', 'Problem Solving'],
      is_open_to_work: false,
    },
    {
      user_id: graceId,
      full_name: 'Grace Begum',
      bio: 'UX designer and frontend developer. Passionate about accessible, inclusive design.',
      department: 'Computer Science & Engineering',
      batch_year: '2025',
      headline: 'UX Designer & Frontend Developer',
      skills: ['Figma', 'React', 'CSS', 'User Research', 'Accessibility'],
      is_open_to_work: true,
    },
    {
      user_id: henryId,
      full_name: 'Henry Mia',
      bio: 'DevOps Engineer at Brain Station 23. UIU CSE 2021. Infrastructure as code enthusiast.',
      department: 'Computer Science & Engineering',
      batch_year: '2021',
      headline: 'DevOps Engineer @ Brain Station 23',
      skills: ['Kubernetes', 'Docker', 'CI/CD', 'Terraform', 'AWS', 'Linux'],
      is_open_to_work: false,
    },
  ]

  for (const p of profiles) {
    const { skills, ...base } = p as any
    const row: Record<string, unknown> = { ...base, updated_at: knex.fn.now() }
    if (skills) row.skills = skills
    await knex('profiles').insert({ ...base, ...(skills ? { skills } : {}) }).onConflict('user_id').merge(row)
  }

  // ── 5. Connections (replaces follows) ────────────────────────────────────
  const connectionPairs = [
    [aliceId,  carolId ],
    [aliceId,  eveId   ],
    [aliceId,  joydipId],
    [bobId,    carolId ],
    [bobId,    henryId ],
    [bobId,    joydipId],
    [frankId,  aliceId ],
    [frankId,  bobId   ],
    [frankId,  eveId   ],
    [graceId,  eveId   ],
    [graceId,  aliceId ],
    [graceId,  bobId   ],
    [carolId,  eveId   ],
    [carolId,  joydipId],
    [henryId,  daveId  ],
    [henryId,  carolId ],
    [daveId,   carolId ],
    [joydipId, aliceId ],
    [joydipId, eveId   ],
    [joydipId, bobId   ],
    [eveId,    joydipId],
  ]

  for (const [requester_id, addressee_id] of connectionPairs) {
    await knex('connections')
      .insert({ university_id: UNI, requester_id, addressee_id, status: 'accepted', note: null })
      .onConflict(['requester_id', 'addressee_id'])
      .ignore()
  }

  // ── 6. Tags ───────────────────────────────────────────────────────────────
  const tagRows = [
    { id: TAG1, university_id: UNI, name: 'AI' },
    { id: TAG2, university_id: UNI, name: 'career' },
    { id: TAG3, university_id: UNI, name: 'devops' },
    { id: TAG4, university_id: UNI, name: 'competitive-programming' },
  ]

  for (const tag of tagRows) {
    await knex('tags').insert(tag).onConflict(['university_id', 'name']).ignore()
  }

  const fetchTagId = async (name: string, fallback: string) => {
    const row = await knex('tags').where({ university_id: UNI, name }).select('id').first<{ id: string }>()
    return row?.id ?? fallback
  }

  const tagAI    = await fetchTagId('AI', TAG1)
  const tagCareer = await fetchTagId('career', TAG2)
  const tagDevops = await fetchTagId('devops', TAG3)
  const tagCP     = await fetchTagId('competitive-programming', TAG4)

  // ── 7. Posts ──────────────────────────────────────────────────────────────
  const DAY = 24 * 60 * 60 * 1000

  const posts = [
    {
      id: P_ANN1,
      university_id: UNI,
      author_id: adminId,
      type: 'announcement',
      content:
        'Important: Mid-semester examinations are scheduled from June 1–8, 2026. Students are advised to verify their exam schedule on the UIU academic portal. Make-up requests must be submitted at least 48 hours before the exam.',
      is_pinned: true,
      created_at: new Date(Date.now() - 8 * DAY),
    },
    {
      id: P_ANN2,
      university_id: UNI,
      author_id: eveId,
      type: 'announcement',
      content:
        'The UIU ACM Student Chapter is now accepting members for the 2026 session. Join us for weekly coding contests, workshops, and industry networking. Registration link is pinned in the ACM group.',
      is_pinned: false,
      created_at: new Date(Date.now() - 7 * DAY),
    },
    {
      id: P1,
      university_id: UNI,
      author_id: aliceId,
      type: 'post',
      content:
        'Just wrapped up my semester project on generative AI for image synthesis using GANs. Super proud of what our team achieved — we managed to train a conditional GAN on a custom dataset with surprisingly good FID scores. Looking forward to presenting at the UIU Research Symposium next month!',
      created_at: new Date(Date.now() - 5 * DAY),
    },
    {
      id: P2,
      university_id: UNI,
      author_id: carolId,
      type: 'post',
      content:
        'Excited to share: BJIT is opening internship applications for Summer 2026! We are looking for passionate CSE students who want to work on real enterprise projects alongside senior engineers. DM me for a referral or check the Jobs board for the full listing.',
      created_at: new Date(Date.now() - 4 * DAY),
    },
    {
      id: P3,
      university_id: UNI,
      author_id: eveId,
      type: 'post',
      content:
        'Research tip: When doing a literature review, don\'t just skim abstracts — read methodology sections carefully. That is where you find the real assumptions, limitations, and research gaps. Sharing my annotated reading list for NLP in low-resource languages this semester for anyone interested.',
      created_at: new Date(Date.now() - 3 * DAY),
    },
    {
      id: P4,
      university_id: UNI,
      author_id: bobId,
      type: 'post',
      content:
        'After three months of weekend grinding, finally shipped my full-stack job portal. Stack: React + Node.js + PostgreSQL + Redis, deployed on AWS EC2 with a GitHub Actions CI pipeline. The toughest part was query optimisation — brought a 900ms endpoint down to 38ms with proper composite indexes. Happy to write a post on it if anyone\'s interested.',
      created_at: new Date(Date.now() - 2 * DAY),
    },
    {
      id: P5,
      university_id: UNI,
      author_id: henryId,
      type: 'post',
      content:
        'Advice for CS freshmen: learn git properly from day one. Not just `git add .` and `git commit` — understand branching strategies, interactive rebase, and how to write commit messages that actually communicate intent. Your future collaborators and your future self will thank you.',
      created_at: new Date(Date.now() - 1 * DAY),
    },
    {
      id: P_POLL,
      university_id: UNI,
      author_id: graceId,
      type: 'post',
      content: 'Quick poll for the frontend folks — which framework do you reach for first on a new project?',
      created_at: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
  ]

  for (const post of posts) {
    await knex('posts').insert(post).onConflict('id').merge({ content: post.content, is_pinned: (post as any).is_pinned ?? false })
  }

  // Post tags
  const postTags = [
    { post_id: P1, tag_id: tagAI },
    { post_id: P3, tag_id: tagAI },
    { post_id: P2, tag_id: tagCareer },
    { post_id: P5, tag_id: tagDevops },
    { post_id: P4, tag_id: tagDevops },
  ]

  for (const pt of postTags) {
    await knex('post_tags').insert(pt).onConflict(['post_id', 'tag_id']).ignore()
  }

  // ── 8. Comments ───────────────────────────────────────────────────────────
  const comments = [
    {
      id: CMT1,
      post_id: P1,
      author_id: eveId,
      content: 'Impressive work, Alice! Conditional GANs are tricky to stabilise. Would love to hear more about how you handled mode collapse. See you at the symposium!',
      created_at: new Date(Date.now() - 4.9 * DAY),
    },
    {
      id: CMT2,
      post_id: P1,
      author_id: bobId,
      content: 'Which architecture did you go with — standard DCGAN or something like StyleGAN2? Curious about your discriminator setup.',
      created_at: new Date(Date.now() - 4.8 * DAY),
    },
    {
      id: CMT3,
      post_id: P4,
      author_id: carolId,
      content: 'Great optimisation results! Have you considered layering Redis caching on top of those indexed queries? You could push read latency even lower on hot endpoints.',
      created_at: new Date(Date.now() - 1.9 * DAY),
    },
    {
      id: CMT4,
      post_id: P2,
      author_id: aliceId,
      content: 'So excited about this! Sending you a DM now, Carol. Is the programme open to third-year students?',
      created_at: new Date(Date.now() - 3.9 * DAY),
    },
    {
      id: CMT5,
      post_id: P5,
      author_id: frankId,
      content: 'Learned this the hard way last semester — spent two days untangling a merge conflict mess that proper branching would have prevented entirely.',
      created_at: new Date(Date.now() - 20 * 60 * 60 * 1000),
    },
  ]

  for (const c of comments) {
    await knex('comments').insert(c).onConflict('id').merge({ content: c.content })
  }

  // ── 9. Reactions ──────────────────────────────────────────────────────────
  const reactions = [
    { user_id: carolId, target_id: P1,    target_type: 'post',    reaction_type: 'love'       },
    { user_id: eveId,   target_id: P1,    target_type: 'post',    reaction_type: 'insightful' },
    { user_id: bobId,   target_id: P1,    target_type: 'post',    reaction_type: 'celebrate'  },
    { user_id: frankId, target_id: P1,    target_type: 'post',    reaction_type: 'like'       },
    { user_id: joydipId,target_id: P1,    target_type: 'post',    reaction_type: 'celebrate'  },
    { user_id: aliceId, target_id: P2,    target_type: 'post',    reaction_type: 'celebrate'  },
    { user_id: bobId,   target_id: P2,    target_type: 'post',    reaction_type: 'like'       },
    { user_id: graceId, target_id: P2,    target_type: 'post',    reaction_type: 'like'       },
    { user_id: aliceId, target_id: P3,    target_type: 'post',    reaction_type: 'insightful' },
    { user_id: graceId, target_id: P3,    target_type: 'post',    reaction_type: 'insightful' },
    { user_id: bobId,   target_id: P3,    target_type: 'post',    reaction_type: 'insightful' },
    { user_id: carolId, target_id: P4,    target_type: 'post',    reaction_type: 'celebrate'  },
    { user_id: henryId, target_id: P4,    target_type: 'post',    reaction_type: 'insightful' },
    { user_id: aliceId, target_id: P4,    target_type: 'post',    reaction_type: 'like'       },
    { user_id: aliceId, target_id: P5,    target_type: 'post',    reaction_type: 'like'       },
    { user_id: bobId,   target_id: P5,    target_type: 'post',    reaction_type: 'love'       },
    { user_id: frankId, target_id: P5,    target_type: 'post',    reaction_type: 'like'       },
    { user_id: graceId, target_id: P_ANN1,target_type: 'post',    reaction_type: 'like'       },
    { user_id: bobId,   target_id: CMT1,  target_type: 'comment', reaction_type: 'like'       },
    { user_id: aliceId, target_id: CMT3,  target_type: 'comment', reaction_type: 'insightful' },
    { user_id: bobId,   target_id: CMT3,  target_type: 'comment', reaction_type: 'like'       },
  ]

  for (const r of reactions) {
    await knex('reactions').insert(r).onConflict(['user_id', 'target_id', 'target_type']).ignore()
  }

  // ── 10. Poll ──────────────────────────────────────────────────────────────
  await knex('polls')
    .insert({
      id: POLL1,
      post_id: P_POLL,
      question: 'Which frontend framework do you prefer?',
      expires_at: new Date(Date.now() + 7 * DAY),
    })
    .onConflict('id').ignore()

  const pollOptions = [
    { id: POPT1, poll_id: POLL1, option_text: 'React',   display_order: 0 },
    { id: POPT2, poll_id: POLL1, option_text: 'Vue.js',  display_order: 1 },
    { id: POPT3, poll_id: POLL1, option_text: 'Angular', display_order: 2 },
    { id: POPT4, poll_id: POLL1, option_text: 'Svelte',  display_order: 3 },
  ]

  for (const opt of pollOptions) {
    await knex('poll_options').insert(opt).onConflict('id').ignore()
  }

  const pollVotes = [
    { poll_option_id: POPT1, user_id: bobId    },
    { poll_option_id: POPT1, user_id: henryId  },
    { poll_option_id: POPT1, user_id: carolId  },
    { poll_option_id: POPT2, user_id: frankId  },
    { poll_option_id: POPT3, user_id: daveId   },
    { poll_option_id: POPT4, user_id: joydipId },
  ]

  for (const v of pollVotes) {
    await knex('poll_votes').insert(v).onConflict(['poll_option_id', 'user_id']).ignore()
  }

  // ── 11. Saved posts ───────────────────────────────────────────────────────
  const savedPosts = [
    { user_id: aliceId,  post_id: P2 },
    { user_id: aliceId,  post_id: P3 },
    { user_id: bobId,    post_id: P1 },
    { user_id: bobId,    post_id: P5 },
    { user_id: frankId,  post_id: P3 },
    { user_id: frankId,  post_id: P5 },
    { user_id: graceId,  post_id: P1 },
    { user_id: joydipId, post_id: P_ANN1 },
  ]

  for (const sp of savedPosts) {
    await knex('saved_posts').insert(sp).onConflict(['user_id', 'post_id']).ignore()
  }

  // ── 12. Jobs ──────────────────────────────────────────────────────────────
  const jobs = [
    {
      id: J1,
      university_id: UNI,
      posted_by: carolId,
      title: 'Software Engineering Intern — Summer 2026',
      company: 'BJIT Limited',
      location: 'Dhaka, Bangladesh',
      type: 'internship',
      description:
        'Join the BJIT engineering team for a 3-month paid internship. You will work on real enterprise projects, mentored by senior engineers with hands-on Java Spring Boot microservices and AWS cloud deployment. Potential for a full-time return offer.',
      requirements: [
        'Proficiency in Java or Python',
        'Basic understanding of REST APIs',
        'Familiarity with Git',
        'Strong problem-solving ability',
        '3rd or 4th year CSE student',
      ],
      salary_range: 'BDT 15,000–20,000 / month',
      deadline: new Date(Date.now() + 30 * DAY),
      is_active: true,
    },
    {
      id: J2,
      university_id: UNI,
      posted_by: henryId,
      title: 'Junior DevOps Engineer',
      company: 'Brain Station 23',
      location: 'Dhaka, Bangladesh',
      type: 'full_time',
      description:
        'Brain Station 23 is hiring a junior DevOps engineer to join our infrastructure team. Responsibilities include maintaining CI/CD pipelines, managing Kubernetes clusters, and assisting with cloud infrastructure provisioning using Terraform. Great entry point for fresh graduates passionate about infrastructure.',
      requirements: [
        'Linux fundamentals',
        'Docker and basic containerisation knowledge',
        'Understanding of CI/CD pipelines',
        'Any cloud provider experience (AWS / GCP / Azure)',
        'Scripting skills in Bash or Python',
      ],
      salary_range: 'BDT 35,000–50,000 / month',
      deadline: new Date(Date.now() + 45 * DAY),
      is_active: true,
    },
    {
      id: J3,
      university_id: UNI,
      posted_by: daveId,
      title: 'Product Analyst (Part-time, Remote)',
      company: 'Pathao',
      location: 'Dhaka, Bangladesh',
      type: 'part_time',
      description:
        'Pathao is looking for a part-time product analyst to support data-driven product decisions. You will analyse user behaviour funnels, assist with A/B test design, and surface actionable insights for the product team. Flexible hours — ideal for students.',
      requirements: [
        'SQL proficiency (aggregate queries, joins)',
        'Excel / Google Sheets expertise',
        'Basic statistics and experimentation knowledge',
        'Clear written communication',
        'Analytical, detail-oriented mindset',
      ],
      salary_range: 'BDT 12,000–18,000 / month',
      deadline: new Date(Date.now() + 20 * DAY),
      is_active: true,
    },
    {
      id: J4,
      university_id: UNI,
      posted_by: eveId,
      title: 'Undergraduate Research Assistant — NLP Lab',
      company: 'United International University',
      location: 'Satarkul, Dhaka',
      type: 'part_time',
      description:
        'The UIU NLP Research Lab is seeking motivated undergraduate students to assist with ongoing research in Bangla language processing. Responsibilities include data annotation, preprocessing pipelines, model evaluation, and co-authoring research papers. This is a paid semester-long appointment with the possibility of renewal. Priority is given to students with prior ML coursework.',
      requirements: [
        'Python proficiency (numpy, pandas, scikit-learn)',
        'Completed CSE4820 Machine Learning or equivalent',
        'Interest in NLP and computational linguistics',
        'Ability to commit 10–15 hours per week',
        'Strong academic record (CGPA ≥ 3.20)',
      ],
      salary_range: 'BDT 8,000–10,000 / month',
      deadline: new Date(Date.now() + 18 * DAY),
      is_active: true,
    },
    {
      id: J5,
      university_id: UNI,
      posted_by: carolId,
      title: 'Frontend Developer Intern',
      company: 'Shohoz',
      location: 'Dhaka, Bangladesh',
      type: 'internship',
      description:
        'Shohoz is looking for a creative frontend intern to join our growth team. You will work directly with designers and backend engineers to build and improve our consumer-facing web surfaces — including the booking flow, ride-tracking UI, and promotional pages. Pair programming with senior engineers, real code in production from week one.',
      requirements: [
        'React.js with hooks and modern patterns',
        'CSS — responsive layout, animations',
        'REST API integration experience',
        'Figma or similar design-tool literacy',
        'Basic understanding of web performance',
      ],
      salary_range: 'BDT 12,000–16,000 / month',
      deadline: new Date(Date.now() + 25 * DAY),
      is_active: true,
    },
    {
      id: J6,
      university_id: UNI,
      posted_by: henryId,
      title: 'Backend Engineer',
      company: 'Kona Software Lab',
      location: 'Dhaka, Bangladesh',
      type: 'full_time',
      description:
        'Kona Software Lab is hiring a backend engineer to join the fintech product team. You will design and build APIs for our mobile financial services platform serving millions of users. Core stack: Node.js, PostgreSQL, Redis, AWS. Experience with high-throughput systems and payment integrations is a strong plus. Remote-friendly with a Dhaka hub.',
      requirements: [
        'Strong Node.js or Java backend experience',
        'PostgreSQL schema design and query optimisation',
        'Redis caching and pub/sub patterns',
        'REST and GraphQL API design',
        'Understanding of financial domain (payments, wallets) is a plus',
      ],
      salary_range: 'BDT 60,000–90,000 / month',
      deadline: new Date(Date.now() + 35 * DAY),
      is_active: true,
    },
    {
      id: J7,
      university_id: UNI,
      posted_by: daveId,
      title: 'Data Analyst Intern',
      company: 'ShopUp',
      location: 'Dhaka, Bangladesh',
      type: 'internship',
      description:
        'ShopUp is the largest B2B commerce platform in Bangladesh and South Asia. We are looking for a data analyst intern to join the Growth Analytics team. You will query production data, build dashboards, analyse cohort behaviour, and present findings to product managers. Expect real ownership and a fast feedback loop.',
      requirements: [
        'SQL — comfortable with window functions and CTEs',
        'Basic Python for data analysis (pandas)',
        'Google Looker Studio or Tableau is a plus',
        'Ability to communicate insights to non-technical stakeholders',
        '2nd year or above CSE/DS student',
      ],
      salary_range: 'BDT 10,000–14,000 / month',
      deadline: new Date(Date.now() + 22 * DAY),
      is_active: true,
    },
    {
      id: J8,
      university_id: UNI,
      posted_by: carolId,
      title: 'Cloud Infrastructure Intern (Remote)',
      company: 'BJIT Limited',
      location: 'Remote',
      type: 'remote',
      description:
        'A fully remote cloud infrastructure internship with the BJIT DevCloud team. You will provision and maintain AWS infrastructure using Terraform, write CloudFormation templates, monitor services with CloudWatch, and participate in on-call rotations with senior SREs. Perfect for students who want to go deep on cloud from the start.',
      requirements: [
        'AWS fundamentals (EC2, S3, RDS, VPC)',
        'Basic Terraform or CloudFormation knowledge',
        'Linux command-line proficiency',
        'Understanding of networking (TCP/IP, DNS, HTTPS)',
        'AWS Cloud Practitioner certification is a plus',
      ],
      salary_range: 'BDT 15,000–18,000 / month',
      deadline: new Date(Date.now() + 28 * DAY),
      is_active: true,
    },
  ]

  for (const job of jobs) {
    await knex('jobs').insert(job).onConflict('id').merge({ title: job.title, is_active: job.is_active })
  }

  // Job applications
  const jobApplications = [
    {
      job_id: J1,
      applicant_id: aliceId,
      cover_letter: 'I am a third-year CSE student with strong Python and ML experience. Eager to apply my skills to enterprise-scale problems at BJIT.',
      status: 'shortlisted',
    },
    {
      job_id: J1,
      applicant_id: graceId,
      cover_letter: 'I have built several React front-ends and would love the opportunity to broaden my skills into backend development under BJIT mentorship.',
      status: 'pending',
    },
    {
      job_id: J2,
      applicant_id: bobId,
      cover_letter: 'I have hands-on Docker and GitHub Actions CI/CD experience from personal projects and am keen to grow into infrastructure work full-time.',
      status: 'reviewed',
    },
    {
      job_id: J3,
      applicant_id: frankId,
      cover_letter: 'Strong SQL background from competitive programming and database coursework. Interested in understanding product development from an analytical angle.',
      status: 'pending',
    },
    {
      job_id: J4,
      applicant_id: aliceId,
      cover_letter: 'I am a third-year CSE student enrolled in Machine Learning and deeply interested in Bangla NLP. I would be thrilled to contribute to Dr. Eve\'s research group.',
      status: 'shortlisted',
    },
    {
      job_id: J4,
      applicant_id: frankId,
      cover_letter: 'My competitive programming background gives me strong algorithmic foundations. I have also completed the ML course this semester and am eager to contribute to research.',
      status: 'pending',
    },
    {
      job_id: J5,
      applicant_id: graceId,
      cover_letter: 'Frontend is my passion — I have built production React applications and know Figma well. I would love to bring good design sensibility to the Shohoz team.',
      status: 'reviewed',
    },
    {
      job_id: J7,
      applicant_id: aliceId,
      cover_letter: 'I have strong SQL skills from database coursework and Python for data from my ML projects. Analytics is exactly the bridge between engineering and product decisions that I want to explore.',
      status: 'pending',
    },
    {
      job_id: J8,
      applicant_id: bobId,
      cover_letter: 'I have hands-on AWS and Terraform experience from personal projects deploying on EC2 and RDS. A fully remote cloud role at BJIT is my ideal next step.',
      status: 'pending',
    },
  ]

  for (const app of jobApplications) {
    await knex('job_applications').insert(app).onConflict(['job_id', 'applicant_id']).ignore()
  }

  // Saved jobs
  const savedJobs = [
    { user_id: aliceId,  job_id: J1 },
    { user_id: graceId,  job_id: J1 },
    { user_id: bobId,    job_id: J2 },
    { user_id: frankId,  job_id: J3 },
    { user_id: joydipId, job_id: J2 },
    { user_id: aliceId,  job_id: J4 },
    { user_id: graceId,  job_id: J5 },
    { user_id: aliceId,  job_id: J7 },
    { user_id: frankId,  job_id: J4 },
    { user_id: bobId,    job_id: J6 },
    { user_id: bobId,    job_id: J8 },
    { user_id: graceId,  job_id: J6 },
    { user_id: joydipId, job_id: J6 },
  ]

  for (const sj of savedJobs) {
    await knex('saved_jobs').insert(sj).onConflict(['user_id', 'job_id']).ignore()
  }

  // ── 13. Events ────────────────────────────────────────────────────────────
  const events = [
    {
      id: E1,
      university_id: UNI,
      organizer_id: eveId,
      title: 'UIU Research Symposium 2026',
      description:
        'The annual UIU Research Symposium brings together students, faculty, and industry professionals to showcase cutting-edge research. This year\'s theme is "AI for Social Good". Full-day programme with project presentations, keynote speeches, and a networking lunch.',
      location: 'UIU Auditorium, Satarkul, Dhaka',
      is_online: false,
      starts_at: new Date(Date.now() + 15 * DAY),
      ends_at: new Date(Date.now() + 15 * DAY + 8 * 60 * 60 * 1000),
      capacity: 300,
      type: 'seminar',
      is_published: true,
    },
    {
      id: E2,
      university_id: UNI,
      organizer_id: carolId,
      title: 'UIU Alumni Career Fair 2026',
      description:
        'Connect with 25+ top employers and UIU alumni working across the industry. Companies attending: BJIT, Brain Station 23, Pathao, Shohoz, Samsung R&D, Robi, and more. On-spot interviews available. Dress code: business formal. Bring printed CVs.',
      location: 'UIU Campus Lawn, Satarkul, Dhaka',
      is_online: false,
      starts_at: new Date(Date.now() + 21 * DAY),
      ends_at: new Date(Date.now() + 21 * DAY + 6 * 60 * 60 * 1000),
      capacity: 500,
      type: 'career_fair',
      is_published: true,
    },
    {
      id: E3,
      university_id: UNI,
      organizer_id: adminId,
      title: 'CP Workshop: Graph Algorithms Deep Dive',
      description:
        'Hands-on competitive programming workshop covering graph algorithms. Topics: BFS/DFS, Dijkstra\'s shortest path, Bellman-Ford, Floyd-Warshall, and minimum spanning trees (Prim\'s and Kruskal\'s). Curated practice problems included. Recommended for ICPC aspirants.',
      location: 'UIU Computer Lab 301',
      is_online: false,
      starts_at: new Date(Date.now() + 7 * DAY),
      ends_at: new Date(Date.now() + 7 * DAY + 3 * 60 * 60 * 1000),
      capacity: 40,
      type: 'workshop',
      is_published: true,
    },
    {
      id: E4,
      university_id: UNI,
      organizer_id: adminId,
      title: 'UIU Inter-University Hackathon 2026',
      description:
        'A 24-hour hackathon open to all universities across Bangladesh. Teams of 2–4 will tackle problem statements in three tracks: HealthTech, EdTech, and Smart City. Prizes: BDT 1,00,000 (1st), 50,000 (2nd), 25,000 (3rd). Industry judges from Shohoz, Chaldal, and BJIT. Meals, energy drinks, and workspace provided throughout the event. Pre-registration is mandatory.',
      location: 'UIU Campus, Satarkul, Dhaka',
      is_online: false,
      starts_at: new Date(Date.now() + 30 * DAY),
      ends_at: new Date(Date.now() + 31 * DAY),
      capacity: 200,
      type: 'general',
      is_published: true,
    },
    {
      id: E5,
      university_id: UNI,
      organizer_id: daveId,
      title: 'Alumni Talk: Breaking into Product Management',
      description:
        'Join UIU CSE alumnus Dave Chowdhury (Product Manager, Pathao) for an honest conversation about transitioning from engineering to product management. Topics: what PMs actually do, how to build a PM portfolio as a student, common interview questions, and how to evaluate PM roles. Q&A session included. Zoom link will be emailed to all registered participants.',
      location: 'Online (Zoom)',
      is_online: true,
      online_link: 'https://zoom.us/j/uniconnect-pm-talk',
      starts_at: new Date(Date.now() + 10 * DAY),
      ends_at: new Date(Date.now() + 10 * DAY + 90 * 60 * 1000),
      capacity: 150,
      type: 'seminar',
      is_published: true,
    },
    {
      id: E6,
      university_id: UNI,
      organizer_id: carolId,
      title: 'UIU Alumni Meetup — Dhaka Chapter',
      description:
        'Quarterly in-person meetup for UIU alumni based in Dhaka. Catch up with batch-mates, expand your professional network, and hear short talks from two alumni who recently made significant career transitions. Light refreshments provided. Attendance is free but registration is required for catering planning.',
      location: 'The Westin Dhaka, Gulshan',
      is_online: false,
      starts_at: new Date(Date.now() + 40 * DAY),
      ends_at: new Date(Date.now() + 40 * DAY + 3 * 60 * 60 * 1000),
      capacity: 80,
      type: 'alumni_meetup',
      is_published: true,
    },
    {
      id: E7,
      university_id: UNI,
      organizer_id: eveId,
      title: 'Bangla NLP Workshop: Building Language Models for Low-Resource Languages',
      description:
        'A hands-on technical workshop led by Dr. Eve Islam on building NLP models for Bangla, one of the world\'s most spoken yet under-resourced languages. Sessions cover dataset curation, tokenisation for morphologically rich languages, fine-tuning multilingual transformer models (mBERT, XLM-R), and evaluation strategies. Participants should bring a laptop with Python and PyTorch installed.',
      location: 'UIU AI Lab, Building B, 3rd Floor',
      is_online: false,
      starts_at: new Date(Date.now() + 12 * DAY),
      ends_at: new Date(Date.now() + 12 * DAY + 5 * 60 * 60 * 1000),
      capacity: 25,
      type: 'workshop',
      is_published: true,
    },
  ]

  for (const event of events) {
    await knex('events').insert(event).onConflict('id').merge({ title: event.title, is_published: event.is_published })
  }

  // Event RSVPs
  const rsvps = [
    { event_id: E1, user_id: aliceId,  status: 'going' },
    { event_id: E1, user_id: bobId,    status: 'going' },
    { event_id: E1, user_id: frankId,  status: 'maybe' },
    { event_id: E1, user_id: graceId,  status: 'going' },
    { event_id: E1, user_id: joydipId, status: 'going' },
    { event_id: E2, user_id: aliceId,  status: 'going' },
    { event_id: E2, user_id: bobId,    status: 'going' },
    { event_id: E2, user_id: graceId,  status: 'going' },
    { event_id: E2, user_id: frankId,  status: 'going' },
    { event_id: E2, user_id: joydipId, status: 'going' },
    { event_id: E3, user_id: frankId,  status: 'going' },
    { event_id: E3, user_id: bobId,    status: 'going' },
    { event_id: E3, user_id: aliceId,  status: 'maybe' },
    { event_id: E4, user_id: aliceId,  status: 'going'  },
    { event_id: E4, user_id: bobId,    status: 'going'  },
    { event_id: E4, user_id: frankId,  status: 'going'  },
    { event_id: E4, user_id: graceId,  status: 'going'  },
    { event_id: E4, user_id: joydipId, status: 'going'  },
    { event_id: E5, user_id: aliceId,  status: 'going'  },
    { event_id: E5, user_id: bobId,    status: 'going'  },
    { event_id: E5, user_id: graceId,  status: 'going'  },
    { event_id: E5, user_id: frankId,  status: 'maybe'  },
    { event_id: E5, user_id: joydipId, status: 'going'  },
    { event_id: E5, user_id: carolId,  status: 'going'  },
    { event_id: E6, user_id: carolId,  status: 'going'  },
    { event_id: E6, user_id: daveId,   status: 'going'  },
    { event_id: E6, user_id: henryId,  status: 'going'  },
    { event_id: E6, user_id: joydipId, status: 'maybe'  },
    { event_id: E7, user_id: aliceId,  status: 'going'  },
    { event_id: E7, user_id: frankId,  status: 'going'  },
    { event_id: E7, user_id: bobId,    status: 'maybe'  },
    { event_id: E7, user_id: graceId,  status: 'going'  },
  ]

  for (const rsvp of rsvps) {
    await knex('event_rsvps').insert(rsvp).onConflict(['event_id', 'user_id']).ignore()
  }

  // ── 14. Groups ────────────────────────────────────────────────────────────
  const groups = [
    {
      id: G1,
      university_id: UNI,
      created_by: eveId,
      name: 'UIU ACM Student Chapter',
      description: 'Official ACM student chapter at UIU. We run weekly coding contests, algorithm workshops, and industry networking sessions. Open to all UIU students passionate about CS.',
      type: 'club',
      is_private: false,
      member_count: 0,
    },
    {
      id: G2,
      university_id: UNI,
      created_by: carolId,
      name: 'UIU CSE Alumni Network',
      description: 'A community for UIU CSE graduates to connect, share opportunities, and mentor current students. Monthly virtual meetups and career guidance Q&A sessions.',
      type: 'other',
      is_private: false,
      member_count: 0,
    },
    {
      id: G3,
      university_id: UNI,
      created_by: frankId,
      name: 'CSE Batch 2026',
      description: 'Private group for the CSE graduating class of 2026. Share lecture notes, discuss assignments, and coordinate study sessions.',
      type: 'batch',
      is_private: true,
      member_count: 0,
    },
  ]

  for (const group of groups) {
    await knex('groups').insert(group).onConflict('id').merge({ name: group.name, is_private: group.is_private })
  }

  // Group members
  const groupMembers = [
    { group_id: G1, user_id: eveId,   role: 'owner'  },
    { group_id: G1, user_id: adminId, role: 'admin'   },
    { group_id: G1, user_id: aliceId, role: 'member'  },
    { group_id: G1, user_id: bobId,   role: 'member'  },
    { group_id: G1, user_id: frankId, role: 'member'  },
    { group_id: G1, user_id: graceId, role: 'member'  },
    { group_id: G2, user_id: carolId,  role: 'owner'  },
    { group_id: G2, user_id: daveId,   role: 'admin'  },
    { group_id: G2, user_id: henryId,  role: 'member' },
    { group_id: G2, user_id: joydipId, role: 'member' },
    { group_id: G3, user_id: frankId,  role: 'owner'  },
    { group_id: G3, user_id: aliceId,  role: 'member' },
    { group_id: G3, user_id: graceId,  role: 'member' },
    { group_id: G3, user_id: bobId,    role: 'member' },
  ]

  for (const gm of groupMembers) {
    await knex('group_members').insert(gm).onConflict(['group_id', 'user_id']).ignore()
  }

  await knex.raw(
    `UPDATE groups SET member_count = (SELECT COUNT(*) FROM group_members WHERE group_id = groups.id) WHERE id IN (?, ?, ?)`,
    [G1, G2, G3],
  )

  // ── 15. Conversations & messages ──────────────────────────────────────────
  const conversations = [
    { id: CONV1, university_id: UNI, created_by: aliceId, is_group: false },
    { id: CONV2, university_id: UNI, name: 'ACM Chapter — Leadership', created_by: eveId, is_group: true },
  ]

  for (const conv of conversations) {
    await knex('conversations').insert(conv).onConflict('id').ignore()
  }

  const participants = [
    { conversation_id: CONV1, user_id: aliceId  },
    { conversation_id: CONV1, user_id: carolId  },
    { conversation_id: CONV2, user_id: eveId    },
    { conversation_id: CONV2, user_id: adminId  },
    { conversation_id: CONV2, user_id: frankId  },
    { conversation_id: CONV2, user_id: bobId    },
  ]

  for (const p of participants) {
    await knex('conversation_participants').insert(p).onConflict(['conversation_id', 'user_id']).ignore()
  }

  const messages = [
    {
      id: '00000000-0000-4000-8000-000000000200',
      conversation_id: CONV1,
      sender_id: aliceId,
      content: 'Hi Carol! I saw your post about the BJIT internship — would love to chat about it.',
      type: 'text',
      created_at: new Date(Date.now() - 3 * DAY),
    },
    {
      id: '00000000-0000-4000-8000-000000000201',
      conversation_id: CONV1,
      sender_id: carolId,
      content: 'Hey Alice! Glad you reached out. Which domain interests you most — backend, ML engineering, or data?',
      type: 'text',
      created_at: new Date(Date.now() - 3 * DAY + 10 * 60 * 1000),
    },
    {
      id: '00000000-0000-4000-8000-000000000202',
      conversation_id: CONV1,
      sender_id: aliceId,
      content: 'Primarily ML and data engineering, though I\'m also comfortable with Python backend work.',
      type: 'text',
      created_at: new Date(Date.now() - 3 * DAY + 20 * 60 * 1000),
    },
    {
      id: '00000000-0000-4000-8000-000000000203',
      conversation_id: CONV2,
      sender_id: eveId,
      content: 'Team, the Graph Algorithms workshop is confirmed for next week. Bob and Frank, can you help curate the practice problems?',
      type: 'text',
      created_at: new Date(Date.now() - 2 * DAY),
    },
    {
      id: '00000000-0000-4000-8000-000000000204',
      conversation_id: CONV2,
      sender_id: bobId,
      content: 'Absolutely — I have a solid set of Codeforces Dijkstra problems ready to go.',
      type: 'text',
      created_at: new Date(Date.now() - 2 * DAY + 15 * 60 * 1000),
    },
    {
      id: '00000000-0000-4000-8000-000000000205',
      conversation_id: CONV2,
      sender_id: frankId,
      content: 'I will cover MST — Prim\'s and Kruskal\'s with a couple of tricky edge cases. Should be a great session!',
      type: 'text',
      created_at: new Date(Date.now() - 2 * DAY + 30 * 60 * 1000),
    },
  ]

  for (const msg of messages) {
    await knex('messages').insert(msg).onConflict('id').ignore()
  }

  // ── 16. News ──────────────────────────────────────────────────────────────
  const newsItems = [
    {
      id: NEWS1,
      university_id: UNI,
      author_id: adminId,
      title: 'UIU Ranked Among Top 5 Universities in Bangladesh for Research Output 2025',
      slug: 'uiu-ranked-top-5-research-2025',
      body: 'United International University has been ranked among the top five universities in Bangladesh for research output in the latest QS Asia University Rankings supplement, recording a 32% year-on-year increase in international publications.\n\nThe CSE department contributed 47 international conference papers and 12 journal articles indexed in Scopus and IEEE Xplore. Collaborations spanned institutions in Japan, South Korea, and the United Kingdom.\n\nVice Chancellor Professor Dr. Chowdhury Mofizur Rahman congratulated faculty and researchers, emphasising UIU\'s commitment to becoming a research-led institution by 2030.',
      category: 'academic',
      is_published: true,
      is_pinned: true,
      view_count: 342,
      published_at: new Date(Date.now() - 10 * DAY),
    },
    {
      id: NEWS2,
      university_id: UNI,
      author_id: adminId,
      title: 'New AI Research Lab Inaugurated at UIU with Industry Partnership',
      slug: 'uiu-ai-research-lab-inauguration-2026',
      body: 'UIU has formally inaugurated its new Artificial Intelligence and Data Science Research Laboratory in partnership with three leading technology companies. The facility features GPU clusters for deep learning research, collaborative workspaces, and dedicated areas for industry-academia joint projects.\n\nThe lab supports research in natural language processing, computer vision, and applied machine learning. Postgraduate students will have priority access; undergraduate research assistant positions are available through faculty nominations.\n\nApplications for the first cohort of research assistants open May 20, 2026. Interested students should apply via the academic portal with a CV and a 300-word research statement.',
      category: 'research',
      is_published: true,
      is_pinned: false,
      view_count: 218,
      published_at: new Date(Date.now() - 3 * DAY),
    },
    {
      id: NEWS3,
      university_id: UNI,
      author_id: adminId,
      title: 'UIU ACM Team Qualifies for ICPC Asia Dhaka Regional 2026',
      slug: 'uiu-acm-icpc-asia-dhaka-2026',
      body: 'Three UIU student teams have qualified for the ICPC Asia Dhaka Regional Contest to be held in June 2026, marking UIU\'s strongest showing in the competition\'s history. The teams, coached by the ACM Student Chapter under the guidance of faculty advisor Dr. Eve Islam, secured top placements in the online preliminary round.\n\nTeam UIU_Alpha, comprising Frank Khan (CSE \'26), Bob Hossain (CSE \'24), and a third member, placed 7th in the preliminary round, earning a direct regional berth. Two additional UIU teams also qualified via wildcard selection.\n\nThe department will provide travel grants and dedicated preparation sessions in the weeks leading up to the regional. Well-wishers can follow the team\'s progress through the UIU ACM Chapter group on UniConnecT.',
      category: 'sports',
      is_published: true,
      is_pinned: false,
      view_count: 187,
      published_at: new Date(Date.now() - 6 * DAY),
    },
    {
      id: NEWS4,
      university_id: UNI,
      author_id: adminId,
      title: 'Academic Calendar Update: Spring 2026 Final Exam Schedule Released',
      slug: 'uiu-spring-2026-final-exam-schedule',
      body: 'The UIU Academic Office has released the final examination schedule for Spring 2026. Final exams are scheduled to run from June 15 to June 28, 2026. Students are advised to check the academic portal for their individual timetables and room assignments.\n\nKey deadlines before finals:\n• Course withdrawal deadline: May 22, 2026\n• Grade improvement application deadline: May 25, 2026\n• Incomplete (I) grade clearance deadline: May 30, 2026\n\nThe library will operate extended hours (8 AM–10 PM) from June 1 through the end of the examination period. Students requiring special examination accommodations must submit requests to the Registrar\'s Office no later than May 20, 2026.\n\nFor queries, contact the Academic Office at academic@uiu.ac.bd.',
      category: 'academic',
      is_published: true,
      is_pinned: true,
      view_count: 512,
      published_at: new Date(Date.now() - 2 * DAY),
    },
  ]

  for (const news of newsItems) {
    await knex('news')
      .insert(news)
      .onConflict(['university_id', 'slug'])
      .merge({ title: news.title, is_published: news.is_published, view_count: news.view_count })
  }

  // ── 17. Notifications ─────────────────────────────────────────────────────
  // Delete existing seed notifications for our users to keep seeding idempotent
  await knex('notifications')
    .whereIn('user_id', [aliceId, bobId, carolId, frankId, graceId, joydipId])
    .delete()

  const notifications = [
    { user_id: aliceId, type: 'reaction',            actor_id: carolId,  reference_id: P1,      reference_type: 'post',    content: 'Carol Ahmed reacted to your post',              is_read: false },
    { user_id: aliceId, type: 'comment',             actor_id: eveId,    reference_id: CMT1,    reference_type: 'comment', content: 'Dr. Eve Islam commented on your post',           is_read: false },
    { user_id: aliceId, type: 'connection_accepted', actor_id: joydipId, reference_id: aliceId, reference_type: 'user',    content: 'Joydip Datta accepted your connection request',   is_read: true  },
    { user_id: aliceId, type: 'reaction',            actor_id: frankId,  reference_id: P1,      reference_type: 'post',    content: 'Frank Khan liked your post',                     is_read: false },
    { user_id: bobId,   type: 'reaction',            actor_id: carolId,  reference_id: P4,      reference_type: 'post',    content: 'Carol Ahmed celebrated your post',               is_read: false },
    { user_id: bobId,   type: 'comment',             actor_id: carolId,  reference_id: CMT3,    reference_type: 'comment', content: 'Carol Ahmed commented on your post',             is_read: false },
    { user_id: bobId,   type: 'connection_accepted', actor_id: joydipId, reference_id: bobId,   reference_type: 'user',    content: 'Joydip Datta accepted your connection request',   is_read: true  },
    { user_id: carolId, type: 'connection_request',  actor_id: aliceId,  reference_id: carolId, reference_type: 'user',    content: 'Alice Rahman sent you a connection request',      is_read: true  },
    { user_id: carolId, type: 'comment',             actor_id: aliceId,  reference_id: CMT4,    reference_type: 'comment', content: 'Alice Rahman commented on your post',            is_read: false },
    { user_id: frankId, type: 'connection_request',  actor_id: joydipId, reference_id: frankId, reference_type: 'user',    content: 'Joydip Datta sent you a connection request',      is_read: false },
    { user_id: graceId, type: 'reaction',            actor_id: bobId,    reference_id: P_POLL,  reference_type: 'post',    content: 'Bob Hossain reacted to your poll',               is_read: false },
    { user_id: joydipId,type: 'reaction',            actor_id: bobId,    reference_id: P1,      reference_type: 'post',    content: 'Bob Hossain reacted to a post you reacted to',   is_read: false },
  ]

  for (const n of notifications) {
    await knex('notifications').insert(n)
  }

  // ── 18. Courses ───────────────────────────────────────────────────────────
  const courses = [
    { id: C1, university_id: UNI, code: 'CSE4820', title: 'Machine Learning',   section: 'A', term: 'Spring 2026', is_active: true },
    { id: C2, university_id: UNI, code: 'CSE4625', title: 'Database Systems',   section: 'B', term: 'Spring 2026', is_active: true },
    { id: C3, university_id: UNI, code: 'CSE4540', title: 'Web Engineering',    section: 'A', term: 'Spring 2026', is_active: true },
  ]

  for (const course of courses) {
    await knex('courses')
      .insert(course)
      .onConflict(['university_id', 'code', 'section', 'term'])
      .merge({ title: course.title })
  }

  const fetchCourseId = async (code: string, section: string, fallback: string) => {
    const row = await knex('courses').where({ university_id: UNI, code, section, term: 'Spring 2026' }).select('id').first<{ id: string }>()
    return row?.id ?? fallback
  }

  const c1Id = await fetchCourseId('CSE4820', 'A', C1)
  const c2Id = await fetchCourseId('CSE4625', 'B', C2)
  const c3Id = await fetchCourseId('CSE4540', 'A', C3)

  const userCourses = [
    { user_id: aliceId, course_id: c1Id, status: 'enrolled' },
    { user_id: aliceId, course_id: c3Id, status: 'enrolled' },
    { user_id: bobId,   course_id: c2Id, status: 'enrolled' },
    { user_id: bobId,   course_id: c3Id, status: 'enrolled' },
    { user_id: frankId, course_id: c1Id, status: 'enrolled' },
    { user_id: frankId, course_id: c2Id, status: 'enrolled' },
    { user_id: graceId, course_id: c3Id, status: 'enrolled' },
    { user_id: eveId,   course_id: c1Id, status: 'enrolled' },
  ]

  for (const uc of userCourses) {
    await knex('user_courses').insert(uc).onConflict(['user_id', 'course_id']).ignore()
  }

  // ── 19. Shuttle route ─────────────────────────────────────────────────────
  await knex('shuttle_routes')
    .insert({
      id: ROUTE1,
      university_id: UNI,
      name: 'Gulshan ↔ UIU Campus',
      color: '#FF6B35',
      stops: knex.raw(`'[
        {"name":"Gulshan 2 Circle","time":"7:30 AM"},
        {"name":"Rampura Bridge","time":"7:50 AM"},
        {"name":"Badda Link Road","time":"8:05 AM"},
        {"name":"Satarkul","time":"8:15 AM"},
        {"name":"UIU Main Gate","time":"8:20 AM"}
      ]'::jsonb`),
      schedule: knex.raw(`'{
        "morning":{"departure":"7:30 AM","arrival":"8:20 AM"},
        "evening":{"departure":"5:30 PM","arrival":"6:20 PM"}
      }'::jsonb`),
      is_active: true,
    })
    .onConflict('id')
    .ignore()

  // ── 20. Lost and Found ────────────────────────────────────────────────────
  const lostAndFound = [
    {
      id: LF1,
      university_id: UNI,
      posted_by: graceId,
      type: 'lost',
      item_name: 'CASIO fx-991EX ClassWiz Calculator',
      description: 'Lost my blue CASIO fx-991EX calculator during or shortly after the CSE4625 midterm on May 10. My name "Grace" is scratched on the back. Please contact me — finals are soon!',
      location_detail: 'Exam Hall 201 or surrounding corridors, UIU Campus',
      contact_info: 'grace.begum@bscse.uiu.ac.bd',
      is_resolved: false,
      created_at: new Date(Date.now() - 5 * DAY),
    },
    {
      id: LF2,
      university_id: UNI,
      posted_by: frankId,
      type: 'found',
      item_name: 'Dell-branded Black Laptop Bag',
      description: 'Found a black Dell laptop bag near the cafeteria entrance. Contains notebooks and USB drives but no ID. Handed it in to the security desk at the main gate.',
      location_detail: 'Now at security desk, UIU Main Gate',
      contact_info: 'frank.khan@bscse.uiu.ac.bd',
      is_resolved: false,
      created_at: new Date(Date.now() - 2 * DAY),
    },
  ]

  for (const item of lostAndFound) {
    await knex('lost_and_found').insert(item).onConflict('id').merge({ is_resolved: item.is_resolved })
  }

  // ── 21. Mentorship requests ───────────────────────────────────────────────
  const mentorshipRequests = [
    {
      id: MR1,
      university_id: UNI,
      student_id: aliceId,
      alumni_id: carolId,
      message: 'Hi Carol! I am a third-year CSE student very interested in backend and ML engineering. I saw your posts about BJIT and your experience is exactly the kind of trajectory I want. Would you be open to a short mentorship call to talk about navigating the internship process and early career decisions?',
      status: 'accepted',
      session_notes: 'Discussed targeting ML engineering roles, building a portfolio with two strong end-to-end projects, and reaching out to hiring managers directly on LinkedIn. Alice to share her resume draft next week.',
    },
    {
      id: MR2,
      university_id: UNI,
      student_id: bobId,
      alumni_id: henryId,
      message: 'Hi Henry! I have been following your posts on DevOps and infrastructure. I am a final-year student who has started using Docker and GitHub Actions in personal projects but want to go deeper — especially into Kubernetes and cloud infrastructure. Would you be willing to mentor me as I prepare to transition into a DevOps role after graduation?',
      status: 'accepted',
      session_notes: 'Covered the roadmap from Docker to Kubernetes, recommended the CKA certification path, and discussed how to position DevOps skills in a CV for someone with a software background. Bob to set up a local k3s cluster and share progress.',
    },
    {
      id: MR3,
      university_id: UNI,
      student_id: graceId,
      alumni_id: carolId,
      message: 'Hello Carol, I am a UX designer and frontend developer currently in my third year. I admire how you have grown technically at BJIT. I am trying to decide between focusing on frontend engineering or UX/product design full-time. Could you spare some time to share your perspective on the industry from an engineering lens?',
      status: 'pending',
      session_notes: null,
    },
    {
      id: MR4,
      university_id: UNI,
      student_id: frankId,
      alumni_id: henryId,
      message: 'Hi Henry! I am a competitive programmer passionate about systems and infrastructure. I have heard that a strong algorithms background translates well into SRE and infrastructure engineering. Would love to get your take on how you made that transition and what skills matter most for a role like yours at Brain Station 23.',
      status: 'pending',
      session_notes: null,
    },
    {
      id: MR5,
      university_id: UNI,
      student_id: aliceId,
      alumni_id: daveId,
      message: 'Hi Dave! I am exploring a career path in data and product analytics. Your background as a PM at Pathao seems like the perfect blend of data-driven and strategic thinking. Would you be open to a 30-minute chat to help me understand the PM vs. data analyst decision better?',
      status: 'declined',
      session_notes: null,
    },
  ]

  for (const mr of mentorshipRequests) {
    await knex('mentorship_requests')
      .insert(mr)
      .onConflict(['student_id', 'alumni_id'])
      .merge({ status: mr.status, session_notes: mr.session_notes })
  }
}
