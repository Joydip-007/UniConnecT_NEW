# Admin Controls for New Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add administrative and moderation capabilities for the newly implemented Daily Quiz and Study Groups 2.0 features.

**Architecture:** 
- **Backend:** Extend the existing `admin` module (`apps/api/src/modules/admin/`) with routes to fetch and manage quizzes, flashcard decks, and shared notes.
- **Frontend:** Extend the `AdminPage.tsx` by adding two new tabs: `QuizTab` (for managing and manually triggering daily quizzes) and `StudyAssetsTab` (for moderating flashcard decks and notes).

**Tech Stack:** Express, PostgreSQL (Kysely), React, TanStack Query, Lucide React.

## User Review Required

> [!IMPORTANT]
> - Do we want the ability to manually trigger quiz generation from the admin panel (in case the CRON job fails), or just the ability to view/delete existing quizzes?
> - For Study Groups moderation, should we support deleting individual flashcards, or is deleting the entire deck sufficient for moderation purposes?

---

### Task 1: API Admin Routes for Daily Quiz

**Files:**
- Modify: `apps/api/src/modules/admin/router.ts`
- Modify: `apps/api/src/modules/admin/controller.ts`
- Modify: `apps/api/src/modules/admin/schema.ts`

**Step 1: Write schemas**
Add `PaginationQuerySchema` usage for listing quizzes. Add schema for manual generation request.

**Step 2: Add controller methods**
- `listQuizzes`: fetches paginated `daily_quiz_slots` with questions.
- `triggerQuizGeneration`: manually calls the existing AI service to generate a quiz for a date.
- `deleteQuiz`: deletes a quiz slot.

**Step 3: Register routes**
- `GET /admin/quiz`
- `POST /admin/quiz/generate`
- `DELETE /admin/quiz/:id`

**Step 4: Commit**
```bash
git add apps/api/src/modules/admin/router.ts apps/api/src/modules/admin/controller.ts apps/api/src/modules/admin/schema.ts
git commit -m "feat(api): add admin routes for daily quiz management"
```

### Task 2: API Admin Routes for Study Groups

**Files:**
- Modify: `apps/api/src/modules/admin/router.ts`
- Modify: `apps/api/src/modules/admin/controller.ts`

**Step 1: Add controller methods**
- `listStudyAssets`: fetches paginated `group_flashcard_decks` and `group_shared_notes`.
- `deleteStudyAsset`: deletes a specified deck or note by ID.

**Step 2: Register routes**
- `GET /admin/study-assets/:type` (type = 'decks' | 'notes')
- `DELETE /admin/study-assets/:type/:id`

**Step 3: Commit**
```bash
git add apps/api/src/modules/admin/router.ts apps/api/src/modules/admin/controller.ts
git commit -m "feat(api): add admin routes for study groups moderation"
```

### Task 3: Web Admin UI for Daily Quiz

**Files:**
- Modify: `apps/web/src/pages/AdminPage.tsx`
- Create: `apps/web/src/pages/admin/QuizTab.tsx`

**Step 1: Create QuizTab**
Build a paginated list/table to display recent quizzes and their questions. Add a "Generate Quiz for Today" button.

**Step 2: Wire to AdminPage**
Import `QuizTab` and add a new 'Quiz' option to the `TABS` array in `AdminPage.tsx`.

**Step 3: Commit**
```bash
git add apps/web/src/pages/AdminPage.tsx apps/web/src/pages/admin/QuizTab.tsx
git commit -m "feat(web): add daily quiz admin ui"
```

### Task 4: Web Admin UI for Study Groups

**Files:**
- Modify: `apps/web/src/pages/AdminPage.tsx`
- Create: `apps/web/src/pages/admin/StudyAssetsTab.tsx`

**Step 1: Create StudyAssetsTab**
Build a paginated list for Decks and Notes. Add delete buttons for moderation.

**Step 2: Wire to AdminPage**
Import `StudyAssetsTab` and add a new 'Study Tools' option to the `TABS` array.

**Step 3: Commit**
```bash
git add apps/web/src/pages/AdminPage.tsx apps/web/src/pages/admin/StudyAssetsTab.tsx
git commit -m "feat(web): add study groups admin ui"
```
