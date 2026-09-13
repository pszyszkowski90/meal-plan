# Repository Guidelines

MealPlan — aplikacja do planowania posiłków na Expo SDK 57 / React Native 0.86 / React 19.2:
TypeScript, Expo Router, jedna baza kodu na iOS, Androida i web renderowany serwerowo. Backend to
Cloudflare Worker z bazą D1, tożsamość prowadzi Clerk — patrz
[tech-stack.md](context/foundation/tech-stack.md) i [infrastructure.md](context/foundation/infrastructure.md).

Ten plik jest jedynym źródłem reguł projektu; [AGENTS.md](AGENTS.md) tylko na niego wskazuje.
Nie przenoś treści do AGENTS.md: ta instalacja Claude Code nie wczytuje `AGENTS.md` i nie rozwija
importu `@AGENTS.md` — sprawdzone, reguły muszą fizycznie leżeć tutaj.

## Produkt: twarde ograniczenia

Pełny zakres jest w [prd.md](context/foundation/prd.md). Cztery rzeczy są **ograniczeniami, nie
preferencjami** — złamanie któregokolwiek to błąd, nie kompromis:

- Suma kalorii dnia mieści się w ±10% wyliczonego celu. Dotyczy też pojedynczej podmiany dania.
- Żaden posiłek nie zawiera pozycji z listy wykluczeń użytkownika.
- Żaden posiłek nie przekracza zadeklarowanego maksymalnego czasu przygotowania.
- Gdy planu nie da się ułożyć w tych granicach — zwróć błąd nazywający, którego z trzech ograniczeń
  nie da się spełnić, i nie zwracaj żadnego planu ani planu częściowego.

Wykluczenia z preferencji (FR-004) i oznaczenia dań z planu (FR-011) zasilają **jedną** listę
wykluczeń, nie dwa mechanizmy.

Poza zakresem MVP: dziennik jedzenia, śledzenie wagi, plan miesięczny, preferencje pozytywne
(FR-005), eksport listy zakupów (FR-015). Nie dokładaj ich „przy okazji".

**Źródło przepisów rozstrzygnięte 13.09.2026** (Open Question 1 i 2 w PRD): model językowy
autoryzuje przepisy **raz, poza runtime**, człowiek przegląda gramatury, a makra liczy skrypt
z tabeli USDA. **Worker nigdy nie woła modelu** — w runtime czyta wyłącznie D1. Konsekwencje
i odrzucone opcje: [options.md](context/changes/dish-source-and-seed-pool/options.md).

**Blokada nadal obowiązuje, ale z innego powodu:** generatora planu (S-04) nie implementuj, zanim
nie powstanie pula dań — nie ma z czego wybierać ani czym liczyć kalorii. Plan puli:
[dish-source-and-seed-pool](context/changes/dish-source-and-seed-pool/plan.md).

## Twarde reguły

Trzy pierwsze są uszeregowane kosztem złamania, nie tematem. Rozwinięcia zostały tam, gdzie były.

- **`10x get <ref>` kasuje `.claude/skills/` i przepisuje TEN plik.** Nie dokłada kumulatywnie,
  tylko synchronizuje do manifestu żądanej lekcji — a lekcje modułu 4 deklarują zero skilli.
  To jedyna operacja w repo, po której **nie da się przeczytać, co się zepsuło**, bo niszczy same
  reguły. Uruchamiaj wyłącznie przy czystym `git status` (szczegóły: Pułapki).
- **Warunek produkcyjny wchodzi PRZED commitem fazy, która go potrzebuje** — sekret, zmienna
  buildu, `migrations apply --remote`. Push na `main` wdraża natychmiast, więc kod czekający na
  sekret lub tabelę stoi na produkcji i zwraca 500 (szczegóły: Komendy i weryfikacja).
- **`npx expo start --web` nie jest testem wdrożenia** — uruchamia trasy API w Node. Wierność
  runtime'u daje wyłącznie `npx wrangler dev` na zbudowanym `dist/` (szczegóły: Komendy i weryfikacja).
- **Stage'uj po ścieżkach, nigdy `git add -A` ani `git add .`.** 13.09 `git add -A` wciągnęło
  na `main` niedokończony plik innej sesji. Przed commitem przeczytaj `git status --short`; cudzą
  zmianę poznasz po tym, że jej nie pamiętasz — to wystarczający powód, żeby jej nie stage'ować.
