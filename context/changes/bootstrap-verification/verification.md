---
bootstrapped_at: 2026-08-28T20:20:42Z
starter_id: expo
starter_name: "Expo (React Native)"
project_name: meal-plan
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

Verbatim frontmatter from `context/foundation/tech-stack.md`:

```yaml
starter_id: expo
package_manager: npm
project_name: meal-plan
hints:
  language_family: js
  team_size: solo
  deployment_target: appstore-via-eas
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack (verbatim from hand-off body)

Solo build, 4 tygodnie po godzinach, product_type `mobile`, rodzina językowa
JS/TS — dla tej komórki rejestr wskazuje Expo (React Native) i użytkownik
przyjął rekomendację. Trzy czynniki niosą tę decyzję: krótki budżet czasu
premiuje starter sprawdzony end-to-end przez bootstrapper (`verified`),
jeden kod na iOS, Androida i web obsługuje zapisane w shape-notes wymaganie
równorzędnej powierzchni webowej bez drugiego projektu, a TypeScript plus
konwencje Expo Routera domykają wszystkie cztery bramki jakości, więc
`quality_override` jest fałszywe. Karta Expo nie wnosi backendu, dlatego
konto e-mail+hasło (FR-001) i izolacja danych profilowych (Access Control)
wymagają dobrania warstwy danych osobno — to pierwsza decyzja po
scaffoldowaniu, obok offline'owej dostępności planu i listy zakupów
(Non-Functional). `has_ai` jest fałszywe świadomie: generowanie przepisów
przez model to jedna z rozważanych, nierozstrzygniętych opcji w Open
Question 1, a nie zatwierdzony zakres MVP. Wdrożenie celuje w EAS z profilem
wewnętrznym — APK instalowany ręcznie, publikacja w sklepie odłożona.

## Pre-scaffold verification

| Signal      | Value                                         | Severity | Notes                                                                                             |
| ----------- | --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| npm package | `create-expo-app` v4.0.0 published 2026-08-01 | fresh    | package name resolved from `cmd_template` (`npx create-expo-app {name} …`); 27 days old            |
| GitHub repo | not run                                       | n/a      | card `docs_url` is `https://docs.expo.dev` — not a GitHub URL, so no repo recency signal available |

No stale signal. Proceeded without a heads-up.

## Scaffold log

**Card `cmd_template`**: `npx create-expo-app {name} --yes --template default`

**Resolved invocation**: `npx --yes create-expo-app .bootstrap-scaffold --yes --template default`
(the leading `--yes` is npx's own non-interactive flag, added so the npx package-install prompt could not block the run; the trailing `--yes` comes from the card)

**Strategy**: subdir-then-move

**Exit code**: 0

**Files moved**: 15 paths — `.claude/settings.json`, `.git`, `.gitignore`, `.vscode`, `AGENTS.md`, `app.json`, `assets`, `LICENSE`, `node_modules`, `package.json`, `package-lock.json`, `README.md`, `scripts`, `src`, `tsconfig.json`

**Conflicts (.scaffold siblings)**: `CLAUDE.md` → `CLAUDE.md.scaffold`

**.gitignore handling**: moved silently — absent in cwd, so no append-merge was needed

**context/ handling**: the scaffold produced no `context/` paths, so nothing was dropped; the existing `context/` tree is untouched

**.bootstrap-scaffold cleanup**: deleted (empty after the move-up; no leftovers)

**Note on `.git/`**: `create-expo-app` runs `git init` itself and left an `Initial commit` (`dfa6f4f`) covering the scaffold's own file set. The conflict matrix treats `.git/` as "anything else"; cwd had no `.git/`, so it moved up silently. Consequence: `git status` in this project will report the pre-existing `context/`, `notes/`, `logs/`, `.claude/` and `CLAUDE.md.scaffold` as untracked, and `CLAUDE.md` as modified (the commit holds the starter's version, the working tree holds yours). Removing `.git/` and running `git init` yourself is a clean alternative — bootstrapper did not decide this for you.

**Install performed by the CLI**: 571 packages added, 572 audited, ~1 min. One deprecation warning during install: `uuid@7.0.3` is no longer supported.

**Post-move correction — project identity**: `create-expo-app` derives the app's identity from the directory argument it is given, so the temp scaffold directory leaked into three fields. They were rewritten to the hand-off's `project_name`:

| File           | Field    | Scaffold value        | Corrected to |
| -------------- | -------- | --------------------- | ------------ |
| `package.json` | `name`   | `bootstrap-scaffold`  | `meal-plan`  |
| `app.json`     | `name`   | `.bootstrap-scaffold` | `meal-plan`  |
| `app.json`     | `slug`   | `.bootstrap-scaffold` | `meal-plan`  |
| `app.json`     | `scheme` | `bootstrapscaffold`   | `mealplan`   |

