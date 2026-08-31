---
project: MealPlan
deployed_at: 2026-08-31
platform: Cloudflare Workers (static assets + D1)
worker_name: meal-plan
production_url: https://meal-plan.kurs-ai-szysza.workers.dev
context_type: mvp
status: live
auto_deploy: cloudflare-workers-builds
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
| Wersja na produkcji | `53cab668-bde2-469c-95fc-a92039f9a982` — wdrożona **automatycznie** przez Workers Builds z commita `2cb1e5f` |
| Poprzednie wersje | `f4e017e1` (pierwszy ręczny deploy, startup 4 ms), `48832f6f` (`versions upload`) — cele dla `wrangler rollback` |
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

Konfiguracja triggera (odczytana z API, poprawna od pierwszego podejścia): build command
`npx expo export -p web`, deploy command `npx wrangler deploy`, root `/`, gałąź `main`, repo
`pszyszkowski90/meal-plan`, cache buildów wyłączony.

### Dwa pierwsze buildy padły — i to nie na konfiguracji

Buildy `c8dd6896` (commit `703b474`) i `89e7768a` (commit `776fefe`) zakończyły się porażką po ~10
sekundach, przed instalacją zależności. Trzy hipotezy odpadły po drodze: pusty commit (realna zmiana
pliku padła identycznie), podłączenie do innego Workera (`details_url` wskazywał `meal-plan`) oraz
wymóg planu płatnego (Workers Builds jest na Free: 3000 min/mc, 1 build równolegle).

Log był nieczytelny z CLI, bo token OAuth z `wrangler login` nie ma uprawnień do
`accounts/{acc}/builds/*` — zwraca `Authentication error` (10000), przy działającym `workers/scripts`.
Odczyt wymagał tokenu API z uprawnieniem do Workers Builds; przy okazji domknęło to zaległy krok
z Fazy 0.

**Przyczyna: `package-lock.json` był niespójny.**

```
npm error `npm ci` can only install packages when your package.json and package-lock.json
npm error   or npm-shrinkwrap.json are in sync.
npm error Missing: @emnapi/runtime@1.11.3 from lock file
npm error Missing: @emnapi/core@1.11.3 from lock file
```

`npm install` na Windowsie zapisuje wpisy pakietów `*-wasm32*` (`@img/sharp-wasm32` z `sharp`,
`@unrs/resolver-binding-wasm32-wasi` z eslinta), ale **pomija ich zależności `@emnapi/*`**, bo
`cpu: ["wasm32"]` nie pasuje do hosta. Lock przechodzi na Windowsie i pada na Linuksie. Defekt
**istniał już w commicie `e17887d`** (wtedy dotyczył `@unrs/...`) — moje instalacje tylko zmieniły
winowajcę, więc `npm ci` w CI padłby od pierwszego dnia niezależnie od tego wdrożenia.

Naprawa i weryfikacja:

1. `scripts/check-lockfile.js` — odtwarza sprawdzenie spójności robione przez `npm ci`, więc błąd
   jest łapalny lokalnie. Podpięty jako `npm run check-lock`.
2. Trzy warianty naprawy na Windowsie **nie zadziałały**: `npm install`, regeneracja od zera oraz
   `--os=linux --cpu=x64` dają ten sam niespójny wynik; `overrides` + `optionalDependencies`
   pogorszyły sprawę. npm konsekwentnie odmawia zapisu tych zależności.
3. Zadziałało wygenerowanie locka **na Linuksie** (`node:24` w Dockerze), zasianego obecnym lockiem —
   bez zasiewu npm gubi `resolved` i `integrity` dla 835 z 927 pakietów, co jest utratą weryfikacji
   łańcucha dostaw i zostało odrzucone.
4. Wynik: **+2 wpisy** (`@emnapi/core`, `@emnapi/runtime`, oba z sumą kontrolną), **zero zmian
   wersji**, metadane platformowe (`os`, `cpu`) zachowane, 929 pakietów, 0 bez `integrity`.
5. Zweryfikowane przed pushem: `npm clean-install` z npm 10.9.2 na Linuksie — 841 pakietów, exit 0
   (dokładnie krok, który padał); `npm ci` na Windowsie — 836 pakietów; `tsc`, `expo lint`,
   `expo export` i `wrangler deploy --dry-run` (nadal 6 modułów, 98 KiB) czyste.

Środowisko buildu: `npm@10.9.2`, `nodejs@24.18.0` — wersji Node nie trzeba przypinać.

### Stan końcowy: działa

Build `9a6a11de` z commita `2cb1e5f` przeszedł w **148 s** i wdrożył się sam:

```
Detected the following tools from environment: npm@10.9.2, nodejs@24.18.0
Installing project dependencies: npm clean-install --progress=false
added 839 packages, and audited 840 packages in 33s
Exported: dist
✨ Success! Uploaded 1 file (30 already uploaded) (1.04 sec)
Total Upload: 124.58 KiB / gzip: 17.93 KiB
Current Version ID: 53cab668-bde2-469c-95fc-a92039f9a982
✨ Success! Build completed.
```

Push na `main` → build → wdrożenie, bez udziału człowieka i bez zewnętrznego CI. Wszystkie
sprawdzenia smoke przechodzą na wersji zbudowanej przez Cloudflare.

**Buildy nie są bit-w-bit odtwarzalne między laptopem a CI.** Ten sam commit dał lokalnie
`entry-4a4dcaed….js` (2 142 349 B), a w CI `entry-0f2504d9….js` (2 135 953 B) — inny Node
(24.18.0 w CI, 25.1.0 lokalnie) i inne drzewo zależności (839 vs 836 pakietów). Nie jest to defekt,
ale ma jedną praktyczną konsekwencję: **nazwę zasobu do sprawdzenia bierz z wdrożonego HTML-a, nie
z lokalnego `dist/`** — inaczej testujesz plik, którego na produkcji nie ma i dostajesz mylące 404.
Assety są adresowane hashem treści, więc stare nazwy przestają istnieć po deployu.

### Kroki podłączenia (dla odtworzenia)

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

Przed każdym pushem, jeśli ruszałeś zależności: `npm run check-lock`. Nigdy `npm install` w tym
repo — tylko `npm ci`.

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