- **Expo się zmieniło.** Zanim napiszesz kod Expo, sprawdź wersjonowaną dokumentację
  <https://docs.expo.dev/versions/v57.0.0/> zamiast polegać na pamięci o starszych SDK.
- **Router mieszka w `src/app/`, nie w `app/`.** Nowy ekran = nowy plik w [src/app/](src/app/),
  np. `src/app/profile.tsx` → trasa `/profile`.
- **Nie dodawaj `useMemo` / `useCallback` / `React.memo`** — `reactCompiler` jest włączony
  ([app.json](app.json) → `experiments`) i memoizuje sam. `typedRoutes` też jest włączony:
  nieistniejąca ścieżka w `<Link href>` to błąd typu, nie runtime.
- **Dodanie zakładki znaczy edycję obu plików** — [app-tabs.tsx](src/components/app-tabs.tsx)
  (natywny) i [app-tabs.web.tsx](src/components/app-tabs.web.tsx) (web). Inaczej trasa istnieje,
  ale jest nieosiągalna na jednej z platform.
- **Nigdy nie uruchamiaj** `npm run reset-project` (przenosi kod startera do `app-example/`
  i zostawia puste `src/app/`) ani `npm audit fix --force` (cofa `expo` o kilka wersji major).
- **Nie commituj `/ios` ani `/android`** — to workflow zarządzany, konfiguracja natywna idzie przez
  [app.json](app.json) i pluginy. Nie zmieniaj w nim `slug` ani `scheme`.
- **Wdrożenie idzie wyłącznie przez `expo-server/adapter/workerd` + `assets.directory`.** `[site]`,
  Workers Sites, Cloudflare Pages oraz paczki `expo-adapter-workers` i `expo-workers` są **zakazane**
  w tym repo — uczą `[site] bucket`, zdeprecjonowanego w wrangler v4. Nie kopiuj konfiguracji
  z poradników o Pages.
- **Nie uruchamiaj `npm install` w tym repo — używaj `npm ci`.** `npm install` na Windowsie psuje
  `package-lock.json` w sposób niewidoczny lokalnie: zapisuje wpisy pakietów `*-wasm32*`
  (`@img/sharp-wasm32`, `@unrs/resolver-binding-wasm32-wasi`) bez ich zależności `@emnapi/*`, bo
  `cpu: ["wasm32"]` nie pasuje do hosta. `npm ci` na Linuksie przerywa wtedy z EUSAGE i build
  w Workers Builds nie dochodzi nawet do `expo export`. Po każdej zmianie zależności uruchom
  `npm run check-lock` — instrukcja naprawy jest w [check-lockfile.js](scripts/check-lockfile.js).
- **Nie ruszaj `rules` w [wrangler.jsonc](wrangler.jsonc) bez przeczytania komentarzy w pliku.**
  Każda z czterech reguł zapobiega konkretnej awarii: `CommonJS` (Metro emituje trasy API jako
  CommonJS — ESModule daje 500), `Text` (manifest i HTML), a `Data` / `CompiledWasm` istnieją **tylko**
  po to, by usunąć reguły domyślne, które inaczej zamiatają `node_modules` do bundla (8.9 MB, ponad
  limit planu darmowego). Usunięcie którejkolwiek psuje deploy.
- **Bindingi nie są w `process.env`.** Adapter workerd nie przekazuje `env` do tras API, więc D1
  i sekrety biorą się z [`getWorkerEnv()`](src/server/env.ts) — jedynego miejsca w repo, które dotyka
  `globalThis`. Nie powielaj tego wzorca w trasach.

## Struktura i konwencje

- [src/app/](src/app/) trasy — produktowe w grupie [(app)/](src/app/(app)/), logowanie
  w [(auth)/](src/app/(auth)/), trasy API w [api/](src/app/api/); [src/components/](src/components/)
  komponenty (+ [ui/](src/components/ui/) prymitywy), [src/hooks/](src/hooks/) hooki,
  [src/constants/theme.ts](src/constants/theme.ts) motyw i
  [src/constants/api.ts](src/constants/api.ts) (`ProductionOrigin` — **jedno** miejsce na adres
  Workera, czytane i przez klienta natywnego, i przez listę `AUTHORIZED_PARTIES` na serwerze;
  rozjazd objawia się jako 401 bez wskazówki); `assets/` leży **poza** `src/`.