This is not cosmetic: `slug` is the project identifier EAS builds against, and a leading `.` is not a valid slug — with `deployment_target: appstore-via-eas` in the hand-off, leaving it would have surfaced as a build-time failure. No other file referenced the temp directory name.

## Post-scaffold audit

**Tool**: `npm audit --json` (exit code 1 — informational only; non-zero exit is npm's way of saying "findings exist" and is not treated as a failure)

**Summary**: 0 CRITICAL, 0 HIGH, 11 MODERATE, 0 LOW

**Direct vs transitive**: 2 direct (`expo`, `expo-splash-screen`), 9 transitive, of 11 total MODERATE. 0 direct at CRITICAL or HIGH.

**Dependency counts**: 550 prod, 0 dev, 11 optional, 21 peer — 581 total.

### CRITICAL findings

None.

### HIGH findings

None.

### MODERATE findings

All 11 findings trace to a single root advisory. npm labels the entire chain `moderate`; the root advisory's own CVSS score is 7.5.

**Root advisory** — GHSA-w5hq-g745-h8pq

- Package: `uuid`, vulnerable range `<11.1.1`
- Title: *Missing buffer bounds check in v3/v5/v6 when `buf` is provided*
- CVSS: 7.5
- URL: https://github.com/advisories/GHSA-w5hq-g745-h8pq
- Present in the tree as `uuid@7.0.3` — the same package the install flagged as deprecated

**Propagation chain** (each entry inherits from the one it depends on):

| Package                            | Direct? | Vulnerable range in tree                                                                                 | Affects                                                                                                    |
| ---------------------------------- | ------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `uuid`                             | no      | `<11.1.1`                                                                                                 | `xcode`                                                                                                      |
| `xcode`                            | no      | `>=0.9.2`                                                                                                 | `@expo/config-plugins`                                                                                       |
| `@expo/config-plugins`             | no      | `*`                                                                                                       | `@expo/cli`, `@expo/config`, `@expo/inline-modules`, `@expo/prebuild-config`, `expo`, `expo-splash-screen`    |
| `@expo/config`                     | no      | `<=0.0.1-canary-20240418-8d74597` or `>=3.3.23-alpha.0`                                                   | `@expo/local-build-cache-provider`, `@expo/metro-config`, `expo`                                              |
| `@expo/cli`                        | no      | `<=0.0.0-canary-20231123-1b19f96-4` or `>=0.0.1-canary-20231125-d600e44`                                  | `expo`                                                                                                       |
| `@expo/inline-modules`             | no      | `>=0.0.2-canary-20260409-6fc2991`                                                                         | `@expo/cli`                                                                                                  |
| `@expo/local-build-cache-provider` | no      | `*`                                                                                                       | `expo`                                                                                                       |
| `@expo/metro-config`               | no      | `<=0.0.1-canary-20240418-8d74597` or `>=0.1.49-alpha.0`                                                   | `expo`                                                                                                       |
| `@expo/prebuild-config`            | no      | `*`                                                                                                       | —                                                                                                            |
| `expo`                             | **yes** | `40.0.0-alpha.0 - 40.0.0-beta.5` or `>=41.0.0-alpha.0`                                                    | —                                                                                                            |
| `expo-splash-screen`               | **yes** | `55.0.10-canary-20260424-7bedc9d - 55.0.10-canary-20260429-a5e59cf` or `>=56.0.0-canary-20260212-4f61309` | —                                                                                                            |

**Fix path proposed by npm**: `npm audit fix --force` would move `expo` to `46.0.21` and `expo-splash-screen` to `55.0.25`, both flagged `isSemVerMajor: true`. For `expo` that is a *downgrade* of several major versions from what the current template ships — applying it blindly would take the project off the template's supported line. Inspect before running. The actionable upstream fix is `uuid >= 11.1.1` reaching the tree through Expo's own dependency updates. Bootstrapper applied no fix.

### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | verified             |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | appstore-via-eas     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | false                |

`has_auth: true` and the `ci_provider` / `ci_default_flow` pair carry the most downstream weight: v1 scaffolds no auth layer and writes no CI workflow. The Expo card carries no backend, so the email+password account (FR-001) and the profile-data isolation requirement named in the hand-off body still need a data layer chosen separately.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- Decide what to do with the `.git/` repo `create-expo-app` initialised — keep it, or `rm -rf .git && git init` for your own history.
- Review `CLAUDE.md.scaffold` against your existing `CLAUDE.md` (`diff CLAUDE.md CLAUDE.md.scaffold`) and decide which content to keep. The scaffold also brought its own `AGENTS.md`, which landed with no conflict.
- Address audit findings per your project's risk tolerance — the full breakdown is above. All 11 are MODERATE and trace to one `uuid` advisory inside Expo's own dependency chain.
- Pick the data/auth layer the Expo card does not provide, per the hand-off rationale.
