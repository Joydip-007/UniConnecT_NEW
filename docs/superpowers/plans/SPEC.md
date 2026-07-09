# UniConnecT — Feature Implementation Specification

**Date:** 2026-07-08  
**Project:** Joydip-007/UniConnecT_NEW  
**Status:** ✅ Design Confirmed — Ready for Implementation

---

## Table of Contents

1. [Understanding Summary](#1-understanding-summary)
2. [Assumptions](#2-assumptions)
3. [Decision Log](#3-decision-log)
4. [Architecture Overview](#4-architecture-overview)
5. [Feature 1 — AI Automation (Platform-Wide)](#5-feature-1--ai-automation-platform-wide)
6. [Feature 2 — Academic Group Type](#6-feature-2--academic-group-type)
7. [Feature 3 — Course Outline](#7-feature-3--course-outline)
8. [Feature 4 — Gradebook](#8-feature-4--gradebook)
9. [Feature 5 — Modules & Assignments](#9-feature-5--modules--assignments)
10. [Feature 6 — AI Settings Panel](#10-feature-6--ai-settings-panel)
11. [Feature 7 — Flashcard Restructure](#11-feature-7--flashcard-restructure)
12. [Feature 8 — AI Daily Scheduler](#12-feature-8--ai-daily-scheduler)
13. [Feature 9 — File Upload in Shared Notes](#13-feature-9--file-upload-in-shared-notes)
14. [Feature 10 — Per-Session Notes & File Upload](#14-feature-10--per-session-notes--file-upload)
15. [Migration Order](#15-migration-order)
16. [Environment Variables](#16-environment-variables)
17. [Implementation Order](#17-implementation-order)
18. [Testing Strategy](#18-testing-strategy)

---

## 1. Understanding Summary

| Aspect | Detail |
|---|---|
| **What** | 10 new features across the learning module and study groups module |
| **Why** | Transform UniConnecT's study groups into a full academic LMS; automate content via free AI |
| **Who** | Faculty (create academic groups, manage LMS); Students/Alumni (consume content, submit); AI Bot (post daily content) |
| **Key Constraint** | 100% free infrastructure — Gemini 1.5 Flash, existing R2 storage, existing Bull queues |
| **Non-Goals** | Attendance tracking, AI auto-grading, enhanced announcements, learning paths inside groups |

---

## 2. Assumptions

| # | Assumption | Action if Wrong |
|---|---|---|
| A1 | Project is pre-launch — hard delete of flashcard data in non-academic groups is safe | Rollback migration, use soft-hide instead |
| A2 | Campus bot user exists (seeded in migration 063) and can be reused as AI poster | Add a bot user seed to the new migration |
| A3 | Grading scale is configurable per academic group; default = UIU 4.00 scale (90%=A) | Add UGC scale as second preset option |
| A4 | Course outline must be saved before gradebook columns can be created | Enforce in API: 404 if course outline missing |
| A5 | Weekly topic plan from course outline feeds AI topic rotation automatically | If no topic plan exists, AI falls back to group subject preference |
| A6 | 25MB file limit applies to all upload types: shared notes, session notes, assignment submissions, assignment attachments | Enforced at presigned URL generation (Content-Length-Range metadata) |
| A7 | A separate `academic_course_outlines` table is needed (JSONB on groups is insufficient for query/relational needs) | — |
| A8 | Gemini 1.5 Flash free tier (15 req/min, 1M tokens/day) is sufficient for university-scale usage | Implement exponential backoff + fallback to static content |

---

## 3. Decision Log

| # | Decision | Alternatives Considered | Rationale |
|---|---|---|---|
| D1 | Use Gemini 1.5 Flash (free) as AI provider | Groq (fast but 14.4k req/day limit), Together.ai ($1 credit), OpenAI (paid) | Highest free token quota (1M/day), no credit card, SDK mature |
| D2 | Hard-delete flashcard data from non-academic groups | Soft-hide, grandfather access | Pre-launch, no real user data risk; clean slate preferred |
| D3 | Store course outline in separate `academic_course_outlines` table | JSONB on groups table | Needs relational queries for gradebook column generation; weekly topics need indexing for AI rotation |
| D4 | Auto-populate gradebook from group members at join time | Manual enrollment | Matches Bangladesh university model; faculty doesn't need to enroll individually |
| D5 | "Best N of M" is computed server-side when faculty submits marks | Compute client-side in spreadsheet | Single source of truth; prevents client-side manipulation of grades |
| D6 | Weekly topic rotation pulled from course outline topic plan | Separate AI topic list | Faculty already defines topics for teaching; reusing avoids duplication |
| D7 | Per-session notes: creator notes (read-only for others) + private member notes | Fully collaborative, faculty-only | Matches Bangladesh classroom model: lecturer notes + student personal notes |
| D8 | Require approval toggle defaults to OFF | Default ON | Reduces friction; faculty who want control can enable it; AI content is generally safe |
| D9 | UIU grading scale as default; configurable per group | Hardcode UGC scale | UniConnecT targets multi-university; each university may have different scale |
| D10 | Bot posts to group feed as a real post (not a system message) | System notification only | Appears naturally in feed; members engage with it like other posts |

---

## 4. Architecture Overview

```
apps/api/src/
├── config/
│   └── env.ts                          MODIFY — add GEMINI_API_KEY
├── services/
│   └── ai.service.ts                   NEW — Gemini integration
├── queues/
│   └── ai-content.queue.ts             NEW — Bull queue for AI tasks
├── workers/
│   ├── quiz.worker.ts                  MODIFY — read from ai_quiz_pool
│   └── ai-content.worker.ts            NEW — daily AI content generator
├── middleware/
│   └── requireAcademicGroup.ts         NEW — gate flashcard routes
├── modules/
│   ├── groups/
│   │   ├── schema.ts                   MODIFY — add 'academic' type, new schemas
│   │   ├── service.ts                  MODIFY — faculty guard, session notes, AI settings
│   │   └── router.ts                   MODIFY — new routes, middleware
│   ├── academic/                       NEW MODULE
│   │   ├── course-outline.service.ts
│   │   ├── gradebook.service.ts
│   │   ├── modules.service.ts
│   │   ├── assignments.service.ts
│   │   ├── schema.ts
│   │   └── router.ts
│   └── learning/
│       └── service.ts                  MODIFY — AI path generation
└── database/
    └── migrations/
        ├── 090_create_ai_quiz_pool.ts           NEW
        ├── 091_add_academic_group_type.ts        NEW
        ├── 092_create_course_outline.ts          NEW
        ├── 093_create_academic_lms_tables.ts     NEW
        ├── 094_add_note_attachments.ts           NEW
        └── 095_create_session_notes.ts           NEW

apps/web/src/features/
├── groups/
│   ├── components/
│   │   ├── CreateGroupModal.tsx         MODIFY — academic type for faculty
│   │   ├── StudyToolsTab.tsx            MODIFY — academic gating
│   │   ├── StudyDecksPanel.tsx          MODIFY — academic-only guard
│   │   ├── StudyNotesPanel.tsx          MODIFY — file attachments
│   │   ├── StudySessionsTab.tsx         MODIFY — session notes link
│   │   └── SessionNotesPanel.tsx        NEW
│   └── academic/                        NEW
│       ├── AcademicLMSTab.tsx
│       ├── CourseOutlineForm.tsx
│       ├── GradebookPanel.tsx
│       ├── ModulesPanel.tsx
│       ├── AssignmentsPanel.tsx
│       ├── AISettingsPanel.tsx
│       └── StudentGradeCard.tsx
```

---

## 5. Feature 1 — AI Automation (Platform-Wide)

### Purpose
Automatically generate quiz questions and skill path drafts daily using Gemini 1.5 Flash. Feeds the existing `daily_quiz_slots` system and creates draft skill paths for faculty/admin review.

### 5.1 New Service: `services/ai.service.ts`

```typescript
// Dependencies: pnpm add @google/generative-ai (in apps/api)

import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '../config/env'

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

// ── Types ────────────────────────────────────────────────────────
export interface AIQuizQuestion {
  q: string
  options: [string, string, string, string]
  answer: number       // 0-indexed correct option
  explanation?: string
}

export interface AIFlashcard {
  front: string
  back: string
  hint?: string
}

export interface AISkillPath {
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedHours: number
  units: Array<{
    title: string
    type: 'read' | 'video' | 'exercise'
    content: { text: string }
    estimatedMinutes: number
  }>
}

// ── Functions ────────────────────────────────────────────────────
export async function generateQuizQuestions(
  options: {
    department: string
    count?: number
    difficulty?: string
    style?: 'mcq' | 'true_false' | 'mixed'
    language?: 'en' | 'bn'
    topic?: string
    customInstructions?: string
  }
): Promise<AIQuizQuestion[]>

export async function generateFlashcards(
  options: {
    topic: string
    count?: number
    difficulty?: string
    language?: 'en' | 'bn'
    customInstructions?: string
  }
): Promise<AIFlashcard[]>

export async function generateSkillPath(
  options: {
    category: string
    difficulty?: string
    language?: 'en' | 'bn'
  }
): Promise<AISkillPath>
```

**Prompt engineering rules:**
- Always instruct: "Return ONLY valid JSON. No markdown. No explanation."
- Add JSON schema inline in prompt for structure enforcement
- Set temperature to 0.4 for consistency
- Wrap every call in try/catch with exponential backoff (2 retries, 2s / 4s delays)
- Timeout: 15 seconds per call

### 5.2 Migration: `090_create_ai_quiz_pool.ts`

```sql
CREATE TABLE ai_quiz_pool (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  department   VARCHAR(255) NOT NULL,
  questions    JSONB NOT NULL,       -- AIQuizQuestion[]
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at  TIMESTAMPTZ,          -- NULL = available; set when used by quiz.worker
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ai_quiz_pool_available_idx
  ON ai_quiz_pool(university_id, department, consumed_at)
  WHERE consumed_at IS NULL;
```

### 5.3 Modify `workers/quiz.worker.ts`

When generating daily quiz slots, check `ai_quiz_pool` first:

```typescript
// In generateDailyQuizSlots():
// 1. Query ai_quiz_pool WHERE university_id=? AND department=? AND consumed_at IS NULL
//    ORDER BY generated_at ASC LIMIT 1
// 2. If found: use those questions, mark consumed_at = NOW()
// 3. If not found: fall back to skill_path_units quiz type
// 4. If still empty: fall back to FALLBACK_QUESTIONS array (existing behavior)
```

### 5.4 AI Skill Path Generation

New function in `modules/learning/service.ts`:

```typescript
async generateAndSaveAIPath(
  category: string,
  universityId: string | null,
  createdBy: string   // faculty/admin user ID
): Promise<{ id: string }>
// - Calls aiService.generateSkillPath()
// - Validates JSON structure
// - Inserts to skill_paths with is_published = false
// - Inserts units to skill_path_units with sequential display_order
// - Returns { id } of new path
```

New API endpoint: `POST /api/v1/learning/paths/ai-generate`
- **Auth:** faculty or admin role only
- **Body:** `{ category: string, difficulty?: string }`
- **Response:** `{ id, title, status: 'draft' }`

---

## 6. Feature 2 — Academic Group Type

### Purpose
Add `'academic'` as a new group type, exclusively creatable by faculty. Faculty becomes owner/admin automatically (existing behavior).

### 6.1 Migration: `091_add_academic_group_type.ts`

```sql
-- Part of this migration (others in later features)

-- 1. Add academic to groups type check constraint
-- (If using Knex string column with check, add 'academic' to allowed values)
ALTER TABLE groups
  DROP CONSTRAINT IF EXISTS groups_type_check;

ALTER TABLE groups
  ADD CONSTRAINT groups_type_check
  CHECK (type IN ('department','club','batch','research','interest','other','academic'));

-- 2. Add ai_settings column
ALTER TABLE groups
  ADD COLUMN ai_settings JSONB NOT NULL DEFAULT '{}';

-- ai_settings shape:
-- {
--   "ai_flashcards_enabled": boolean,
--   "ai_quiz_enabled": boolean,
--   "require_approval": boolean,
--   "subject": string,
--   "difficulty": "beginner"|"intermediate"|"advanced",
--   "question_style": "mcq"|"true_false"|"short_answer"|"mixed",
--   "language": "en"|"bn",
--   "custom_instructions": string,
--   "last_ai_post_date": string (ISO date),
--   "pending_deck_id": string | null   -- deck awaiting approval
-- }
```

### 6.2 Schema Update: `groups/schema.ts`

```typescript
// Change GroupTypeSchema:
export const GroupTypeSchema = z.enum([
  'department', 'club', 'batch', 'research', 'interest', 'other', 'academic'
])

// Add AISettingsSchema:
export const AISettingsSchema = z.object({
  ai_flashcards_enabled:  z.boolean().default(false),
  ai_quiz_enabled:        z.boolean().default(false),
  require_approval:       z.boolean().default(false),
  subject:                z.string().max(255).optional(),
  difficulty:             z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  question_style:         z.enum(['mcq', 'true_false', 'short_answer', 'mixed']).optional(),
  language:               z.enum(['en', 'bn']).default('en'),
  custom_instructions:    z.string().max(1000).optional(),
})

// Update UpdateGroupAISettingsSchema (new):
export const UpdateGroupAISettingsSchema = AISettingsSchema.partial()
```

### 6.3 Service Guard: `groups/service.ts`

```typescript
// In createGroup():
if (input.type === 'academic' && context.role !== 'faculty') {
  throw forbidden(
    'Only faculty members can create academic groups',
    'ACADEMIC_GROUP_FACULTY_ONLY'
  )
}
```

### 6.4 New API Endpoint

`PATCH /api/v1/groups/:groupId/ai-settings`
- **Auth:** group owner or admin only (`assertGroupAdminAccess`)
- **Body:** `UpdateGroupAISettingsSchema`
- **Response:** Updated group with `aiSettings`
- **Guard:** Group must be type `academic`

### 6.5 toGroup() Mapper Update

```typescript
function toGroup(row: GroupRow) {
  return {
    // ...existing fields...
    aiSettings: row.ai_settings ?? {},   // NEW
  }
}
```

---

## 7. Feature 3 — Course Outline

### Purpose
Faculty defines the full course structure (grading breakdown, weekly topics) at the start of a trimester. Drives both the gradebook column structure and AI topic rotation.

### 7.1 Migration: `092_create_course_outline.ts`

```sql
CREATE TABLE academic_course_outlines (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id       UUID NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE,
  university_id  UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,

  -- General Info
  course_code    VARCHAR(50),
  course_title   VARCHAR(255) NOT NULL,
  credit_hours   NUMERIC(3,1),
  trimester      VARCHAR(100),       -- e.g., "Spring 2026"
  description    TEXT,

  -- Grading scale stored as JSONB preset key
  grading_scale  VARCHAR(50) NOT NULL DEFAULT 'uiu',
  -- 'uiu': 90=A/4.00, 86=A-/3.67 ...
  -- 'ugc': 80=A+/4.00, 75=A/3.75 ...
  -- 'custom': uses custom_scale_json

  custom_scale_json JSONB,           -- only used when grading_scale = 'custom'

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE course_outline_assessments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outline_id      UUID NOT NULL REFERENCES academic_course_outlines(id) ON DELETE CASCADE,
  category_name   VARCHAR(100) NOT NULL,  -- "Class Test", "Midterm", "Final Exam", etc.
  full_marks      INTEGER NOT NULL,
  weight_percent  NUMERIC(5,2) NOT NULL,
  total_given     INTEGER NOT NULL DEFAULT 1,   -- how many of this type faculty will give
  best_n_counted  INTEGER NOT NULL DEFAULT 1,   -- how many count (best N out of total_given)
  display_order   INTEGER NOT NULL DEFAULT 1,
  -- Validation: best_n_counted <= total_given
  -- Validation: SUM(weight_percent) across outline = 100
  CONSTRAINT best_n_valid CHECK (best_n_counted <= total_given AND best_n_counted >= 1)
);

CREATE TABLE course_outline_topics (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  outline_id  UUID NOT NULL REFERENCES academic_course_outlines(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  UNIQUE(outline_id, week_number)
);

CREATE INDEX co_assessments_outline_idx ON course_outline_assessments(outline_id, display_order);
CREATE INDEX co_topics_outline_idx ON course_outline_topics(outline_id, week_number);
```

### 7.2 API Endpoints (`/api/v1/groups/:groupId/course-outline`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | member | Get full course outline with assessments + topics |
| `POST` | `/` | owner/admin | Create course outline (once per group) |
| `PUT` | `/` | owner/admin | Replace full course outline |
| `PATCH` | `/assessments` | owner/admin | Update assessment breakdown only |
| `PATCH` | `/topics` | owner/admin | Update weekly topics only |

**POST body schema:**
```typescript
{
  courseCode?:    string (max 50),
  courseTitle:    string (required, max 255),
  creditHours?:   number,
  trimester?:     string,
  description?:   string,
  gradingScale:   'uiu' | 'ugc' | 'custom',
  customScaleJson?: GradingScaleEntry[],
  assessments: Array<{
    categoryName:   string,
    fullMarks:      number (integer, min 1),
    weightPercent:  number (sum of all must = 100),
    totalGiven:     number (integer, min 1),
    bestNCounted:   number (integer, min 1, max = totalGiven),
    displayOrder:   number,
  }>,
  topics?: Array<{
    weekNumber:   number (integer, min 1),
    title:        string,
    description?: string,
  }>
}
```

**Validation:**
- `SUM(weightPercent)` across all assessments must equal 100 (±0.01 tolerance for floating point)
- `bestNCounted <= totalGiven` for each assessment
- Unique week numbers in topics

### 7.3 Business Logic

```typescript
// When AI topic rotation runs for a group:
// 1. Find current ISO week number
// 2. Query course_outline_topics WHERE outline_id = group's outline AND week_number = current_week
// 3. If found → use that topic as AI generation subject
// 4. If not found → fall back to ai_settings.subject
```

### 7.4 Frontend: `CourseOutlineForm.tsx`

- Dynamic rows for assessment breakdown (add/remove categories)
- Real-time validation: weight sum indicator (shows running total, turns red if ≠ 100%)
- "Best N out of M" shown as: `Count best [N input] of [M input] given`
- Weekly topics tab: table with week number + topic title + description
- Preview panel: shows how the gradebook columns will look

---

## 8. Feature 4 — Gradebook

### Purpose
Spreadsheet-style gradebook auto-populated from group members. Faculty enters marks per cell. System auto-calculates "best N of M" averages, totals, percentages, and letter grades using the course outline's grading scale.

### 8.1 Migration: `093_create_academic_lms_tables.ts` (Part A — Gradebook)

```sql
-- Gradebook entries: one row per (student × assessment_category)
CREATE TABLE gradebook_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  university_id   UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_id   UUID NOT NULL REFERENCES course_outline_assessments(id) ON DELETE CASCADE,
  -- assessment_instance: which instance of this assessment (1st CT, 2nd CT, etc.)
  instance_number INTEGER NOT NULL DEFAULT 1,
  marks_obtained  NUMERIC(6,2),      -- NULL = not yet entered
  graded_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  graded_at       TIMESTAMPTZ,
  notes           TEXT,              -- optional faculty note per cell
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, student_id, assessment_id, instance_number)
);

CREATE INDEX gradebook_group_student_idx ON gradebook_entries(group_id, student_id);
CREATE INDEX gradebook_assessment_idx ON gradebook_entries(assessment_id, instance_number);
```

### 8.2 Auto-Population Logic

```typescript
// Trigger: when a user joins an academic group as a member
// In groups/service.ts joinGroup() and acceptJoinRequest():

if (group.type === 'academic') {
  await autoPopulateGradebook(group.id, group.university_id, newMemberId)
}

// autoPopulateGradebook():
// 1. Fetch course outline assessments for this group
// 2. For each assessment, for each instance_number (1..total_given):
//    INSERT INTO gradebook_entries (group_id, university_id, student_id, assessment_id, instance_number)
//    VALUES (...) ON CONFLICT DO NOTHING
// Also run when course outline is first created/updated (for existing members)
```

### 8.3 Best-N Calculation (Server-Side)

```typescript
// Called when returning gradebook data or when student requests grade card

function calculateBestN(marks: (number | null)[], bestN: number): number | null {
  const entered = marks.filter(m => m !== null) as number[]
  if (entered.length === 0) return null
  // Take top N scores, return average
  const sorted = [...entered].sort((a, b) => b - a)
  const top = sorted.slice(0, bestN)
  return top.reduce((sum, m) => sum + m, 0) / top.length
}

// Letter grade calculation per scale:
function getLetterGrade(percentage: number, scale: GradingScale): { letter: string, point: number }
// UIU scale: 90+=A/4.00, 86-89=A-/3.67, 82-85=B+/3.33 ...
// UGC scale: 80+=A+/4.00, 75-79=A/3.75, 70-74=A-/3.50 ...
```

### 8.4 API Endpoints (`/api/v1/groups/:groupId/gradebook`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | owner/admin | Full gradebook: all students × all assessments with calculated columns |
| `PUT` | `/entries` | owner/admin | Bulk upsert marks (faculty enters/edits cells) |
| `GET` | `/me` | member | Student's own grade card |
| `GET` | `/students/:studentId` | owner/admin | Single student's grade card |

**GET `/` response structure:**
```typescript
{
  outline: CourseOutline,
  columns: Array<{
    assessmentId: string,
    categoryName: string,
    instanceNumber: number,
    fullMarks: number,
    label: string,    // e.g., "CT-1", "CT-2", "CT Avg (Best 3/4)"
    isCalculated: boolean,
  }>,
  rows: Array<{
    student: { id, fullName, avatarUrl, department },
    cells: Record<columnKey, { marksObtained: number | null, graded: boolean }>,
    calculated: {
      [categoryName + '_avg']: number | null,  // best-N average per category
      totalObtained: number | null,
      totalFullMarks: number,
      percentage: number | null,
      letterGrade: string | null,
      gradePoint: number | null,
    }
  }>
}
```

**PUT `/entries` body:**
```typescript
{
  entries: Array<{
    studentId: string,
    assessmentId: string,
    instanceNumber: number,
    marksObtained: number | null,
    notes?: string,
  }>
}
```

### 8.5 Frontend: `GradebookPanel.tsx`

- Sticky header row (column names) + sticky first column (student names)
- Editable cells: click to edit, Enter to save, Tab to move to next cell
- Calculated columns (best-N averages, total, grade) shown with distinct background, non-editable
- Color coding: green (≥passing), yellow (borderline), red (failing)
- Export as CSV button (client-side generation)
- Student grade card (`StudentGradeCard.tsx`): shows own row data in card format with progress bars per category

---

## 9. Feature 5 — Modules & Assignments

### 9.1 Migration: `093_create_academic_lms_tables.ts` (Part B — Modules & Assignments)

```sql
-- Course modules
CREATE TABLE academic_group_modules (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  week_number   INTEGER,         -- optional link to course outline week
  display_order INTEGER NOT NULL DEFAULT 1,
  is_published  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assignments
CREATE TABLE academic_assignments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id      UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  module_id     UUID REFERENCES academic_group_modules(id) ON DELETE SET NULL,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  file_urls     JSONB NOT NULL DEFAULT '[]',   -- faculty-attached resources
  -- file_urls shape: [{ name, url, contentType, size }]
  deadline      TIMESTAMPTZ,
  max_score     INTEGER NOT NULL DEFAULT 100,
  is_published  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Student submissions
CREATE TABLE academic_submissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id   UUID NOT NULL REFERENCES academic_assignments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  university_id   UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  file_urls       JSONB NOT NULL DEFAULT '[]',    -- student-submitted files
  text_content    TEXT,
  score           INTEGER,              -- NULL until graded
  feedback        TEXT,
  graded_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graded_at       TIMESTAMPTZ,
  is_late         BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(assignment_id, user_id)
);

CREATE INDEX modules_group_order_idx ON academic_group_modules(group_id, display_order);
CREATE INDEX assignments_group_deadline_idx ON academic_assignments(group_id, deadline);
CREATE INDEX submissions_assignment_idx ON academic_submissions(assignment_id, user_id);
```

### 9.2 File Upload for Assignments

File upload follows the existing presigned URL pattern from `upload.service.ts`:

```
POST /api/v1/groups/:groupId/assignments/upload-url
Body: { fileName: string, contentType: string }
Auth: group member
Response: { uploadUrl: string, publicUrl: string }
Folder: 'academic-assignments'
Max size enforced via: ContentLengthRange [0, 26214400] (25MB) in S3 metadata
```

```
POST /api/v1/groups/:groupId/assignments/:assignmentId/submissions/upload-url
Body: { fileName: string, contentType: string }
Auth: group member (student)
Response: { uploadUrl: string, publicUrl: string }
Folder: 'academic-submissions'
```

### 9.3 API Endpoints

**Modules** (`/api/v1/groups/:groupId/modules`):

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | member | List modules (published only for members; all for admin) |
| `POST` | `/` | owner/admin | Create module |
| `PATCH` | `/:moduleId` | owner/admin | Update module |
| `DELETE` | `/:moduleId` | owner/admin | Delete module |
| `PATCH` | `/reorder` | owner/admin | Reorder modules (body: `{ order: string[] }`) |
| `PATCH` | `/:moduleId/publish` | owner/admin | Toggle `is_published` |

**Assignments** (`/api/v1/groups/:groupId/assignments`):

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | member | List assignments (published only for students) |
| `GET` | `/:assignmentId` | member | Get assignment detail |
| `POST` | `/` | owner/admin | Create assignment |
| `PATCH` | `/:assignmentId` | owner/admin | Update assignment |
| `DELETE` | `/:assignmentId` | owner/admin | Delete assignment |
| `POST` | `/upload-url` | member | Get presigned URL for file |
| `GET` | `/:assignmentId/submissions` | owner/admin | All student submissions |
| `POST` | `/:assignmentId/submit` | member | Student submits |
| `POST` | `/:assignmentId/submissions/upload-url` | member | Get presigned URL for submission file |
| `PATCH` | `/:assignmentId/submissions/:submissionId/grade` | owner/admin | Grade submission |

---

## 10. Feature 6 — AI Settings Panel

### Purpose
Faculty-only panel inside academic group settings to toggle AI features and configure AI preferences. These settings drive what the AI daily scheduler generates.

### 10.1 Data Storage

All stored in `groups.ai_settings` JSONB column (schema defined in Feature 2).

```typescript
// Full ai_settings shape:
{
  ai_flashcards_enabled:  boolean,     // Toggle: AI generates daily flashcard decks
  ai_quiz_enabled:        boolean,     // Toggle: AI posts daily quiz link
  require_approval:       boolean,     // Toggle: drafts before posting
  subject:                string,      // Primary subject (e.g., "Data Structures")
  difficulty:             'beginner' | 'intermediate' | 'advanced',
  question_style:         'mcq' | 'true_false' | 'short_answer' | 'mixed',
  language:               'en' | 'bn',
  custom_instructions:    string,      // Free text, max 1000 chars
  last_ai_post_date:      string,      // ISO date, prevents duplicate daily posts
  pending_deck_id:        string | null, // Deck awaiting faculty approval
  pending_quiz_content:   object | null, // Quiz awaiting faculty approval
}
```

### 10.2 API Endpoints

`PATCH /api/v1/groups/:groupId/ai-settings`
- **Auth:** group owner or admin
- **Guard:** `group.type === 'academic'`
- **Body:** `Partial<AISettings>` (UpdateGroupAISettingsSchema)
- **Response:** Updated `{ aiSettings }`

`GET /api/v1/groups/:groupId/ai-settings/pending`
- **Auth:** group owner or admin
- **Response:** List of pending AI content awaiting approval

`POST /api/v1/groups/:groupId/ai-settings/pending/:contentId/approve`
- **Auth:** group owner or admin
- **Action:** Publishes the pending content (deck/quiz), posts bot message, notifies members

`DELETE /api/v1/groups/:groupId/ai-settings/pending/:contentId`
- **Auth:** group owner or admin
- **Action:** Discards the pending content

### 10.3 Frontend: `AISettingsPanel.tsx`

- Toggle switches with animated transitions for each AI feature
- Expandable preferences section (appears when any toggle is ON)
- Subject field: text input with autocomplete (suggest from existing skill_paths categories)
- Difficulty: segmented control (Beginner / Intermediate / Advanced)
- Question style: checkbox group (MCQ / True-False / Short Answer / Mixed)
- Language: toggle (English / বাংলা)
- Custom instructions: textarea with character counter (1000 max)
- **Pending content inbox**: shows pending AI decks/quizzes with Preview / Approve / Reject actions (only visible when `require_approval = true`)
- Warning banner when AI is enabled but no course outline exists: "Set up your Course Outline for better AI topic targeting"

---

## 11. Feature 7 — Flashcard Restructure

### Purpose
Remove flashcard decks from all non-academic groups permanently. Restrict to academic groups only.

### 11.1 Migration: `091_add_academic_group_type.ts` (Part B — Hard Delete)

```sql
-- Hard delete all flashcard data from non-academic groups
DELETE FROM group_flashcard_reviews
WHERE group_id IN (SELECT id FROM groups WHERE type != 'academic');

DELETE FROM group_flashcards
WHERE group_id IN (SELECT id FROM groups WHERE type != 'academic');

DELETE FROM group_flashcard_decks
WHERE group_id IN (SELECT id FROM groups WHERE type != 'academic');
```

> ⚠️ **Irreversible.** Run only after confirming pre-launch status.

### 11.2 Middleware: `middleware/requireAcademicGroup.ts`

```typescript
export async function requireAcademicGroup(
  req: Request, res: Response, next: NextFunction
) {
  const { groupId } = req.params
  const group = await db('groups')
    .where({ id: groupId, university_id: (req as any).context.universityId })
    .select('type')
    .first()

  if (!group) {
    return res.status(404).json({ error: 'Group not found', code: 'GROUP_NOT_FOUND' })
  }
  if (group.type !== 'academic') {
    return res.status(403).json({
      error: 'Flashcard decks are only available in Academic Groups',
      code: 'ACADEMIC_GROUP_REQUIRED'
    })
  }
  next()
}
```

### 11.3 Router Update: `groups/router.ts`

Apply `requireAcademicGroup` middleware to all 8 flashcard routes:
- `GET /:groupId/flashcard-decks`
- `POST /:groupId/flashcard-decks`
- `PATCH /:groupId/flashcard-decks/:deckId`
- `DELETE /:groupId/flashcard-decks/:deckId`
- `GET /:groupId/flashcard-decks/:deckId/cards`
- `POST /:groupId/flashcard-decks/:deckId/cards`
- `PATCH /:groupId/flashcard-decks/:deckId/cards/:cardId`
- `DELETE /:groupId/flashcard-decks/:deckId/cards/:cardId`
- `POST /:groupId/flashcard-decks/:deckId/cards/:cardId/review`

### 11.4 Frontend Update: `StudyToolsTab.tsx`

```typescript
// When rendering flashcards tab:
{group.type === 'academic' ? (
  <StudyDecksPanel group={group} />
) : (
  <AcademicOnlyNotice
    message="Flashcard decks are available in Academic Groups created by faculty."
    icon="🎓"
  />
)}
```

---

## 12. Feature 8 — AI Daily Scheduler

### Purpose
Automated daily AI content generation and posting. Runs as a Bull queue worker.

### 12.1 New Queue: `queues/ai-content.queue.ts`

```typescript
// Follow same pattern as queues/learning.queue.ts
import Bull from 'bull'
import { env } from '../config/env'

export const aiContentQueue = new Bull('ai-content', {
  redis: env.REDIS_URL,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  },
})
```

### 12.2 New Worker: `workers/ai-content.worker.ts`

```typescript
// Cron: 1 AM UTC daily (quiz generation + learning path draft)
aiContentQueue.add({}, {
  repeat: { cron: '0 1 * * *' },
  jobId: 'ai-daily-quiz-gen',
})

// Cron: 8 AM UTC daily (academic group posting)
aiContentQueue.add({}, {
  repeat: { cron: '0 8 * * *' },
  jobId: 'ai-daily-group-post',
})

aiContentQueue.process(async (job) => {
  if (job.id === 'ai-daily-quiz-gen') {
    await runQuizGeneration()   // see below
  }
  if (job.id === 'ai-daily-group-post') {
    await runGroupPosting()     // see below
  }
})
```

**`runQuizGeneration()`:**
```
For each active university:
  Get distinct departments from profiles
  For each department (with 4s delay between calls):
    Try: generateQuizQuestions({ department, count: 5, ... default options })
    On success: insert to ai_quiz_pool
    On failure: log error, continue
  Weekly (ISO week % 7 === 0):
    Pick category from rotation list
    Try: generateAndSaveAIPath({ category })
    On success: notify admins/faculty of new draft path
```

**`runGroupPosting()`:**
```
Today = current ISO date string
For each academic group WHERE:
  ai_settings->>'ai_flashcards_enabled' = 'true' OR ai_settings->>'ai_quiz_enabled' = 'true'
  AND (ai_settings->>'last_ai_post_date' IS NULL OR != today)
  
  Determine topic:
    current week → query course_outline_topics for this week
    fallback: ai_settings.subject or group.name

  If ai_flashcards_enabled:
    Generate flashcards (10 cards, topic, difficulty, style, language, custom_instructions)
    requireApproval = ai_settings.require_approval

    If requireApproval:
      Insert deck as is_archived = true (hidden)
      Set groups.ai_settings.pending_deck_id = new deck id
      Notify faculty/admin: "New AI deck ready for review"
    Else:
      Insert deck as visible
      Insert bot feed post: "📚 New AI Flashcard Deck: [topic] — [N] cards ready!"
      Notify all members

  If ai_quiz_enabled:
    Insert bot feed post: "🧠 Daily Quiz is live! Test your knowledge on [topic]"
    Link to daily quiz endpoint

  Update groups.ai_settings.last_ai_post_date = today
```

### 12.3 Bot Feed Post

Bot posts using campus bot user. Posts go into `group_posts` (or equivalent) table with:
- `author_id` = campus bot user ID
- `group_id` = academic group ID
- `content` = formatted message with emoji
- `meta` = `{ type: 'ai_daily_content', deck_id: ... }` (for frontend to render special AI post card)

Members receive a group notification via the existing `notificationQueue`.

### 12.4 Rate Limit Guard

```typescript
// Global state per worker process:
let aiCallsThisMinute = 0
let minuteStart = Date.now()

async function rateLimitedAICall<T>(fn: () => Promise<T>): Promise<T> {
  if (Date.now() - minuteStart > 60000) {
    aiCallsThisMinute = 0
    minuteStart = Date.now()
  }
  if (aiCallsThisMinute >= 12) {  // Stay under 15 req/min limit
    await sleep(60000 - (Date.now() - minuteStart) + 1000)
    aiCallsThisMinute = 0
    minuteStart = Date.now()
  }
  aiCallsThisMinute++
  return fn()
}
```

---

## 13. Feature 9 — File Upload in Shared Notes

### Purpose
Allow file attachments on group-wide shared notes (`group_shared_notes`).

### 13.1 Migration: `094_add_note_attachments.ts`

```sql
ALTER TABLE group_shared_notes
  ADD COLUMN attachments JSONB NOT NULL DEFAULT '[]';

-- Attachment shape (validated in schema.ts):
-- [{
--   "name": "lecture1.pdf",
--   "url": "https://cdn.example.com/group-notes/uuid-lecture1.pdf",
--   "contentType": "application/pdf",
--   "size": 5242880
-- }]
```

### 13.2 Schema Update: `groups/schema.ts`

```typescript
export const AttachmentSchema = z.object({
  name:        z.string().max(255),
  url:         z.string().url(),
  contentType: z.string().max(100),
  size:        z.number().int().max(26214400),  // 25MB in bytes
})

// Add to CreateSharedNoteInput and UpdateSharedNoteInput:
attachments: z.array(AttachmentSchema).max(5).optional().default([])
```

**Allowed content types:**
```typescript
const ALLOWED_NOTE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]
```

### 13.3 New Upload URL Endpoint

```
POST /api/v1/groups/:groupId/shared-notes/upload-url
Auth: group member
Body: { fileName: string, contentType: string }
Validation: contentType must be in ALLOWED_NOTE_TYPES
Response: { uploadUrl: string, publicUrl: string }
Folder: 'group-notes'
```

### 13.4 Service Updates: `groups/service.ts`

```typescript
// createSharedNote: persist attachments
// updateSharedNote: merge/replace attachments
// toSharedNote(): add attachments field to return value
```

### 13.5 Frontend: `StudyNotesPanel.tsx`

- Add file drop zone below body textarea
- On drop/select: call upload-url endpoint → PUT to presigned URL → add to `attachments` array in form state
- Show uploaded files as chips with: file type icon, name (truncated), size, remove button
- On note save: include `attachments` in request body
- Render existing note attachments: clickable download links with file type icons

---

## 14. Feature 10 — Per-Session Notes & File Upload

### Purpose
Two-layer notes system inside each study session: creator's official notes (read-only for members, downloadable) + each member's private personal notes (visible only to themselves).

### 14.1 Migration: `095_create_session_notes.ts`

```sql
-- Creator's session notes (public to group members, read-only)
CREATE TABLE group_session_creator_notes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID NOT NULL UNIQUE REFERENCES group_study_sessions(id) ON DELETE CASCADE,
  group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(255),
  body         TEXT,
  attachments  JSONB NOT NULL DEFAULT '[]',   -- [{ name, url, contentType, size }]
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Member private notes (visible only to the member themselves)
CREATE TABLE group_session_member_notes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID NOT NULL REFERENCES group_study_sessions(id) ON DELETE CASCADE,
  group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT,
  attachments  JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, user_id)   -- one private note per member per session
);

CREATE INDEX session_creator_notes_session_idx ON group_session_creator_notes(session_id);
CREATE INDEX session_member_notes_user_idx ON group_session_member_notes(session_id, user_id);
```

### 14.2 API Endpoints (`/api/v1/groups/:groupId/sessions/:sessionId/notes`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/creator` | member | Get session creator's notes (read-only view) |
| `PUT` | `/creator` | session creator only | Create/update creator notes |
| `GET` | `/creator/upload-url` | session creator only | Get presigned URL for creator note files |
| `GET` | `/private` | any member | Get own private notes |
| `PUT` | `/private` | any member | Create/update own private notes |
| `GET` | `/private/upload-url` | any member | Get presigned URL for private note files |

**Creator note guard:** `req.userId === session.created_by`

**Private note isolation:** Always filter by `user_id = req.userId` — no other user can access.

### 14.3 Frontend: `SessionNotesPanel.tsx`

Layout (two-column or tabbed):

```
┌──────────────────────────────────┬─────────────────────────────────┐
│  📋 Session Notes (by Creator)   │  📝 My Private Notes            │
│  [Read-only view]                │  [Editable - only you see this] │
│  [Title]                         │  [Auto-save every 30s]          │
│  [Body text]                     │  [Body text area]               │
│  [Attachments: 📄 📄 📄]         │  [Attachments: 📄]              │
│  [⬇ Download All]                │  [Upload files]                 │
└──────────────────────────────────┴─────────────────────────────────┘
```

- Creator's notes: if no notes yet → show "No session notes posted yet" placeholder
- Creator sees "Edit" button on creator notes panel (others don't)
- Private notes: auto-save with debounce (1.5s); show "Saved ✓" indicator
- "Download All" on creator notes: downloads all attachments as zip (client-side with JSZip) or links individually

---

## 15. Migration Order

Run in this exact sequence:

```
090_create_ai_quiz_pool.ts
091_add_academic_group_type.ts        ← includes hard delete of flashcard data
092_create_course_outline.ts
093_create_academic_lms_tables.ts     ← modules, assignments, submissions, gradebook
094_add_note_attachments.ts
095_create_session_notes.ts
```

---

## 16. Environment Variables

Add to `apps/api/src/config/env.ts` and `.env`:

```bash
# AI
GEMINI_API_KEY=                   # Free from aistudio.google.com
AI_CONTENT_ENABLED=true           # Master switch for AI features
AI_QUIZ_GEN_HOUR=1                # UTC hour for quiz generation cron
AI_GROUP_POST_HOUR=8              # UTC hour for academic group posting cron

# File Upload (already exists — verify these are set)
AWS_S3_BUCKET=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_ENDPOINT=                     # Cloudflare R2 endpoint
AWS_PUBLIC_URL=                   # Public CDN URL
```

---

## 17. Implementation Order

> Dependency-safe implementation sequence. Each phase is independently deployable.

### Phase 1 — Foundation (no breaking changes)
1. Install `@google/generative-ai` in `apps/api`
2. Add `GEMINI_API_KEY` to env.ts
3. Create `services/ai.service.ts`
4. Run migration `090_create_ai_quiz_pool.ts`
5. Create `queues/ai-content.queue.ts`
6. Modify `workers/quiz.worker.ts` to check `ai_quiz_pool` first
7. Create `workers/ai-content.worker.ts` (quiz generation only, group posting disabled)
8. Register new worker in `workers/index.ts`

### Phase 2 — Academic Group Type (breaking for flashcards)
1. Run migration `091_add_academic_group_type.ts` ← **hard deletes flashcard data**
2. Update `groups/schema.ts` (add 'academic', AISettingsSchema)
3. Add faculty guard in `groups/service.ts createGroup()`
4. Create `middleware/requireAcademicGroup.ts`
5. Apply middleware to flashcard routes in `groups/router.ts`
6. Add `PATCH /:groupId/ai-settings` route + handler
7. Update `toGroup()` mapper
8. Frontend: add 'Academic' option to `CreateGroupModal.tsx` (faculty only)
9. Frontend: gate `StudyDecksPanel` in `StudyToolsTab.tsx`

### Phase 3 — Course Outline
1. Run migration `092_create_course_outline.ts`
2. Create `modules/academic/course-outline.service.ts`
3. Add course outline routes to new `modules/academic/router.ts`
4. Frontend: `CourseOutlineForm.tsx` with dynamic assessment rows + weight validator

### Phase 4 — Gradebook
1. Run migration `093_create_academic_lms_tables.ts` (Part A — gradebook)
2. Create `modules/academic/gradebook.service.ts`
3. Add gradebook routes
4. Hook gradebook auto-population into `joinGroup()` and `acceptJoinRequest()`
5. Frontend: `GradebookPanel.tsx` + `StudentGradeCard.tsx`

### Phase 5 — Modules & Assignments
1. Run migration `093` (Part B — modules + assignments, if separate)
2. Create `modules/academic/modules.service.ts` + `assignments.service.ts`
3. Add upload-url endpoints for assignments
4. Frontend: `ModulesPanel.tsx` + `AssignmentsPanel.tsx`

### Phase 6 — AI Settings Panel + Daily Scheduler (Group Posting)
1. Frontend: `AISettingsPanel.tsx`
2. Enable group posting in `ai-content.worker.ts`
3. Implement approval flow: pending content endpoints + faculty approval

### Phase 7 — File Uploads
1. Run migration `094_add_note_attachments.ts`
2. Update `groups/schema.ts` (AttachmentSchema)
3. Add `/shared-notes/upload-url` endpoint
4. Update `createSharedNote` + `updateSharedNote` + `toSharedNote()`
5. Frontend: `StudyNotesPanel.tsx` — drag-drop file zone

### Phase 8 — Per-Session Notes
1. Run migration `095_create_session_notes.ts`
2. Add session notes routes to `groups/router.ts`
3. Add session notes service methods to `groups/service.ts`
4. Frontend: `SessionNotesPanel.tsx` — creator panel + private panel

---

## 18. Testing Strategy

### Unit Tests
- `ai.service.ts`: mock Gemini SDK, test JSON parsing, test retry logic, test fallback
- `calculateBestN()`: edge cases (all nulls, fewer than N entries, all equal)
- `getLetterGrade()`: boundary values for UIU and UGC scales
- `resolveAITopic()`: week matching, fallback chain
- Weight validation: sum = 100 with float tolerance

### Integration Tests
- `POST /groups` with type='academic' as student → 403
- `POST /groups` with type='academic' as faculty → 201
- `GET /:groupId/flashcard-decks` for non-academic group → 403
- `PUT /gradebook/entries` → correct best-N calculation in response
- `POST /shared-notes/upload-url` → valid presigned URL returned
- Join academic group → gradebook rows auto-created

### Manual Smoke Tests
- End-to-end: create academic group → set course outline → add CT assessment → students join → enter CT marks → verify best-N column calculates correctly → student sees grade card
- End-to-end: enable AI flashcards → trigger worker manually → verify deck appears in group + bot post in feed
- Upload file to shared note → verify download link works

---

*Spec complete. See [uniconnect_feature_guide.html](./uniconnect_feature_guide.html) for the visual guide.*