- **[sso-callback.tsx](src/app/sso-callback.tsx) zostaje na najwyższym poziomie `src/app/`** — poza
  grupą `(auth)` i poza obiema bramkami, choć dotyczy logowania. Woła
  `WebBrowser.maybeCompleteAuthSession()` w zakresie modułu i musi przeżyć prerender oraz zwracać
  200 bez sesji. Przeniesienie go do `(auth)` „dla porządku" zabija Google SSO, a `tsc` tego nie
  złapie.
- [src/server/](src/server/) to kod wyłącznie serwerowy: [env.ts](src/server/env.ts) (bindingi),
  [auth.ts](src/server/auth.ts) (token → `userId`) i [repository/](src/server/repository/) — jedyne
  miejsce z SQL-em. Klientowi odpowiada [src/lib/api.ts](src/lib/api.ts): jedyny kanał żądań do
  własnego API (adres, typy błędów), z hookiem [use-authed-fetch.ts](src/hooks/use-authed-fetch.ts)
  obok. Ekran nie woła `fetch` do `/api/*` bezpośrednio.
- [migrations/](migrations/) to numerowane migracje D1 czytane przez wranglera z najwyższego poziomu;
  [migrations/down/](migrations/down/) to migracje wstecz, których wrangler nie widzi i które
  uruchamia wyłącznie człowiek. Nie ustawiaj `migrations_pattern` w `wrangler.jsonc` — zjadłby `down/`.
- Nazwy plików kebab-case (`themed-text.tsx`), nazwy eksportów PascalCase / camelCase.
- Importy przez aliasy: `@/*` → `src/*`, `@/assets/*` → `assets/*`. Względne `./` wolno **tylko**
  dla rodzeństwa w `src/components/` (5 wystąpień) oraz **wszędzie w `src/lib/`**, z jawnym
  rozszerzeniem `.ts` — bo `npm test` to `node --test`, a Node w ESM nie zna aliasu `@/`
  ani nie zgaduje rozszerzeń. Alias w `src/lib/` wywraca testy, nie typecheck.
  Zero `../` w całym `src/` — `../` w imporcie to błąd.
- **Zero surowych kolorów i odstępów w `StyleSheet`.** Kolor bierz z `useTheme()`, odstęp i promień
  z `Spacing` ([theme.ts](src/constants/theme.ts)) — to skala nazwana słownie (`half` … `six`),
  nie liczby.
- **Tekst i tło przez `ThemedText` / `ThemedView`**, nie `Text` / `View`. Wariant wybiera prop
  `type`, a nie własny styl inline; listę wariantów ma
  [themed-text.tsx](src/components/themed-text.tsx).
- **`useColorScheme` bierz z [`@/hooks/use-color-scheme`](src/hooks/use-color-scheme.ts), nie
  z `react-native`.** Web renderuje HTML po stronie serwera (`app.json` → `web.output: "server"`),
  więc wariant webowy odracza odczyt schematu do hydracji; hook z `react-native` daje niezgodność
  SSR/klient. Importują jeszcze wprost [app-tabs.tsx](src/components/app-tabs.tsx)
  i [web-badge.tsx](src/components/web-badge.tsx) — nie powielaj tego.
- **Przewijalne ekrany same rezerwują `BottomTabInset + Spacing.*`** w `paddingBottom` /
  `contentInset`; dolny pasek nawigacji nie jest w layoucie flexbox. Bez tego ostatni element
  chowa się pod zakładkami.
- **Wariant platformowy = osobny plik `foo.web.tsx`**, gdy zmienia drzewo komponentów albo
  importowane API (jak `app-tabs`: `NativeTabs` vs `expo-router/ui`). `Platform.OS` /
  `Platform.select` zostaw dla pojedynczej wartości — liczby, stringa, jednego stylu.

## Architektura

**Warstwa nawigacji jest rozdwojona.** [(app)/_layout.tsx](src/app/(app)/_layout.tsx) montuje jeden
komponent `AppTabs` (root [_layout.tsx](src/app/_layout.tsx) montuje tylko `ClerkProvider`,
`ThemeProvider`, nakładkę splash i `Stack`), ale Metro podstawia inny plik na każdą platformę:
natywnie `NativeTabs` z `expo-router/unstable-native-tabs`, na webie headless `Tabs` / `TabList` /
`TabTrigger` z `expo-router/ui`. **Konsekwencja lokalna:** natywnie `name` musi być nazwą pliku
trasy, a na webie wiąże `href` — dlatego ta sama zakładka nazywa się `index` natywnie i `home`
na webie.

