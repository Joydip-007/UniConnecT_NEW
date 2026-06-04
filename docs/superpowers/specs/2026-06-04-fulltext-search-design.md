# Postgres Full-Text Search — Design Spec

**Date:** 2026-06-04
**Status:** Draft design, pre-implementation
**Scope:** Upgrade the unified search relevance from substring `ILIKE` matching to Postgres full-text search (`tsvector` / `tsquery`) with weighted ranking, keeping the existing pg_trgm trigram indexes as a typo-tolerant fallback. Pure relevance upgrade — the search API contract and result shapes are unchanged.

> Sub-project 5 of the 6-feature decomposition. Builds on the existing `search` module ([2026-05-16 search feature](2026-05-16-search-feature-design.md)) which searches People · Posts · Jobs · Events · Groups via `full_name ILIKE '%q%'` accelerated by the trigram GIN indexes in migration `024_add_trgm_search_indexes`.

---

## 1. Goals

1. Replace `ILIKE '%q%'` substring matching with **ranked full-text search**: multi-word queries match any/all terms, results ordered by relevance (`ts_rank_cd`) instead of arbitrary order.
2. **Weighted fields** — a name/title hit outranks a body/description hit.
3. **Typo tolerance** — keep the existing trigram indexes as a fallback when FTS returns too few results (handles misspellings FTS can't).
4. Zero API contract change — same endpoints, same response shapes, same filters/pagination/connection-status. Relevance only gets better.

Non-goals: cross-entity unified ranking (each entity type stays its own ranked list, as today), search-as-you-type/autocomplete (noted as optional stretch), synonyms/thesaurus, search analytics & history, external search engines (Elastic/Meilisearch) — Postgres only.

---

## 2. Decisions log

| Decision | Choice |
|---|---|
| Engine | **Postgres FTS** (`tsvector`/`tsquery`) — no external search service |
| Vector storage | **Generated `search_vector` columns** (`GENERATED ALWAYS AS … STORED`) — always consistent, no trigger drift |
| Query parser | `websearch_to_tsquery` — supports quoted phrases, `OR`, `-exclude` naturally and never errors on user input |
| Dictionary | `'english'` for prose (post content, descriptions); `'simple'` for names/titles (avoid stemming proper nouns) |
| Ranking | `ts_rank_cd(search_vector, query)` desc, with `setweight` (A = name/title, B = secondary fields) |
| Fuzzy fallback | Keep pg_trgm; when FTS yields `< MIN_RESULTS`, supplement with `similarity()` matches above a threshold |
| API contract | **Unchanged** — same routes/shapes; relevance ordering replaces the prior order |
| Highlighting | `ts_headline` snippets for post results — optional, nice-to-have |

---

## 3. Searchable fields & weights

| Entity | Vector source (weight) | Dictionary |
|---|---|---|
| `profiles` | `full_name` (A), `headline` (B), `department` (B), `bio` (C) | `simple` (name) blended with `english` (bio) |
| `posts` | `content` (A) | `english` |
| `jobs` | `title` (A), `company` (A), `location` (B), `description` (C) | `english` |
| `events` | `title` (A), `location` (B), `description` (C) | `english` |
| `groups` | `name` (A), `description` (B) | `english` |

For `profiles.skills` (`text[]`), include `array_to_string(skills, ' ')` at weight B in the generated expression.

> Mixed-dictionary columns: build the generated `tsvector` by concatenating `setweight(to_tsvector('simple', coalesce(full_name,'')), 'A')` and `setweight(to_tsvector('english', coalesce(bio,'')), 'C')`, etc. All inputs `coalesce`d to `''` so the expression is immutable/non-null (required for a generated column).

---

## 4. Data model

### 4.1 Migration `072_add_search_vectors.ts`

Add a generated `search_vector tsvector` column + GIN index per searchable table. Example (profiles):

```sql
ALTER TABLE profiles ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple',  coalesce(full_name,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(headline,'')),  'B') ||
    setweight(to_tsvector('english', coalesce(department,'')),'B') ||
    setweight(to_tsvector('english', coalesce(bio,'')),       'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(skills,' '),'')), 'B')
  ) STORED;

CREATE INDEX idx_profiles_search_vector ON profiles USING GIN (search_vector);
```

Repeat for `posts`, `jobs`, `events`, `groups` with their §3 field maps.

- **Keep** the existing trigram GIN indexes from migration `024` — they back the fuzzy fallback.
- `down()` drops the new columns + indexes.

> Generated columns require Postgres 12+ (Neon is current — fine). Confirm the next free migration number at implementation (latest committed is `067`).

---

## 5. Backend (`search` module)

No new endpoints, no schema/router changes to the contract. The per-entity service functions (`searchPeople`, `searchPosts`, `searchJobs`, `searchEvents`, `searchGroups`) change their matching + ordering:

### 5.1 Primary FTS path

Replace the `whereRaw('… ILIKE ?', ['%q%'])` clauses with:

```sql
WHERE search_vector @@ websearch_to_tsquery('english', :q)
ORDER BY ts_rank_cd(search_vector, websearch_to_tsquery('english', :q)) DESC, created_at DESC
```

- Existing filters (role/department/batch for people; etc.) and `university_id` scoping are AND-ed on as before.
- Connection-status join (People), `myRsvp` (Events), `isMember` (Groups) etc. are unchanged.
- Pagination/`hasMore` via the existing `paginate()` helper; total count uses the same `@@` predicate.

### 5.2 Fuzzy fallback

When the FTS path returns fewer than `MIN_RESULTS` (e.g. 5) on page 1, supplement with trigram matches:

```sql
WHERE <primary_text_field> % :q            -- pg_trgm similarity operator
  AND id NOT IN (<already-matched ids>)
ORDER BY similarity(<primary_text_field>, :q) DESC
```

Append fuzzy matches after exact FTS matches (clearly ranked below). This recovers misspelled queries ("Aliya" → "Alia") that FTS alone misses. Centralise `MIN_RESULTS` and the `similarity` threshold in a config constant. Fallback is a single extra query, only fired when needed.

### 5.3 Short / empty queries

- Empty `q` ⇒ existing filter-only behaviour (e.g. People by department) — unchanged.
- 1–2 char `q` ⇒ skip FTS (poor signal), go straight to trigram prefix matching as today.

### 5.4 Highlighting (optional)

For post results, add `ts_headline('english', content, query, 'MaxFragments=1, MinWords=5, MaxWords=20')` as a `snippet` field. Mark optional — only if it doesn't complicate the shared `PostSearchResult` type meaningfully (additive, nullable).

---

## 6. Shared package additions (`packages/shared`)

- `src/constants/search.ts` (extend, if present) — `SEARCH_MIN_RESULTS_BEFORE_FUZZY`, `SEARCH_TRGM_THRESHOLD`.
- No schema contract change. If the optional `snippet` field ships, add it as `snippet?: string` to `PostSearchResult` only.

---

## 7. Frontend (`apps/web`)

- **None required** — the search UI calls the same endpoints and renders the same shapes; users simply get better-ordered results.
- Optional: render the `snippet` (with `<mark>` highlights) on post results if §5.4 ships. Sanitise/escape the headline output.

---

## 8. Multi-tenancy & security

- Every search query keeps its `university_id = req.university.id` scope — FTS adds a predicate, never removes the tenant filter.
- `websearch_to_tsquery` is injection-safe and never throws on arbitrary user input (a key reason over `to_tsquery`), so no query-syntax errors leak to users.
- Discoverability/privacy: People search must continue to honour the `discoverable` flag and exclude deactivated/blocked authors per the [privacy spec](2026-06-04-profile-privacy-controls-design.md) — the FTS predicate is AND-ed *with* those filters, not instead of them.

---

## 9. Testing

**API (integration, supertest + `x-university-domain`):**
- Multi-word query ranks a full-name match above a bio-only match (weighting works).
- Word-order independence: "computer science" matches "Science, Computer …" via FTS where the old `ILIKE` would not.
- Relevance order: higher `ts_rank_cd` first.
- Fuzzy fallback: a one-character typo still returns the intended person when FTS alone returns `< MIN_RESULTS`.
- Filters still AND correctly (role + department + q).
- `university_id` isolation preserved; private/deactivated/non-discoverable profiles excluded.
- Empty and 1–2 char queries behave as before.

**Web:** unchanged behaviour; if snippets ship, assert highlighted fragment renders and is escaped.

---

## 10. Risks & open items

- **Generated-column immutability** — every input must be `coalesce`d and use immutable functions; `array_to_string` + `to_tsvector('regconfig', …)` are immutable, but verify the exact expression compiles on Neon's Postgres version before finalising the migration.
- **Index build on large tables** — adding a STORED generated column rewrites the table; `posts` could be large. Plan the migration for low-traffic deploy, or build `CONCURRENTLY` where the migration framework allows (generated columns can't be added concurrently — note the table-rewrite cost; acceptable at current scale, revisit if volume grows).
- **Dictionary choice for names** — `'simple'` avoids mangling proper nouns; revisit if stemming is ever wanted for headlines/bios (already `'english'`).
- **Fuzzy vs FTS ranking blend** — keeping fuzzy results strictly *after* exact matches is the simple, predictable choice; a unified score blend is a future refinement.
- **Migration number** — confirm next free `NNN` (latest committed is `067`).

---

## 11. Out of scope (future specs)

Autocomplete / search-as-you-type · synonyms & thesaurus · cross-entity unified ranking · search analytics & saved searches · external search engines (Elasticsearch/Meilisearch) · semantic / vector search.
