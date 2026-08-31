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

Zawężony token API **istnieje i wystarcza wranglerowi** — sprawdzone komendą po komendzie:

| Komenda | Na zawężonym tokenie |
| --- | --- |
| `wrangler versions list` | działa |
| `wrangler versions upload` | działa, razem z uploadem assetów (wersja `03ebb0ed`) |
| `wrangler deploy` | ta sama ścieżka zapisu co `versions upload` |
| `wrangler d1 list` | działa |
| `wrangler d1 execute --remote` | działa (zapytanie odczytowe) |
| `wrangler tail` | działa — „Successfully created tail, Connected to meal-plan" |
| `wrangler whoami` | działa **częściowo**: pokazuje konto, ale nie e-mail (brak `User → User Details → Read`) |

Dwa ustalenia, które oszczędzają zgadywania:

- **`CLOUDFLARE_ACCOUNT_ID` nie jest potrzebne.** Wrangler sam wykrywa konto z tokenu; zmienna
  byłaby konieczna tylko przy tokenie obejmującym wiele kont.
- **Token ma uprawnienie do zapisu w Workers Builds**, nie tylko odczytu — `PATCH` na triggerze
  przeszedł. To szersze, niż zamierzano; przy odtwarzaniu wystarczy `Workers Builds: Read`, jeśli
  trigger konfigurujesz w panelu.

Brak e-maila w `whoami` jest kosmetyczny i **nie** warto go łatać: `User Details: Read` poszerza
token o dane konta bez żadnego zysku operacyjnego.

**Do zrobienia:** ustawić `CLOUDFLARE_API_TOKEN` na stałe w środowisku, wycofać sesję OAuth
(`wrangler logout`) i usunąć token z pliku tekstowego, w którym dziś leży. Token nigdy nie trafia
do commitowanego pliku.

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

**Bundel webowy nie jest w pełni odtwarzalny — ale niestabilność jest sporadyczna, nie ciągła.**
Cztery buildy tego samego drzewa źródłowego, trzy różne hashe:

| Build | Wersja | Nazwa bundla |
| --- | --- | --- |
| lokalny (Node 25.1.0, 836 pakietów) | — | `entry-4a4dcaed….js` (2 142 349 B) |
| CI, commit `2cb1e5f` (Node 24.18.0, 839 pakietów) | `53cab668` | `entry-0f2504d9….js` (2 135 953 B) |
| CI, commit `54b6447` | `b7f7b65c` | `entry-c440558757….js` |
| CI, commit `cad3ed9` | `646c0d26` | `entry-0f2504d9….js` — **taki sam jak w pierwszym** |

Różnicę laptop ↔ CI wyjaśnia inny Node i inne drzewo zależności. Nieprzewidziane jest to, co dzieje
się **wewnątrz CI**: żaden z tych commitów nie ruszał `package-lock.json`, `src/`, `app.json` ani
`worker.ts` (zweryfikowane `git diff --numstat`), a mimo to build drugi dał inny hash niż pierwszy
i trzeci. Wejście identyczne, platforma identyczna, wynik w dwóch stanach — więc to nie jest
„każdy build inny", tylko sporadyczna niedeterministyczność (prawdopodobnie kolejność modułów przy
zrównoleglonym bundlowaniu Metro). Nie da się na niej polegać w żadną stronę.

Trzy konsekwencje:

1. **Nazwę zasobu do sprawdzenia bierz z wdrożonego HTML-a, nie z lokalnego `dist/`** — inaczej
   testujesz plik, którego na produkcji nie ma, i dostajesz 404, które wygląda jak zepsute wdrożenie.
   Pierwszy smoke test po auto-deployu wpadł dokładnie w tę pułapkę.
2. **Deploy może unieważnić stare adresy assetów** — nie musi, ale nie wiadomo z góry, czy to zrobi.
   Gdy hash się zmieni, klient trzymający otwartą stronę z przed deployu dostanie 404 na swoim
   bundlu JS do czasu odświeżenia. Przy jednoosobowym MVP nieistotne; przy realnym ruchu to okno
   błędu przy nieprzewidywalnej części wdrożeń, co jest gorsze diagnostycznie niż przy każdym.
3. **Commit dotykający wyłącznie dokumentacji przebudowywał i redeployował produkcję.** Naprawione
   przez `path_excludes` — patrz niżej.

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

### Watch paths — dokumentacja nie rusza produkcji

Ustawione przez API, nie przez panel: `PATCH /accounts/{account_id}/builds/triggers/{trigger_uuid}`
z ciałem `{"path_excludes": [...]}`. (Pojedynczego triggera **nie da się** odczytać przez `GET` na
tej ścieżce — zwraca `Not found`; publiczne są tylko `list` i `patch`.)

| Pole | Wartość |
| --- | --- |
| `path_includes` | `["*"]` (domyślne) |
| `path_excludes` | `["context/*", "notes/*", ".claude/*", "*.md", "LICENSE"]` |

Semantyka, która decyduje o poprawności tej listy: **wykluczenia stosują się pierwsze**, a build
rusza, jeśli po ich odjęciu **cokolwiek** pasuje do włączeń. Commit ruszający i dokumentację,
i `src/` nadal się zbuduje — wykluczona zostaje tylko dokumentacja. `*` dopasowuje zero lub więcej
znaków; `**` nie jest udokumentowane, więc nie jest używane.

Trzy przypadki, w których Cloudflare **pomija** dopasowywanie ścieżek i buduje zawsze: 0 zmian
plików, 3000+ zmian plików, 20+ commitów w pushu. Pierwszy z nich wyjaśnia retrospektywnie, dlaczego
pusty commit `703b474` wywołał build, mimo że nie ruszał niczego.

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
