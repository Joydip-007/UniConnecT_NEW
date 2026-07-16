# Frontend bug report — apps/web

Date: 2026-07-16 · Tool: `react-doctor` full scan (score **47/100**, 13 errors / 853 warnings) + manual verification of every error and security finding. Findings below are only those confirmed by reading the code; false positives are listed at the end.

## High severity

### 1. XSS in resume export (confirmed)
`src/features/profile/components/ResumeExportButton.tsx:158-168` + `buildResumeHtml` (same file, lines ~29-116)

Profile fields (`headline`, experience `title`/`company`/`description`, education fields, skills) are interpolated **unescaped** into an HTML string that is written into a new same-origin window via `win.document.write(html)`. Any user who puts `<script>` or an `onerror` payload in their own experience description gets script execution in the origin of whoever exports a resume containing that data. Even if the button only exports one's own profile today, the data is server-stored and the sink is same-origin.

**Fix:** HTML-escape every interpolated field (single `escapeHtml()` helper), or build the document via DOM APIs / `textContent`.

### 2. Chat pagination: refs mutated during render
`src/features/messages/components/ChatView.tsx:429-430`

```ts
fetchStateRef.current = { hasNextPage: !!hasNextPage, isFetchingNextPage }
fetchNextPageRef.current = fetchNextPage
```

Ref writes in the render body violate render purity — under StrictMode/concurrent rendering React may replay or discard the render, so the IntersectionObserver closure can observe state from a render that never committed (e.g. firing `fetchNextPage` while a fetch is already in flight, duplicating pages).

**Fix:** move both assignments into a `useEffect`.

## Medium severity

### 3. Nested state update inside a state updater
`src/components/ui/RadialOrbitalTimeline.tsx:79`

```ts
setExpanded(prev => { if (prev === null) setAutoRotate(true); return prev })
```

Updater functions must be pure; React may invoke them more than once (StrictMode does), so `setAutoRotate(true)` can fire at unexpected times. **Fix:** read `expanded` via a ref (or functional pattern outside the updater) and call `setAutoRotate` from the timeout body directly.

### 4. Feed keyboard-shortcut listener re-subscribed every render
`src/pages/FeedPage.tsx:66-71` → `src/features/feed/hooks/useFeedShortcuts.ts:82`

`onCompose` / `onToggleHelp` / `onCloseHelp` are new inline functions each render and are effect deps, so the global `keydown` listener is torn down and re-added on every FeedPage render (each keystroke, query update, etc.). Works, but churns and is fragile. **Fix:** wrap the handlers in `useCallback` in FeedPage, or keep them in a ref inside the hook.

### 5. Mutations without query invalidation (12 sites — stale UI risk)
Sites where a mutation lacks `invalidateQueries`/cache update, so the UI can show stale data until a refetch happens:

- `src/components/emoji/StickerDrawer.tsx:53`
- `src/features/content-sync/hooks/useContentSync.ts:47`
- `src/features/feed/components/PostCard.tsx:74`
- `src/features/groups/hooks/useGroupExtended.ts:197`, `:450`
- `src/features/mentorship/components/AlumniView.tsx:39`
- `src/features/mentorship/hooks/useMentorshipOptIn.ts:8`
- `src/features/moderation/hooks/useModeration.ts:55`
- `src/features/settings/hooks/useAccountSettings.ts:41`, `:47`
- `src/features/settings/hooks/useUsername.ts:33`
- `src/pages/AdminPage.tsx:874`

Each needs a case-by-case check — some may intentionally rely on socket events or optimistic updates, but several (settings, username, mentorship opt-in) look like genuine stale-state bugs.

### 6. Height animations forcing layout every frame
`src/components/RightSidebar.tsx:167, 564, 581, 593` — animating `height` (framer-motion) causes full re-layout per frame and visible jank on low-end devices. **Fix:** animate `transform`/`scaleY`, or use the `layout` prop.

## Low severity

- **`src/features/feed/components/CreatePost.tsx:128-130`** — `setTimeout(...focus, 50)` in effect never cleared; harmless today (ref is null-guarded) but leaks a timer if the composer unmounts within 50 ms.
- **`src/features/feed/components/CreatePost.tsx:100-126`** — state reset on `editPost` change done in an effect (`no-adjust-state-on-prop-change`); causes a double render and can flash stale composer content. Prefer a `key` on the composer or the "previous-prop" render-time pattern.
- **`src/features/feed/components/CreatePost.tsx:37`** — 11 related `useState` values; consolidate with `useReducer` to prevent inconsistent partial resets (the effect above already juggles 6 setters).
- **`no-array-index-as-key` (13 sites)** — most are static lists (OTP boxes, skeletons) and fine; the ones worth fixing are reorderable/mutable lists: `MediaGrid.tsx:32/60/93` (photos can be removed → wrong preview retained) and `StudyNotesPanel.tsx:143`.
- **Derived `useState` from props** — `JobCard.tsx:113-114`, `GroupResultCard.tsx:29-30`: state seeded from props won't update when the query refetches; compute during render or key the component.
- **`ConnectionRequestModal.tsx:28`** — effect chain (`no-effect-chain`); one state change triggers an effect that sets more state.

## Verified false positives (no action)

- `FeedLayout.tsx:45` (timer "without cleanup") — cleared in a separate unmount effect (`:54-58`).
- `AboutStory.tsx:35` (subscription "without cleanup") — cleanup returns `unsubscribeScroll`, removes listener, cancels rAF (`:79-83`).
- `ExplorePage.tsx:187` ("privileged action from URL") — values are search filters (`q`, `tab`, `role`), not privileged actions.

## Not investigated in depth (bulk warnings)

866 total findings; the bulk are style/maintainability: 393× inline style objects rebuilt per render (145 files), 228 accessibility warnings (mostly missing labels/key handlers, 58× `button` without `type`), 83× tiny text. These are migration-scale sweeps — fix a sample per family and confirm before mass-applying (react-doctor's own guidance).

## Fix status (2026-07-16)

Fixed and verified (typecheck + lint + web tests pass; 5 failures in LearningAdminPanel / ContentSyncPanel / useCountUp are pre-existing on a clean tree):

1. ✅ ResumeExportButton XSS — all interpolated fields HTML-escaped (`esc`/`escMultiline`), link hrefs restricted to `http(s)` (`safeHref`)
2. ✅ ChatView ref-in-render — moved into `useEffect`
3. ✅ RadialOrbitalTimeline impure updater — reads `expandedRef` instead of nesting `setAutoRotate` in an updater
4. ✅ FeedPage shortcut handlers wrapped in `useCallback` (listener no longer re-subscribed every render)
5. ✅ CreatePost focus timer now cleaned up
6. ✅ Mutation fixes: `useChangePassword` invalidates sessions, `useUpdateUsername` invalidates `['user', id]`, `AlumniView` maxMentees now rolls back on error, `AddDriverPanel` invalidates `['admin','users']`, `useBackfillAttachments` invalidates runs
   - Intentional patterns left alone: StickerDrawer share ping, PollBlock optimistic vote, `useTrackResource` (fire-and-forget), `useReport`, `useMentorshipOptIn` (has rollback)

Still open:

- RightSidebar `height` animations (4 sites) — design-sensitive; needs a visual pass
- CreatePost state consolidation (`useReducer` / key-based reset)
- Index-as-key on MediaGrid / StudyNotesPanel; prop-derived state in JobCard / GroupResultCard
- Bulk a11y/style warning sweeps
