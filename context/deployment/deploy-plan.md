---
project: MealPlan
deployed_at: 2026-08-31
platform: Cloudflare Workers (static assets + D1)
worker_name: meal-plan
production_url: https://meal-plan.kurs-ai-szysza.workers.dev
context_type: mvp
status: live
auto_deploy: cloudflare-workers-builds — podłączone, ale build pada w pre-flight (diagnoza w toku)
---

# Pierwsze wdrożenie — plan i przebieg

Ścieżka audytu „co miało się stać" dla wdrożenia z 31.08.2026. Plan powstał w Plan Mode na podstawie
[infrastructure.md](../foundation/infrastructure.md) i [tech-stack.md](../foundation/tech-stack.md);
ta sekcja notuje też **co faktycznie się stało**, bo w trzech miejscach rzeczywistość odbiegła
od planu.

## Stan przed

Repo po scaffoldzie: trzy trasy w `src/app/`, `web.output: "static"`, zero backendu — bez `worker.ts`,
`wrangler.jsonc`, bazy i bez jednej trasy `+api.ts`. Nic nigdy nie było wdrożone. Gałąź `master`,
brak zdalnego repozytorium.

## Decyzje wejściowe

| Decyzja | Wybór |
| --- | --- |
| Zakres | Pełny backend od razu (Getting Started z `infrastructure.md` 1:1), nie etapowo |
| Auto-deploy z gałęzi głównej | Cloudflare Workers Builds — natywne, **nie** GitHub Actions |
| URL-e preview | `preview_urls: false` — zerowa ekspozycja zamiast Cloudflare Access |
| Repozytorium zdalne | GitHub, **prywatne** |

## Co jest wdrożone

| Rzecz | Wartość |
| --- | --- |
| Worker | `meal-plan`, konto `szysza0x@gmail.com` (`23a6bb68615f908cd929091d8ac15337`) |
| URL produkcyjny | <https://meal-plan.kurs-ai-szysza.workers.dev> |
| Wersja na produkcji | `f4e017e1-6511-4944-a15e-4642e1c06826` (Worker Startup Time: 4 ms) |
| Wersja wgrana bez ruchu | `48832f6f-609e-4f71-8c5c-7db48a5a3a12` — cel dla `wrangler rollback` |
| Baza | D1 `mealplan`, `5ff3f12b-dd3c-49f2-9212-ef2a85b36851`, region **EEUR**, binding `DB` |
| Assets | binding `ASSETS`, `dist/client`, 31 plików |
| Bundel Workera | 6 modułów, 98 KiB / 25 KiB gzip |
| Observability | włączona, `head_sampling_rate: 1` (plan darmowy: 3 dni retencji) |
| **Sekrety** | **żadne** — nie ma auth, nadawcy maili ani klucza do modelu. Ścieżka gotowa, nieużyta |
| Schemat D1 | **brak** — baza jest pusta, zero migracji |
| Runtime | wrangler 4.127.1, workerd 1.20260828.1, `compatibility_date: 2026-08-28`, `nodejs_compat` |

## Weryfikacja — wynik

Te same sześć żądań lokalnie na `wrangler dev` (workerd) i na produkcji:

| Żądanie | Wynik |
| --- | --- |
| `GET /` | 200, HTML 24 456 B |
| `GET /explore` | 200, HTML 25 030 B |
| `GET /_sitemap` | 200, HTML |
| `GET /_expo/static/js/web/entry-*.js` | 200, 2 142 349 B, z ASSETS |
| `GET /favicon.ico` | 200, `image/vnd.microsoft.icon` |
| `GET /nie-ma-takiej-trasy` | 404 + strona `+not-found` |
| `GET /api/health` | 200, `{"ok":true,"d1":true,...}` |

`npx tsc --noEmit` i `npx expo lint` czyste po każdej fazie. `npx wrangler tail` pokazał żądanie
produkcyjne na żywo (`GET /api/health - Ok`).

`d1: true` z produkcji jest tu najważniejszą linią: potwierdza, że binding D1 dociera do trasy API
przez kanał `globalThis` z [src/server/env.ts](../../src/server/env.ts), bo adapter workerd **nie
przekazuje** `env` do tras.

## Odchylenia od planu

1. **`versions upload` przed pierwszym `deploy` nie działa** — „You cannot upload a new version of
   a Worker that does not yet exist". Plan zakładał preview → produkcja; przy pierwszym wdrożeniu
   kolejność jest odwrotna. Ścieżka preview działa od drugiego wdrożenia i została zweryfikowana po fakcie.
2. **`rules` w `wrangler.jsonc` musiały urosnąć z dwóch do czterech.** Reguła użytkownika bez
   `"fallthrough": true` usuwa regułę domyślną tego samego typu, więc brak własnych `Data`
   i `CompiledWasm` zostawiał domyślne `**/*.bin` / `**/*.wasm`, które zamiotły `node_modules`
   (`react-native/React/I18n/**`, `blake3-wasm`, `@img/sharp-wasm32`) — 46 modułów, 8.9 MB, 3.5 MB gzip,
   ponad limit skryptu na planie darmowym. Po zawężeniu: 6 modułów, 98 KiB.
3. **Trasy API są CommonJS, nie ESM.** Metro kończy bundel `module.exports = __r(1310);`, więc typ
   `ESModule` dawał 200 na HTML-u i **500 `ReferenceError: module is not defined`** na `/api/health`.
   Poprawny typ to `CommonJS`.

