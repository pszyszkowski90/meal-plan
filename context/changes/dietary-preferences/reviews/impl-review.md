<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Preferencje żywieniowe — Faza 1: Schemat i granica danych

- **Plan**: `context/changes/dietary-preferences/plan.md`
- **Scope**: Full plan (CI review on PR #8) — Phase 1 only, Phase 2 is not part of this diff
- **Date**: 2026-09-13
- **CI run**: https://github.com/pszyszkowski90/meal-plan/actions/runs/34782928032
- **Verdict**: REJECTED
- **Findings**: 1 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Test Coverage | FAIL |
| Success Criteria | WARNING |

## Findings

### F1 — `listAllowedDishes`, the phase's core deliverable, has zero committed automated test

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; the repo has no established pattern for D1-integration tests yet
- **Dimension**: Test Coverage
- **Location**: `src/server/repository/preferences.ts:238` (`listAllowedDishes`)
- **Detail**: The plan states the explicit purpose of this function: *"Cel: udowodnić, że model wykluczeń działa — zanim S-04 na nim stanie"* (prove the exclusion model works before the plan generator depends on it), and Phase 1's Progress section marks criteria 1.7, 1.8, 1.9 — ingredient-id matching (not name matching), group-level filtering without naming the excluded ingredient, and query-time expansion for ingredients added to a group *after* the exclusion was saved — as `[x]` under `#### Automated` at commit `76c1128`.

  `grep -rn listAllowedDishes src/ tests/` returns only the function's own definition — no test file references it, directly or indirectly. `tests/e2e/preferences-api.spec.ts:12-15` explicitly documents the gap: *"Czego tu ŚWIADOMIE nie ma: wykluczeń wskazujących istniejący składnik... Zachowanie odsiewu przy realnych składnikach jest sprawdzone na poziomie bazy — patrz wpis C3 w `notes/cert-queue.md`."* That log entry (`notes/cert-queue.md`, C3 section) confirms criteria 1.7-1.9 were *"dowiedzione na lokalnej D1 zapytaniem WYGENEROWANYM Z MODUŁU REPOZYTORIUM"* — proven once via an ad hoc local `wrangler d1 execute` query built from the repository module's SQL, then discarded. That is a one-off manual check, not a repeatable automated test, yet it is checked off in the `#### Automated` subsection rather than `#### Manual`.

  Net effect: the single behavior this phase exists to validate has no regression protection. If a future change to the `JOIN`/`NOT EXISTS` logic in `listAllowedDishes` breaks ingredient-id matching or group expansion, nothing in `npm test`, the E2E suite, or CI would catch it — and S-04 (the plan generator) is slated to build directly on this function next.

  Mitigating context: `ingredient`/`dish` are currently empty in this environment (seed pool lands in F-01 phases 2-4), so the E2E spec's decision to defer real-data testing is reasonable on its face — but the checklist should reflect that as pending/manual, not as a closed automated criterion, and a lightweight fixture-based test is achievable today without waiting for the real seed pool.
- **Fix**: Add a fixture-seeded test proving the three documented scenarios against a real D1 instance rather than relying on validated-by-hand evidence.
  - Strength: Directly closes the gap the plan itself calls the phase's reason for existing; a regression in this function would otherwise ship silently into S-04.
  - Tradeoff: The repo has no precedent yet for a D1-integration test (unit tests are pure-`src/lib/` only per `npm test`'s `node --test` scope, and Playwright E2E runs against a full `wrangler dev` server) — this requires picking or establishing that pattern, which is more than a one-line change.
  - Confidence: HIGH — confirmed directly via `grep`, reading `preferences-api.spec.ts`, and `notes/cert-queue.md`'s own account of how 1.7-1.9 were verified.
  - Blind spot: Whether a fast, low-ceremony way to seed local D1 for a single test already exists elsewhere in the repo (e.g. a fixture helper used by E2E) was not fully explored — worth checking before building new infrastructure.
- **Decision**: PENDING

### F2 — DB-level `CHECK` and uniqueness constraints (criteria 1.2, 1.3) are also only proven by hand

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — worth pausing, but lower stakes than F1 since these are static SQL constraints unlikely to be touched incidentally
- **Dimension**: Test Coverage
- **Location**: `migrations/0005_preferences.sql` (consistency `CHECK`), `src/server/repository/preferences.ts:166` (`replaceExclusions`, `idx_exclusion_unique` + `INSERT OR IGNORE`)
- **Detail**: `preferences.test.ts` and the E2E "kind niezgodny" case both exercise `validatePreferences` at the application layer, which intercepts inconsistent `kind`/id combinations and duplicate entries *before* they reach SQL. The actual SQLite `CHECK` constraint and the `idx_exclusion_unique` index are therefore never invoked by any committed test — only by the same one-off manual D1 query referenced in F1.
- **Fix**: Extend whatever fixture mechanism is built for F1 to also attempt a raw `INSERT` that violates the consistency `CHECK` directly (bypassing `validatePreferences`) and assert the DB rejects it, and to call `replaceExclusions` twice with the same entry and assert only one row survives.
- **Decision**: PENDING

### F3 — `PUT /api/preferences` is not atomic across `savePreferences` and `replaceExclusions`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff, narrow blast radius
- **Dimension**: Safety & Quality (data safety)
- **Location**: `src/app/api/preferences+api.ts:143-144`
- **Detail**: `savePreferences()` (line 143) commits its own D1 write and returns before `replaceExclusions()` (line 144) runs. `replaceExclusions` internally batches its own delete+insert atomically (confirmed in `src/server/repository/preferences.ts:166-190`), but the two calls are not wrapped together. If `replaceExclusions` throws — e.g. the "dangling identifier" case already covered by `tests/e2e/preferences-api.spec.ts` ("wykluczenie wskazujące nieistniejący byt to 400, nie 500") — the route returns 400 as if nothing was saved, but `maxPrepMinutes`/`mealsPerDay` from that same request are already persisted. A user resubmitting after fixing the bad exclusion has no way to know their preference numbers already changed.

  The code comment at lines 140-142 justifies this ordering by describing a *different* failure mode (exclusions saved, preferences FK fails) that cannot actually happen here, since `ensureAppUser` (line 138) already guarantees the FK `savePreferences` depends on. The real remaining risk is the one described above, in the opposite direction.
- **Fix**: Fold both writes into a single `db.batch()` call (the same primitive `replaceExclusions` already uses) so the whole `PUT` commits or fails as one unit.
  - Strength: Matches the atomicity guarantee `replaceExclusions` already provides internally; removes the partial-write class entirely.
  - Tradeoff: `savePreferences` currently uses `RETURNING` to hand back the updated row directly — folding it into a `batch()` call means restructuring how the updated preferences row is obtained (batch statements don't all support `RETURNING` result consumption the same way as a standalone `.first()` call), so this is a small but non-trivial refactor of `savePreferences`/`replaceExclusions`, not a one-liner.
  - Confidence: MEDIUM — the failure mode itself is confirmed by reading the code; the exact batch-API refactor wasn't attempted, so there may be a cleaner path.
  - Blind spot: Whether the read-after-write pattern in `savePreferences` can be preserved cleanly inside `db.batch()` semantics wasn't verified against D1's actual API.
- **Decision**: PENDING

### F4 — `foreignKeyViolation()` detects D1 errors via a fragile string match

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick to note, not urgent
- **Dimension**: Safety & Quality (reliability)
- **Location**: `src/app/api/preferences+api.ts:76-78`
- **Detail**: `foreignKeyViolation()` matches `/FOREIGN KEY constraint failed/i` against `error.message`. If a future D1/workerd version changes its error message format, this silently degrades a legitimate 400 (dangling ingredient/dish/group id) into a generic 500, and nothing in the test suite would catch the regression since the check is entirely string-based.
- **Fix**: Low risk today — worth a one-line comment noting the coupling to D1's current error format, or a follow-up ticket rather than a blocking change here.
- **Decision**: PENDING

## Findings without a line anchor

None — all findings above anchor to lines present in the diff.

## Cross-checks that came back clean

- **Migration (`migrations/0005_preferences.sql` + down pair)**: `max_prep_minutes` range (5-240) is correctly kept out of SQL `CHECK` and lives in `src/lib/preferences.ts` instead — matches the explicit precedent the plan cites (`migrations/0002_user_profile.sql:29-34`). `meals_per_day` keeps its enumeration `CHECK`. The unique index genuinely uses `COALESCE` on all three nullable id columns rather than a plain tuple `UNIQUE`. `ingredient_group` has both its composite `PRIMARY KEY(ingredient_id, group_id)` and a separate index on `group_id` alone. Down-migration drops in FK-safe order and removes the `d1_migrations` bookkeeping row, matching the `0002` precedent.
- **Repository/route shape**: `src/server/repository/preferences.ts` and `src/app/api/preferences+api.ts` match `user-profile.ts`/`profile+api.ts` one-to-one — `requireUserId` inside `try`, repository-only `prepare(`/SQL, every query filtered by `userId`, `Cache-Control: no-store`, error logs excluding `userId` and request body. The PR goes *beyond* the reference pattern by translating FK violations to 400 instead of 500 (`profile+api.ts` doesn't do this) — a deliberate, justified improvement, not drift.
- **`src/server/env.ts` (+10, unlisted in the plan's Phase 1 file list)**: adds a typed `batch()` method to the `D1Database` interface, required for `replaceExclusions`'s atomic delete+insert. `globalThis` access remains confined to this one file — no new touchpoint introduced elsewhere. Justified, minimal, correctly scoped even though not named explicitly in the plan.
- **`listAllowedDishes` query logic** (read, not test-verified — see F1): filters by `ingredient_id`/`dish_id` via `JOIN`/`NOT EXISTS`, never by name; group exclusions expand via a live join against `ingredient_group` inside the same query, not a write-time snapshot; a missing `user_preferences` row correctly falls back to "no limit" via `COALESCE`, not zero minutes.
- **401/no-store coverage**: `tests/e2e/preferences-api.spec.ts` and the extended `tests/e2e/data-boundary.spec.ts` (`/api/preferences` added to `DataRoutes`, plus a dedicated unauthenticated-`PUT`-doesn't-save test) cover unauthenticated/forged-token access and cache-control correctly.
- **Cross-account isolation (criterion 1.6)**: correctly left as `BLOCKED-MANUAL` in the plan's own Progress tracking — a second test account doesn't exist yet, same blocker as S-02's 2.9. Not treated as a gap by this review.

## Environment limitations (read before treating Success Criteria as fully checked)

This review ran in a sandboxed CI environment where `npm ci`, `npx`, and `git fetch` all required interactive approval that was never grantable — `node_modules` is absent and none of `npx tsc --noEmit`, `npm test`, or `npx expo lint` could be executed here. **Success Criteria verdict is WARNING, not a confirmed PASS, for this reason**: this review could not independently reproduce the "tsc/npm test/expo lint czyste" and "E2E 33/33" claims recorded in `notes/cert-queue.md` and `plan.md`'s Progress checklist (1.10) — they are taken on the author's word, consistent with the rest of the evidence gathered, but unverified by this run. If the repo's actual CI quality-gate workflow (`quality-gate.yml`) is green on this PR, that is stronger evidence than this review could produce on its own.

<!-- End of report -->