**Motyw** jest jednokierunkowy: `Colors` (light/dark) → `useTheme()` → `ThemedText` / `ThemedView` →
ekrany. [theme.ts](src/constants/theme.ts) importuje [global.css](src/global.css) efektem ubocznym —
to stamtąd web bierze zmienne `--font-*`, na które wskazuje `Fonts`. Nie usuwaj tego importu przy
porządkach.

**Animacje** to Reanimated 4 z `Keyframe`, nie Animated API. Powrót z worklet do JS idzie przez
`scheduleOnRN` z `react-native-worklets` ([animated-icon.tsx](src/components/animated-icon.tsx)).
Splash: `SplashScreen.preventAutoHideAsync()` w layoucie, a `hideAsync()` woła dopiero `onLayout`
nakładki — kolejność jest celowa, przestawienie daje mignięcie.

**Backend.** `web.output: "server"` produkuje `dist/client` (assets) i `dist/server` (prerenderowany
HTML + trasy API); `worker.ts` oddaje żądania adapterowi workerd, a wszystko wisi na Cloudflare
Workers z bazą D1 `mealplan` w bindingu `DB`. Trzy trasy API: [health+api.ts](src/app/api/health+api.ts)
(smoke test wdrożenia: adapter, binding D1 **i** obecność tabeli `app_user`),
[account+api.ts](src/app/api/account+api.ts) — trasa odniesienia dla granicy danych, nie funkcja
produktowa; nie dokładaj do niej pól — oraz [profile+api.ts](src/app/api/profile+api.ts)
(`GET`/`PUT` profilu, jeden kontrakt `{ profile, target }` dla obu metod). Cel kaloryczny **nie
jest utrwalany** — liczy go przy odczycie [calorie-target.ts](src/lib/calorie-target.ts), ten sam
moduł, którego użyje generator planu. Zero dryfu między ekranem a generatorem.

**Trasy produktowe mieszkają w grupie `(app)` za bramką sesji.**
[(app)/_layout.tsx](src/app/(app)/_layout.tsx) jest jedynym miejscem decydującym, czy widok
produktowy się montuje: `isLoaded === false` → stan neutralny (pełny ekran w kolorze tła, bez
przekierowania i wskaźnika), brak sesji → `Redirect` na `/sign-in`, sesja → `AppTabs`. Grupa
`(auth)` (`sign-in`, `sign-up`, `forgot-password`) ma bramkę odwrotną. **Nawigacja po zmianie sesji
ma jednego właściciela — te dwie bramki**; ekrany po `finalize()` nie nawigują same. Stan neutralny
jest konieczny, bo web renderuje HTML bez sesji, a Clerk odtwarza ją dopiero po hydracji — bez
niego przy każdym wejściu mignąłby ekran logowania. Nie da się tego załatać `setState` w efekcie
(patrz Pułapki).

**Tożsamość prowadzi Clerk** — decyzja z 1.09.2026 wraz z odrzuconymi opcjami w
[change.md](context/changes/account-and-login/change.md), skutki infrastrukturalne w aneksie
[infrastructure.md](context/foundation/infrastructure.md). Hasła, sesje, maile, limit prób i Google
SSO są u Clerka. Worker **wyłącznie weryfikuje podpis JWT** kluczem publicznym PEM
(`CLERK_JWT_KEY`, sekret Workera): [`requireUserId(request)`](src/server/auth.ts) zwraca `{ userId }`
albo gotową odpowiedź — 401 dla odrzuconej tożsamości, 500 gdy sekretu brakuje lub nie jest PEM-em,
bo to awaria wdrożenia, nie użytkownika. Sprawdza `iss` i `azp` (lista `AUTHORIZED_PARTIES`; brak
`azp` znaczy klient natywny). Klient wysyła token nagłówkiem `Authorization: Bearer` na obu
platformach przez `useAuthedFetch()`, więc trasy API nigdy nie czytają ciasteczek. Błędy, które łapie
kod produktowy, są **repo-lokalne** i mieszkają w [src/lib/api.ts](src/lib/api.ts): `OfflineError`
(z `ClerkOfflineError` Clerka albo z padniętego `fetch`) i `NotSignedInError` (token `null`) —
**„offline" to nie „wylogowany"**, kod nie może ich mylić, a wyrzucenie z aplikacji należy do bramki.
`CLERK_SECRET_KEY` nie wchodzi do projektu, Backend API Clerka nie jest wołane. Produkcja na
`workers.dev` działa na instancji **Development** Clerka (`pk_test`); przejście na Production wymaga
własnej domeny i jest osobną zmianą.

