<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Preferencje żywieniowe — Faza 2: Ekran preferencji

- **Plan**: `context/changes/dietary-preferences/plan.md`
- **Scope**: Full plan (CI review on PR #10) — Phase 2 only, Phase 1 was reviewed separately (PR #8)
- **Date**: 2026-09-13
- **CI run**: https://github.com/pszyszkowski90/meal-plan/actions/runs/34785096943
- **Verdict**: REJECTED — **ustalenia rozliczone 14.09.2026**, patrz pola `Decision`
- **Findings**: 1 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Test Coverage | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Save is not gated on initial load, so a fast user can silently wipe their saved exclusions

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — the fix is a narrowly-scoped guard clause, safe to apply directly
- **Dimension**: Safety & Quality (data safety)
- **Location**: `src/app/(app)/preferences.tsx:248` (`handleSave`) and `:486` (`<ActionButton onPress={handleSave} busy={saving} />`)
- **Detail**: `entries` initializes to `[]` (line 78) and only gets populated from the server once the initial `GET /api/preferences` resolves and the `touched` guard is still `false` (lines 90–137). `validatePreferences` treats an empty exclusion array as valid — there is no "at least one exclusion" requirement — so as soon as `maxPrepMinutes` and `mealsPerDay` are filled in, `validation.ok` is `true` regardless of whether the exclusions GET has completed.

  `ActionButton` (`src/components/ui/action-button.tsx:32`) only disables on `busy` (`saving`), never on `load.kind !== 'ready'`, and `handleSave` (line 248) has no check on `load` at all. A user who types the prep-time and picks a meal count *before* the initial fetch resolves — plausible on a slow connection, exactly the kind of timing this plan already worries about for the read path (the `touched` guard) — can click "Zapisz" and `PUT` with `exclusions: []`.

  Server-side, `PUT` (`src/app/api/preferences+api.ts:104-142`) always calls `replaceExclusions(auth.userId, validation.value.exclusions)` unconditionally. `replaceExclusions` (`src/server/repository/preferences.ts:168-192`) deletes every existing `source = 'preferences'` row for the account and reinserts whatever list it was given — there is no way for the server to distinguish "the user genuinely wants zero exclusions" from "the form hadn't loaded the existing ones yet." The result is a silent, complete loss of a user's saved exclusion list — data the code's own comments (`src/server/repository/preferences.ts:1-14`, `src/app/api/preferences+api.ts:44-48`) describe as capable of encoding health or religious information.

  This is a materially new risk versus the `profile.tsx` pattern this screen is modeled on: `profile.tsx`'s required fields make an accidental complete-and-submit before load unlikely, but here only two of the three pieces of form state (`maxPrepMinutes`, `mealsPerDay`) need to be filled for `validation.ok` to pass, while the third (`exclusions`) silently defaults to "empty is fine."
- **Fix**: Block `handleSave` (or disable `ActionButton`) while `load.kind !== 'ready'`.
  - Example: `if (load.kind !== 'ready') { return; }` at the top of `handleSave`, mirroring the existing early-return-on-invalid pattern immediately below it.
- **Decision**: NAPRAWIONE 14.09.2026 (`be62b08`) — **ale nie tak, jak proponowało ustalenie**.
  Sama klauzula `if (load.kind !== 'ready') return;` została napisana i test odtwarzający utratę
  danych **nadal był czerwony**: bramkowanie zapisu zamyka wyłącznie okno PRZED zakończeniem
  pobrania, a po nim lista jest pusta tak samo, bo wspólny strażnik `touched` zablokował jej
  zastosowanie. Prawdziwą przyczyną był JEDEN strażnik na dwa niezależne byty. Rozdzielony na
  `touchedPreferences` i `touchedExclusions`; bramkowanie stanem pobrania zostało jako druga
  warstwa, rozszerzona o `offline` i `error`, w których też nie wiadomo, co jest w bazie.
  Test regresyjny sprawdza własność, nie mechanizm, i był czerwony przed naprawą.

### F2 — `TextField`'s doc comment claims `aria-errormessage` closes the error loop, but the attribute is never set

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — one attribute to add or one sentence to correct
- **Dimension**: Pattern Consistency
- **Location**: `src/components/ui/text-field.tsx:30` (comment) vs. `:44-46` (implementation)
- **Detail**: The doc comment states *"`aria-invalid` i `aria-errormessage` domykają błąd"* (both attributes close the loop on the error state), but the JSX only sets `aria-invalid={error ? true : undefined}` (line 46) — `aria-errormessage` is not set anywhere in the file or in any caller. A screen reader on web can tell the field is invalid but has no programmatic link to the specific error text rendered below it (line 56-60), so the error message is only available visually, not to assistive tech. This is a narrower gap than it looks: the plan's literal Phase 2 contract also called for `id` + `aria-labelledby`/`aria-describedby` (`plan.md:208-211`), and the actual implementation uses a simpler `aria-label` scheme throughout instead — which is a reasonable, documented simplification that still satisfies criterion 2.8 (`getByRole` addressability), but the error-association piece of that simplification was dropped without updating the comment that describes it.
- **Fix**: Add `aria-errormessage` wired to a stable `id` on the rendered error `ThemedText`, or, if the simpler scheme is intentional, correct the comment to stop claiming an association that doesn't exist.
- **Decision**: NAPRAWIONE 14.09.2026 — wybrano implementację, nie korektę komentarza.
  `TextField` ustawia `aria-errormessage` wskazujące element z treścią błędu (`useId()`, bo
  prymityw nie wie, ile razy wystąpi na ekranie), a obok `aria-describedby`, bo wsparcie dla
  `aria-errormessage` w czytnikach ekranu jest do dziś nierówne. Pokryte testem, który celuje
  w pole PRZEZ TO POWIĄZANIE.

### F3 — No test proves a group exclusion survives removal + reload

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — one test case, mirrors an existing one in the same file
- **Dimension**: Test Coverage
- **Location**: `tests/e2e/preferences-screen.spec.ts` (missing case) / `src/app/(app)/preferences.tsx:201-214` (`toggleGroup`)
- **Detail**: `preferences-screen.spec.ts` has a dedicated test for ingredient-exclusion removal surviving reload ("usunięcie wykluczenia też przeżywa przeładowanie", lines 78-97), but `toggleGroup` — the group-kind removal path exercised by clicking a checked "grzyby" chip again — has no equivalent. Criterion 2.5 ("wykluczenie przeżywa zapis i przeładowanie") is proven for add, and for ingredient-kind remove, but not for group-kind remove.
- **Fix**: Add a case that checks the group chip, saves, reloads (confirming it persisted — already partially covered by the existing 2.5 test), then unchecks it, saves, reloads, and asserts the chip is unchecked again.
- **Decision**: NAPRAWIONE 14.09.2026 — test `F3 usunięcie wykluczenia GRUPOWEGO też przeżywa
  przeładowanie`. Sprawdza też, że chip wraca do `aria-checked="false"` — inaczej ekran kłamałby
  o tym, co jest zapisane.

### F4 — Validation-blocks-save-before-network path has no test, despite an established sibling precedent

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — port the existing pattern from the sibling spec file
- **Dimension**: Test Coverage
- **Location**: `tests/e2e/preferences-screen.spec.ts` (missing case) / `src/app/(app)/preferences.tsx:162-174, 254-257`
- **Detail**: `preferences.tsx` reuses the exact `submitted`/`blurredPrep`-gated `errorFor()` pattern from `profile.tsx`, including the "don't call the network when client validation fails" early return in `handleSave` (line 254-257). `profile-screen.spec.ts` has two dedicated tests for this exact class of behavior on the analogous field (`F4 nieliczbowy tekst w „Własny cel" daje błąd, a nie ciche zniknięcie`, line 292; `F4 zapis jest zatrzymany przed siecią...`, line 306) — tests that exist precisely because this was a real, previously-shipped bug in the sibling screen. `preferences-screen.spec.ts` has no equivalent for an out-of-range `maxPrepMinutes` value, even though the code path is structurally identical.
- **Fix**: Add a test entering an out-of-range `maxPrepMinutes` (e.g. `"1"` or `"500"`), blurring, asserting the inline bounds error appears, and asserting no `PUT` request fires — mirroring `profile-screen.spec.ts`'s `F4` tests.
- **Decision**: NAPRAWIONE 14.09.2026 — test `F4 walidacja zatrzymuje zapis PRZED siecią i wiąże
  błąd z polem`. Asercja idzie przez `aria-errormessage`, a nie przez treść: „5–240" stoi także
  w stałej podpowiedzi pod listą, więc dopasowanie po tekście trafiało w dwa elementy naraz.

### F5 — Automated non-test Success Criteria (tsc/lint/export/wrangler dev) could not be independently re-run

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — informational, not a code issue
- **Dimension**: Success Criteria
- **Location**: N/A (review environment)
- **Detail**: This review ran in a sandboxed CI environment where `npm ci` required interactive approval that was never grantable, so `node_modules` is absent and `npx tsc --noEmit`, `npx expo lint`, `expo export` + `wrangler deploy --dry-run`, and `wrangler dev` could not be executed here. Criteria 2.1-2.4, checked `[x]` in `plan.md`'s Progress section at commit `f20aea5`, are taken on the author's word. Static reading of the diff found no obvious type errors, lint violations (no raw colors/spacing, no manual memoization, no `../` imports, no `setState` outside promise callbacks), or `wrangler.jsonc`/bundling concerns — but this is not a substitute for actually running the tools. If `quality-gate.yml` is green on this PR, that is stronger evidence than this review could produce on its own.
- **Fix**: N/A — re-run these commands in an environment with dependencies installed and network access if stronger confidence is needed.
- **Decision**: PRZYJĘTE DO WIADOMOŚCI 14.09.2026, bez zmian w kodzie. Ograniczenie środowiska
  przeglądu, nie usterka. Kryteria 2.1-2.4 mają mocniejszy dowód niż słowo autora: zielona bramka
  jakości na PR #10 (`tsc`, `expo lint`, `npm test`, `check-conventions`, `npm ci` na Linuksie)
  plus lokalne przebiegi `expo export`, `wrangler deploy --dry-run` i `wrangler dev`, opisane
  w Dzienniku `notes/cert-queue.md`.

### F6 — Ingredient catalog has no pagination and is filtered client-side on every keystroke

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — fine at current scale, worth a follow-up note only if the catalog grows
- **Dimension**: Safety & Quality (performance)
- **Location**: `src/server/repository/preferences.ts:265-281` (`listCatalog`) / `src/app/(app)/preferences.tsx:216-233` (search filter)
- **Detail**: `GET /api/catalog` returns the entire `ingredient` table with no limit, and the screen does a full linear `fold()`/`includes()` scan over it on every keystroke with no debounce. At the current seed size (~35 ingredients) this is not a problem, but there is no ceiling — if the catalog grows into the hundreds, this becomes an unbounded payload and an O(n) per-keystroke scan.
- **Fix**: No action needed now; worth revisiting if/when the ingredient catalog grows substantially past its current seed size.
- **Decision**: ODŁOŻONE ŚWIADOMIE 14.09.2026. Przy 35 składnikach pełny katalog i filtr
  liniowy są tańsze niż stronicowanie i debounce, a ruch jest jednorazowy (`private, max-age=300`).
  Sufit jest realny, ale przyjdzie razem z pulą: **wraca do rozważenia w fazie 4 F-01**, gdy liczba
  składników urośnie wraz z daniami. Zapisane jako pozycja do przemyślenia, nie jako dług cichy.

## Findings without a line anchor

F5 (environment limitation, no code location) and F6's forward-looking note have no specific diff line to anchor beyond the ranges already cited; both are listed above with the closest relevant location.

## Cross-checks that came back clean

- **Plan drift**: all three Phase 2 "Wymagane zmiany" items (accessibility names in `text-field.tsx`/`choice-field.tsx`, the `preferences.tsx` screen, and the two-platform tab wiring with three icon densities) are implemented as described. The screen's single `GET` guarded by `touched`, ingredient-search-by-catalog (never free text), one unified exclusions list with all three kinds, and `TextField`/`ChoiceField`/`ActionButton` usage all match the plan's contract.
- **Scope discipline**: `src/app/api/catalog+api.ts` (new route) and the `action-button.tsx` accessibility addition are both outside Phase 2's literal file list, but both are explicitly justified in the PR body and are necessary, well-scoped enablers of the planned work — not unexplained scope creep. `catalog+api.ts` follows the established `requireUserId` → repository → JSON shape exactly, and its `Cache-Control: private, max-age=300` (instead of the usual `no-store`) is correctly justified: `listCatalog()` returns only the shared `ingredient`/`exclusion_group` dictionaries, never anything filtered by `userId`.
- **Guardrail integrity**: exclusions remain `ingredient_id`-based end to end — no free-text ingredient matching was introduced anywhere in the screen or the catalog route.
- **`touched` race guard**: correctly implemented for the read path — a delayed initial `GET` response cannot clobber values the user already typed (`tests/e2e/preferences-screen.spec.ts:101-123` proves this with a real 2.5s-delayed route).
- **Offline vs. signed-out**: `OfflineError` and `NotSignedInError` are handled as distinct cases on both load and save, matching the repo-wide rule that "offline" must never be treated as "signed out."
- **Tab inventory test**: `tests/e2e/profile-screen.spec.ts`'s test `3.13` was correctly extended to expect the new "Preferencje" tab, exactly as the plan's own addendum required.
- **Conventions**: no raw colors/spacing in `StyleSheet`, `ThemedText`/`ThemedView` used throughout, no manual `useMemo`/`useCallback`/`React.memo`, no `../` imports, SQL confined to `src/server/repository/`, no `getWorkerEnv()` in routes.

## Environment limitations (read before treating Success Criteria as fully checked)

This review ran in a sandboxed CI environment where `npm ci` and other network-requiring commands needed interactive approval that was never grantable — `node_modules` is absent, so `npx tsc --noEmit`, `npm test`, `npx expo lint`, `expo export`, and `wrangler dev` could not be executed here. See F5 for detail. All findings in this report are based on static reading of the diff and the full contents of the affected files, not on running the toolchain.

<!-- End of report -->