Wszystkie trzy dopisane do *Getting Started* w [infrastructure.md](../foundation/infrastructure.md),
a reguły trwałe — do [CLAUDE.md](../../CLAUDE.md).

## Runbook

```sh
npx expo export -p web                                # dist/client + dist/server; deploy NIE buduje
npx wrangler deploy --dry-run --outdir .wrangler-dry  # 6 modułów, nic z node_modules
npx wrangler dev                                      # bramka: workerd lokalnie
npx wrangler versions upload                          # wersja bez ruchu produkcyjnego
npx wrangler deploy                                   # produkcja
npx wrangler tail                                     # logi na żywo
npx wrangler rollback [id-wersji]                     # cofa KOD, nie schemat D1
```

`npx expo start --web` uruchamia trasy API w Node — **nie jest** testem wdrożenia.

### Granica dostępu

Agent może: `expo export`, `wrangler deploy`, `versions upload`, `tail`, `rollback`,
`d1 execute` na zapytaniach odczytowych. **Wyłącznie człowiek, ręcznie:** `wrangler d1 delete`,
`wrangler delete`, rotacja sekretu produkcyjnego, zmiana planu, cokolwiek dotykającego DNS.

Dziś wrangler działa na tokenie OAuth z `wrangler login` (pełne uprawnienia konta). **Do zrobienia:**
token API zawężony do `Workers Scripts: Edit` + `D1: Edit`, bez DNS i rozliczeń, w zmiennej
`CLOUDFLARE_API_TOKEN` — nigdy w commitowanym pliku.

## Auto-deploy z `main` — Workers Builds

Gałąź przemianowana `master` → `main`. Repozytorium prywatne na GitHubie, `origin` podłączony,
historia wypchnięta.

**Stan na 31.08.2026: podłączone, ale niedziałające.** Trigger działa — na commitach `703b474`
i `776fefe` pojawił się check-run `Workers Builds: meal-plan` od aplikacji
`cloudflare-workers-and-pages`, z własnym Build ID i `details_url` wskazującym Workera `meal-plan`.
Oba buildy zakończyły się **porażką po ~10 sekundach**, czyli przed instalacją zależności (806 paczek
zajmuje znacznie więcej), więc `expo export` nigdy nie ruszył. Awaria jest w pre-flight, nie w kodzie.

Zfalsyfikowane hipotezy:

| Hipoteza | Jak odrzucona |
| --- | --- |
| Pusty commit nie wywołuje builda | Commit `776fefe` zmienia `README.md` i pada identycznie |
| Builds podłączone do innego Workera (`dieta` / `running-training-planner`) | `details_url` wskazuje `.../services/view/meal-plan/production/builds/...` |
| Workers Builds wymaga planu płatnego | Dokumentacja: Free ma 3000 min/mc i 1 build równolegle |

Log buildu jest nieczytelny z CLI: token OAuth z `wrangler login` nie ma uprawnień do API
`accounts/{acc}/builds/*` (kod 10000, `Authentication error`), przy tym że `workers/scripts` działa
normalnie. Odczyt wymaga tokenu API z uprawnieniem do Workers Builds.

Auto-deploy jest więc **niesprawny**; wdrożenia idą ręcznie przez runbook wyżej i to jest w pełni
wystarczające dla MVP. Kroki podłączenia — dla odtworzenia i weryfikacji konfiguracji:

1. Workers & Pages → `meal-plan` → **Settings → Builds → Connect**
2. Repozytorium: `pszyszkowski90/meal-plan`, gałąź produkcyjna: `main`
3. Build command: `npx expo export -p web`
4. Deploy command: `npx wrangler deploy`
   (gałęzie nieprodukcyjne domyślnie robią `wrangler versions upload` — zostawić)
5. Jeśli domyślny Node jest starszy niż wymagany przez Expo SDK 57 — ustawić zmienną build
   environment `NODE_VERSION` (lokalnie: 25.1.0)
6. Weryfikacja: pusty commit na `main` → push → build startuje sam, a `/api/health` nadal odpowiada

**Nazwa Workera w panelu musi być identyczna z `name` w `wrangler.jsonc`** (`meal-plan`), inaczej
build padnie.

## Czego to wdrożenie NIE rozstrzyga

- **Limit 10 ms CPU na planie darmowym.** `/api/health` mieści się w nim bez wysiłku, więc nie mówi
  nic o generatorze planu (FR-008). Plan Workers Paid (5 USD/mc) zakładać od pierwszego dnia pracy
  nad generatorem.
- **Auth i FR-001.** Better Auth + Drizzle na D1, timebox 2 wieczorów z rejestru ryzyka.
- **Schemat i migracje D1.** Każda migracja z migracją wstecz w tym samym commicie, wyłącznie
  addytywne — `wrangler rollback` nie cofa schematu.
- **Izolacja danych.** D1 nie ma RLS. Cały dostęp do danych użytkownika przez jedną warstwę
  repozytorium przyjmującą `userId` jako pierwszy argument; żadnego surowego SQL-a w trasach API.
- **Open Question 1** (źródło przepisów i makr) — nadal otwarta i nadal blokuje generator.
- Binarka natywna przez EAS Build, Cloudflare Access, Dockerfile, GitHub Actions — poza zakresem.