**D1 ma schemat, ale nie ma danych tożsamościowych.** Tabela `app_user`
([0001_app_user.sql](migrations/0001_app_user.sql)) trzyma tylko `id` = roszczenie `sub` z tokenu,
`created_at` i `last_seen_at`; e-mail i hash hasła nie są duplikowane. Wiersz powstaje leniwie przy
pierwszym uwierzytelnionym żądaniu (`touchAppUser`), bez webhooka z Clerka. **Cały dostęp do danych
użytkownika idzie przez [src/server/repository/](src/server/repository/)**: każda funkcja przyjmuje
`userId` jako pierwszy argument i filtruje po nim w SQL-u, bo D1 nie ma RLS, a warstwa repozytorium
nie ma testów jednostkowych (granicy pilnuje dopiero `tests/e2e/data-boundary.spec.ts`) —
to jedyna izolacja między kontami. `prepare(` żyje wyłącznie w tym katalogu (jedyny wyjątek:
`health+api.ts`), wartości wchodzą przez `bind(...)`. Trasa `+api.ts` ma kształt `requireUserId` →
funkcja repozytorium → JSON, zero SQL-a i zero `getWorkerEnv()`. Wzorzec odniesienia:
[account+api.ts](src/app/api/account+api.ts) + [app-users.ts](src/server/repository/app-users.ts).
Nie dodawaj własnego hashowania ani tabel sesji.

## Komendy i weryfikacja

Skrypty (`start`, `android`, `ios`, `web`, `lint`, `test`, `check-lock`, `check-conventions`,
`hooks:install`) są w [package.json](package.json); lint to
`expo lint` z flat configiem w [eslint.config.js](eslint.config.js).

- `npx tsc --noEmit` — sprawdzenie typów; **pierwsze z dwóch**, drugim jest `npm test`. Nie jest
  skryptem npm.
- `npm run check-lock` — przed każdym pushem, jeśli ruszałeś zależności. Odtwarza sprawdzenie
  spójności robione przez `npm ci`, więc łapie zepsuty lock lokalnie, zamiast na czerwonym buildzie.
- `npm run check-conventions` — deterministyczna bramka reguł z tego pliku, których nie złapie
  ani `eslint`, ani `tsc`: zakaz `../`, ręcznej memoizacji, `globalThis` poza
  [env.ts](src/server/env.ts), SQL-a poza [repository/](src/server/repository/), `getWorkerEnv()`
  w trasach, surowych kolorów, `fetch` w ekranie, a do tego parzystość zakładek w obu plikach
  `app-tabs` i pary migracji `migrations/` ↔ `migrations/down/`. Całe `src/` w ~0,15 s.
  Definicje reguł: [check-conventions.js](scripts/check-conventions.js). **Nowa reguła wchodzi
  tylko wtedy, gdy całe obecne drzewo ją przechodzi** — reguła czerwona w dniu dodania jest
  szumem, nie bramką.
- `npm test` — `node --test` na `src/lib/*.test.ts`, bez żadnej zależności (runner jest wbudowany
  w Node). Obejmuje **wyłącznie czyste moduły** z `src/lib/`; nie ma testów komponentów ani tras.
- Testy przeglądarkowe (Playwright) leżą w [tests/e2e/](tests/e2e/), ale **Playwright NIE jest
  zależnością tego repo** — mieszka poza nim, bo `npm install` psuje tu lockfile. Instrukcja
  uruchomienia, pokrycie i dwie pułapki lokatorów: [tests/e2e/README.md](tests/e2e/README.md).
  Dlatego `tests/` jest wyłączone z `tsconfig.json` — inaczej `tsc` świeciłby na czerwono brakiem
  `@playwright/test`. Testy jadą przeciw `wrangler dev` na zbudowanym `dist/`, **nie** przeciw
  produkcji: konto testowe nie zapisuje danych do produkcyjnej D1.
- „Przetestowane" znaczy: `npx tsc --noEmit` i `npm test` przechodzą, a zmiana została **zobaczona
  w działaniu** — harnessem albo na realnej platformie. Warstwy natywnej harness nie pokrywa.
- Tematy commitów: tryb rozkazujący, zdaniowa wielkość liter, bez prefiksu.
- Konfiguracja lokalna: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` w `.env.local` (w CI: zmienna buildu
  Workers Builds), `CLERK_JWT_KEY` w `.dev.vars` dla `wrangler dev` (w produkcji: `wrangler secret`).
  Klient natywny w trybie dev **wymaga** `EXPO_PUBLIC_API_URL` w `.env.local` — adres
  `wrangler dev --ip 0.0.0.0` w LAN-ie albo, świadomie, produkcji; bez niego
  [src/lib/api.ts](src/lib/api.ts) rzuca czytelny błąd zamiast cicho pisać do produkcyjnej D1.
  Oba pliki są w `.gitignore`.

**Bramki lokalne są trójwarstwowe i stoją PRZED CI, nie zamiast niego.** Każda warstwa łapie to,
co przepuściła poprzednia, i kosztuje tyle, ile warta jest pomyłka na tym etapie:

| Warstwa | Kiedy | Co robi | Koszt |
| --- | --- | --- | --- |
| 1 | po każdej edycji pliku przez agenta | reguły repo na **tym jednym pliku** | ~0,15 s |
| 2 | `git commit` | reguły repo + `eslint --max-warnings=0` na plikach z indeksu; `npm test` gdy ruszony `src/lib/`; `check-lock` gdy ruszone zależności | ~10 s |
| 3 | `git push` | reguły repo, `tsc --noEmit`, `npm test`, `check-lock` — całe drzewo | ~12 s |
| 4 | push i PR na `main` | to samo co warstwa 3 plus `npm ci` i `expo lint`, na Linuksie | ~2 min |

Warstwy 1–3 są **lokalne**, więc da się je pominąć — `--no-verify`, świeży klon bez
`npm run hooks:install`, push z innej maszyny. Warstwa 4
([quality-gate.yml](.github/workflows/quality-gate.yml)) pominąć się nie da i jako jedyna widzi
każdy commit na `main`. **Nie wdraża** — od tego jest Workers Builds — i **nie uruchamia E2E**,
bo Playwright stoi poza `package.json`.

- Warstwa 1 to hook `PostToolUse` w [.claude/settings.json](.claude/settings.json) →
  [claude-post-edit.mjs](scripts/hooks/claude-post-edit.mjs). Kod wyjścia **2** jest umowny:
  Claude Code wstrzykuje wtedy `stderr` z powrotem do kontekstu agenta, więc naruszenie wraca
  do niego od razu, a nie kilkanaście minut później z czerwonego commita. Hook nigdy nie wywraca
  się na własnym błędzie (`catch` → wyjście 0) i **nie uruchamia** `eslint` ani `tsc`: jedno
  wywołanie każdego z nich to tu 8–9 s, a warstwa 1 ma być niezauważalna.
- Warstwy 2 i 3 to `hooks/pre-commit` i `hooks/pre-push` — dwie linijki wołające
  [git-gate.mjs](scripts/hooks/git-gate.mjs). Logika jest w Node, nie w `sh`, bo to repo żyje na
  Windowsie. **Aktywacja jest jawna i per klon:** `npm run hooks:install`
  (`git config core.hooksPath hooks`) — bez tego pliki w [hooks/](hooks/) leżą martwe. Pominięcie
  jednorazowe: `--no-verify`.
- `npm`/`npx` na Windowsie to pliki `.cmd`, których Node 25 **odmawia** uruchomić bez
  `shell: true` (EINVAL). Bramka odróżnia więc „narzędzie znalazło problem" (kod ≠ 0) od
  „narzędzie się nie uruchomiło" (`result.error`) — inaczej wypisuje FAIL w 0,0 s, nie sprawdziwszy
  niczego.

Migracje D1 mają własną kolejność i **nie idą przez CI**:

```sh
npx wrangler d1 migrations create mealplan <nazwa>   # nowy plik w migrations/, do niego para w down/
npx wrangler d1 migrations apply mealplan --local    # baza wrangler dev (.wrangler/state)
npx wrangler d1 migrations list mealplan --remote    # zaległe na produkcji
npx wrangler d1 migrations apply mealplan --remote   # produkcja — PRZED commitem fazy, która jej używa
```

- **Warunek produkcyjny wchodzi przed commitem fazy** (Twarde reguły) — tu konkretnie: zmienna
  buildu w Workers Builds, `wrangler secret put`, `migrations apply --remote`.
- Migracje wstecz w `migrations/down/` uruchamia wyłącznie człowiek, po `npx wrangler d1 export
  mealplan --remote --output kopia.sql`. Plik `down` usuwa też wpis z `d1_migrations`, inaczej
  `migrations apply` nie odtworzy tabeli. `wrangler rollback` cofa **kod, nie schemat**.
- Podgląd danych: `npx wrangler d1 execute mealplan --local --command "…"`; na produkcji to samo
  z `--remote`, wyłącznie odczyt.

Wdrożenie ma własną, obowiązkową kolejność — `wrangler deploy` **nie buduje**:

```sh
npx expo export -p web                                # dist/client + dist/server
npx wrangler deploy --dry-run --outdir .wrangler-dry  # 6 modułów, nic z node_modules
npx wrangler dev                                      # bramka: workerd lokalnie
npx wrangler deploy                                   # produkcja
```

- **`npx wrangler dev` na zbudowanym `dist/` to bramka przed każdym deployem** (Twarde reguły).
- **Stage'uj po ścieżkach, nigdy `git add -A` ani `git add .`** (Twarde reguły) — tu konkretnie:
  po każdym zadaniu `git diff --stat package-lock.json` ma być pusty.
- Smoke test po wdrożeniu: `/` zwraca HTML, nieznana ścieżka zwraca 404, `/api/health` zwraca
  `{"ok":true,"d1":true,…}` (`d1:true` znaczy „tabela `app_user` istnieje", nie tylko „binding
  działa"), a `/api/account` bez nagłówka `Authorization` zwraca 401. Jeśli HTML działa, a trasa API
  daje 500 — patrz `rules` wyżej; 500 z `/api/account` przy działającym `/api/health` to brak lub
  zepsuty sekret `CLERK_JWT_KEY` (`wrangler tail` pokaże `[auth]`).
- Logi na żywo: `npx wrangler tail`. Rollback: `npx wrangler rollback` — cofa **kod, nie schemat D1**.
- **Hash bundla webowego może się zmienić bez żadnej zmiany w źródłach** (sporadyczna
  niedeterministyczność Metro — cztery buildy tego samego drzewa dały trzy hashe). Nazwę zasobu do
  sprawdzenia bierz więc z wdrożonego HTML-a, nie z lokalnego `dist/`, inaczej dostaniesz 404, które
  wygląda jak zepsute wdrożenie. Uboczny skutek: część deployów unieważnia stare adresy assetów,
  więc otwarta u kogoś strona z przed deployu może stracić swój bundel do odświeżenia.
- **Wdraża Cloudflare Workers Builds** z gałęzi `main`; **sprawdza jakość GitHub Actions**
  ([quality-gate.yml](.github/workflows/quality-gate.yml)) na pushu i PR do `main`. To dwie różne
  rzeczy podpięte do tej samej gałęzi: bramka nie wdraża, a Workers Builds nie uruchamia lintu ani
  testów. Bramka jest **czwartą** warstwą, nie zamiennikiem trzech lokalnych — nadal odpalaj
  `tsc` i `npm test` przed pushem, bo czerwony przebieg na `main` znaczy, że kod już jest
  wdrażany.

## Dokumenty projektu

Repo pracuje w łańcuchu 10x (`.claude/skills/10x-*`). Konwencje katalogów opisują README
w [context/foundation/](context/foundation/README.md), [context/changes/](context/changes/README.md)
i [context/archive/](context/archive/README.md) — ten ostatni jest **niezmienny**, żaden skill tam
nie pisze. **Przed planowaniem i przeglądem czytaj**
[context/foundation/lessons.md](context/foundation/lessons.md) — rejestr powtarzających się reguł,
tylko do dodawania; mapa ryzyk i bramki jakości są w
[context/foundation/test-plan.md](context/foundation/test-plan.md).
Briefy z lekcji kursu leżą w [notes/](notes/) (`10x-lesson-*-brief.md`).

## Praca równoległa i worktree

**Worktree jest obowiązkowy, gdy w tym drzewie pracuje ktoś jeszcze** — druga sesja agenta,
druga osoba, cokolwiek, co może mieć własne pliki w `git status`. 13.09 `git add -A` wciągnęło
na `main` niedokończony plik innej sesji; to jedyny znany sposób, żeby to się nie powtórzyło.
Dla zmiany w pojedynkę worktree jest opcjonalny i zwykle nie warty kosztu (niżej).

Świeży worktree to czysty checkout, więc **nie ma nic z `.gitignore`** — zmierzone 13.09.2026:

- **`node_modules`.** `npm test` działa (wbudowany runner Node), ale `tsc` i `eslint` nie mają
  czym ruszyć, więc **`pre-commit` zatrzymuje commit na eslincie**, a `--no-verify` jest zakazane.
  Zamiast `npm ci` w worktree podepnij złącze:
  `cmd /c mklink /J "<worktree>\node_modules" "C:\Prywatne\Dieta 2\node_modules"`.
  **Odepnij je (`cmd /c rmdir …`) ZANIM usuniesz worktree** — narzędzie, które pójdzie *przez*
  złącze zamiast je odpiąć, skasuje `node_modules` drzewa głównego.
- **`.expo/types/`** z typami tras. Bez nich `tsc` przechodzi, ale `typedRoutes` milczy (Pułapki).
- **`.env.local` i `.dev.vars`** — bez nich `wrangler dev` i klient natywny nie wystartują.

**Stage'owanie po ścieżkach** (Twarde reguły) jest w dzielonym drzewie tym ważniejsze, że cudze
pliki są tu normą, a nie wyjątkiem.

**Równoległość ogranicza przepustowość przeglądu, nie liczba agentów.** Więcej równoległych
gałęzi to więcej nieprzejrzanego kodu, a nie więcej gotowej pracy — to repo ma już dowód, że
nieprzejrzana faza trafia na produkcję (faza 1 F-01). Otwieraj tyle worktree, ile zmian jesteś
w stanie **przejrzeć**, i ani jednego więcej.

## Pułapki

- **`10x get <ref>` kasuje skille spoza manifestu tej lekcji.** Nie dokłada kumulatywnie, tylko
  synchronizuje `.claude/skills/` do stanu żądanej lekcji. Lekcje modułu 4 deklarują zero skilli,
  więc `10x get m4l1` usuwa cały łańcuch 10x, a `CLAUDE.md` bywa przy tym przepisywany.
  Uruchamiaj wyłącznie przy czystym `git status`, żeby dało się cofnąć przez
  `git checkout <sha> -- .claude CLAUDE.md`. Stan obecny: manifest m3l5 (24 skille) plus siedem
  skilli modułu 5 nałożonych ręcznie — łącznie 30.
- ~~`npx tsc --noEmit` na świeżym klonie zgłasza dwa fałszywe błędy o `.css`.~~ **Rozwiązane
  13.09.2026** przez [expo-types.d.ts](expo-types.d.ts) — jedną linijkę `reference` do `expo/types`
  trzymaną w repozytorium. Wcześniej deklaracje `.css` przychodziły wyłącznie z gitignorowanego
  `expo-env.d.ts`, więc typecheck świecił na czerwono wszędzie, gdzie nikt nie uruchomił Metro:
  świeży klon, świeży `git worktree` i runner GitHub Actions (to ostatnie zablokowało pierwszy
  przebieg bramki jakości).
- **`typedRoutes` NIE działa tam, gdzie nie chodziło Metro** — i to zostaje. `.expo/types/router.d.ts`
  jest w `.gitignore`, a tworzy go wyłącznie `npm start` (`expo export` **nie**, sprawdzone).
  Bez niego `Href` degraduje się do typu ogólnego i nieistniejąca ścieżka w `<Link href>`
  **przestaje być błędem typu** — zmierzone sondą, która lokalnie daje `TS2322`, a na runnerze
  przechodzi. Tej klasy błędu pilnuje więc warstwa 3 (`pre-push`), nie bramka w CI.
- `app.json` → `slug: "meal-plan"` i `scheme: "mealplan"` to tożsamość projektu w EAS. Zmiana
  któregokolwiek psuje buildy; zostały już raz poprawione po scaffoldzie
  ([verification.md](context/changes/bootstrap-verification/verification.md)).
- `npm audit` zgłasza 11 MODERATE z jednego advisory `uuid` wewnątrz łańcucha zależności Expo.
  Poprawka przyjdzie z aktualizacją Expo — nie próbuj tego „naprawiać" samodzielnie.
- Preset `eslint-config-expo` włącza reguły React Compilera, w tym `react-hooks/set-state-in-effect`.
  `setState` w ciele efektu jest **błędem lintu**, nie ostrzeżeniem. Jedyne odstępstwo w repo to
  hydracja w [use-color-scheme.web.ts](src/hooks/use-color-scheme.web.ts) — wyciszona punktowo
  z uzasadnieniem. Nowy `setState` w efekcie prawie zawsze znaczy, że efekt jest niepotrzebny.
