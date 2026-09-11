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

**Blokada:** źródło przepisów i makr jest nierozstrzygnięte (Open Question 1 w PRD). Generator planu
i guardrail ±10% stoją na tej decyzji — nie implementuj generatora, zanim nie zapadnie.

## Twarde reguły

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
- Importy przez aliasy: `@/*` → `src/*`, `@/assets/*` → `assets/*`. Względne `./` tylko dla
  rodzeństwa wewnątrz `src/components/` — tak robi cały starter (8 wystąpień, zero `../`).
  `../` w imporcie to błąd.
- **Zero surowych kolorów i odstępów w `StyleSheet`.** Kolor bierz z `useTheme()`, odstęp i promień
  z `Spacing` ([theme.ts](src/constants/theme.ts)) — to skala nazwana słownie (`half`=2, `one`=4 …
  `six`=64), nie liczby.
- **Tekst i tło przez `ThemedText` / `ThemedView`**, nie `Text` / `View`. Wariant wybiera prop
  `type` (`title`, `subtitle`, `small`, `code`, `link`… / `background`, `backgroundElement`,
  `backgroundSelected`), a nie własny styl inline.
- **`useColorScheme` bierz z [`@/hooks/use-color-scheme`](src/hooks/use-color-scheme.ts), nie
  z `react-native`.** Web renderuje HTML po stronie serwera (`app.json` → `web.output: "server"`),
  więc wariant webowy odracza odczyt schematu do hydracji; hook z `react-native` daje niezgodność
  SSR/klient. Importują jeszcze wprost [app-tabs.tsx](src/components/app-tabs.tsx),
  [app-tabs.web.tsx](src/components/app-tabs.web.tsx) i
  [web-badge.tsx](src/components/web-badge.tsx) — nie powielaj tego.
- **Przewijalne ekrany same rezerwują `BottomTabInset + Spacing.*`** w `paddingBottom` /
  `contentInset`; dolny pasek nawigacji nie jest w layoucie flexbox. Bez tego ostatni element
  chowa się pod zakładkami.
- **Wariant platformowy = osobny plik `foo.web.tsx`**, gdy zmienia drzewo komponentów albo
  importowane API (jak `app-tabs`: `NativeTabs` vs `expo-router/ui`). Metro rozwiązuje `foo.web.tsx`
  przed `foo.tsx`. `Platform.OS` / `Platform.select` zostaw dla pojedynczej wartości — liczby,
  stringa, jednego stylu.

## Architektura

**Warstwa nawigacji jest rozdwojona.** [(app)/_layout.tsx](src/app/(app)/_layout.tsx) montuje jeden
komponent `AppTabs` (root [_layout.tsx](src/app/_layout.tsx) montuje tylko `ClerkProvider`,
`ThemeProvider`, nakładkę splash i `Stack`), ale Metro podstawia inny plik na każdą platformę: natywnie `NativeTabs`
z `expo-router/unstable-native-tabs`, gdzie `NativeTabs.Trigger name` **musi** odpowiadać nazwie
pliku trasy; na webie headless `Tabs` / `TabList` / `TabTrigger` z `expo-router/ui`, gdzie `name`
jest dowolne, a wiąże `href`. Dlatego zakładka „Home" nazywa się tam `home`, a natywnie `index`.

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
Workers z bazą D1 `mealplan` w bindingu `DB`. Dwie trasy API: [health+api.ts](src/app/api/health+api.ts)
(smoke test wdrożenia: adapter, binding D1 **i** obecność tabeli `app_user`) oraz
[account+api.ts](src/app/api/account+api.ts) — trasa odniesienia dla granicy danych, nie funkcja
produktowa; nie dokładaj do niej pól, profil ma własną trasę w S-02.

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
`userId` jako pierwszy argument i filtruje po nim w SQL-u, bo D1 nie ma RLS, a repo nie ma testów —
to jedyna izolacja między kontami. `prepare(` żyje wyłącznie w tym katalogu (jedyny wyjątek:
`health+api.ts`), wartości wchodzą przez `bind(...)`. Trasa `+api.ts` ma kształt `requireUserId` →
funkcja repozytorium → JSON, zero SQL-a i zero `getWorkerEnv()`. Wzorzec odniesienia:
[account+api.ts](src/app/api/account+api.ts) + [app-users.ts](src/server/repository/app-users.ts).
Nie dodawaj własnego hashowania ani tabel sesji.

## Komendy i weryfikacja

Skrypty (`start`, `android`, `ios`, `web`, `lint`) są w [package.json](package.json); lint to
`expo lint` z flat configiem w [eslint.config.js](eslint.config.js).

- `npx tsc --noEmit` — jedyne realne sprawdzenie poprawności w tym repo. Nie jest skryptem npm.
- `npm run check-lock` — przed każdym pushem, jeśli ruszałeś zależności. Odtwarza sprawdzenie
  spójności robione przez `npm ci`, więc łapie zepsuty lock lokalnie, zamiast na czerwonym buildzie.
- Nie ma runnera testów. „Przetestowane" znaczy: `npx tsc --noEmit` przechodzi i ekran został
  otwarty na realnej platformie.
- Tematy commitów: tryb rozkazujący, zdaniowa wielkość liter, bez prefiksu.
- Konfiguracja lokalna: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` w `.env.local` (w CI: zmienna buildu
  Workers Builds), `CLERK_JWT_KEY` w `.dev.vars` dla `wrangler dev` (w produkcji: `wrangler secret`).
  Klient natywny w trybie dev **wymaga** `EXPO_PUBLIC_API_URL` w `.env.local` — adres
  `wrangler dev --ip 0.0.0.0` w LAN-ie albo, świadomie, produkcji; bez niego
  [src/lib/api.ts](src/lib/api.ts) rzuca czytelny błąd zamiast cicho pisać do produkcyjnej D1.
  Oba pliki są w `.gitignore`.

Migracje D1 mają własną kolejność i **nie idą przez CI**:

```sh
npx wrangler d1 migrations create mealplan <nazwa>   # nowy plik w migrations/, do niego para w down/
npx wrangler d1 migrations apply mealplan --local    # baza wrangler dev (.wrangler/state)
npx wrangler d1 migrations list mealplan --remote    # zaległe na produkcji
npx wrangler d1 migrations apply mealplan --remote   # produkcja — PRZED commitem fazy, która jej używa
```

- **Warunek produkcyjny wchodzi przed commitem fazy, która go potrzebuje** — zmienna buildu
  w Workers Builds, `wrangler secret put`, `migrations apply --remote`. Push na `main` wdraża
  natychmiast, więc kod czekający na sekret lub tabelę stałby na produkcji i zwracał 500.
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

- **`npx expo start --web` nie jest testem wdrożenia** — uruchamia trasy API w Node. Wierność
  runtime'u daje tylko `npx wrangler dev` na zbudowanym `dist/`. To bramka przed każdym deployem.
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
- CI to Cloudflare Workers Builds na gałęzi `main` (nie GitHub Actions). Typecheck i lint nadal
  uruchamiasz sam przed pushem.

## Dokumenty projektu

Repo pracuje w łańcuchu 10x (`.claude/skills/10x-*`). Konwencje katalogów opisują README
w [context/foundation/](context/foundation/README.md), [context/changes/](context/changes/README.md)
i [context/archive/](context/archive/README.md) — ten ostatni jest **niezmienny**, żaden skill tam
nie pisze. Kontekst kursowy: [notes/10x-lesson-m1l4-brief.md](notes/10x-lesson-m1l4-brief.md).

## Pułapki

- `npx tsc --noEmit` na świeżym klonie zgłasza dwa fałszywe błędy o `.css`
  (`animated-icon.module.css`, `@/global.css`). Deklaracje tych modułów siedzą w `expo-env.d.ts`
  i `.expo/types/`, które są generowane przy pierwszym `npm start` i są w `.gitignore`. Uruchom
  Metro raz, zanim uznasz typecheck za czerwony.
- `app.json` → `slug: "meal-plan"` i `scheme: "mealplan"` to tożsamość projektu w EAS. Zmiana
  któregokolwiek psuje buildy; zostały już raz poprawione po scaffoldzie
  ([verification.md](context/changes/bootstrap-verification/verification.md)).
- `npm audit` zgłasza 11 MODERATE z jednego advisory `uuid` wewnątrz łańcucha zależności Expo.
  Poprawka przyjdzie z aktualizacją Expo — nie próbuj tego „naprawiać" samodzielnie.
- Preset `eslint-config-expo` włącza reguły React Compilera, w tym `react-hooks/set-state-in-effect`.
  `setState` w ciele efektu jest **błędem lintu**, nie ostrzeżeniem. Jedyne odstępstwo w repo to
  hydracja w [use-color-scheme.web.ts](src/hooks/use-color-scheme.web.ts) — wyciszona punktowo
  z uzasadnieniem. Nowy `setState` w efekcie prawie zawsze znaczy, że efekt jest niepotrzebny.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Moduł 2, Lekcja 2

Przekształć jeden element planu działania w pierwszy cykl implementacji za pomocą **łańcucha planowania zmian**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review` i `/10x-implement` to główne tematy lekcji. `/10x-frame` i `/10x-research` nie są tutaj wymaganymi rytuałami; są to ścieżki eskalacji wprowadzone w następnej lekcji.

### Router zadań — Od czego zacząć

| Umiejętność | Użyj, gdy |
| --- | --- |
| **Konfiguracja zmiany (główny temat lekcji)** | |
| `/10x-new <change-id>` | Wybrałeś element planu działania i potrzebujesz stabilnego folderu zmian. Tworzy `context/changes/<change-id>/change.md`, dzięki czemu planowanie, implementacja, postęp, commity i późniejsza recenzja mają jedną tożsamość. Użyj PO wyborze planu działania, PRZED `/10x-plan`. |
| **Planowanie (główny temat lekcji)** | |
| `/10x-plan <change-id>` | Masz folder zmian i potrzebujesz planu implementacji do recenzji. Odczytuje kontekst planu działania, dokumenty podstawowe, dowody z bazy kodu i wszelkie istniejące notatki o zmianach; zapisuje `plan.md` i `plan-brief.md` z fazami, kontraktami plików, kryteriami sukcesu i `## Progress`. |
| **Gotowość planu (główny temat lekcji)** | |
| `/10x-plan-review <change-id>` | Masz `plan.md` i potrzebujesz lekkiej kontroli gotowości przed kodowaniem. Użyj jej, aby wychwycić brakujący stan końcowy, słabe kontrakty, źle sformułowany postęp, dryf zakresu lub martwe punkty, zanim rozpoczną się zmiany w kodzie. |
| **Implementacja (główny temat lekcji)** | |
| `/10x-implement <change-id> phase <n>` | Masz zatwierdzony plan i chcesz wykonać jedną fazę z weryfikacją, ręczną bramką, rytuałem commitowania i zapisem SHA do `## Progress`. |
| **Zamknięcie cyklu życia** | |
| `/10x-archive <change-id>` | Zmiana została scalona lub celowo zamknięta. Przenieś ją z aktywnego `context/changes/` do stanu archiwum. |

### Jak działa przekazywanie w łańcuchu

- `/10x-new` tworzy trwałą tożsamość zmiany.
- `/10x-plan` przekształca tę tożsamość w kontrakt implementacyjny.
- `/10x-plan-review` sprawdza plan, zanim agent zmodyfikuje kod.
- `/10x-implement` wykonuje jedną zaplanowaną fazę, weryfikuje, prosi o ręczne potwierdzenie w razie potrzeby, commituje i rejestruje postęp.

### Granice lekcji

- Plan jest domyślnym routerem po wyborze planu działania. Zacznij od `/10x-plan`, chyba że problem jest niejasny lub blokują go zewnętrzne dowody.
- Nie uruchamiaj `/10x-frame + /10x-research` jako ceremonii dla każdej zmiany.
- Nie przekształcaj tej lekcji w pełną, kompleksową budowę produktu. Punkt kontrolny z zaplanowanym i częściowo lub w pełni zaimplementowanym strumieniem jest ważny.
- Przegląd kodu zaimplementowanej różnicy należy do Lekcji 3 za pośrednictwem `/10x-impl-review`.
- Zamknięcie cyklu życia za pomocą `/10x-archive` po scaleniu zmiany lub jej celowym zamknięciu.

### Ścieżki używane w tej lekcji

- `context/foundation/roadmap.md` - plan działania upstream
- `context/changes/<change-id>/change.md` - tożsamość zmiany
- `context/changes/<change-id>/plan.md` - kontrakt implementacyjny
- `context/changes/<change-id>/plan-brief.md` - skompresowane przekazanie
- `context/foundation/lessons.md` - powtarzające się zasady i pułapki
- `docs/reference/contract-surfaces.md` - rejestr nazw nośnych

Umiejętności nie mogą zapisywać do `context/archive/`. Zarchiwizowane zmiany są niezmienne; jeśli rozwiązana ścieżka docelowa zaczyna się od `context/archive/`, przerwij z komunikatem: "Ta zmiana jest zarchiwizowana. Zamiast tego otwórz nową zmianę za pomocą `/10x-new`."

<!-- END @przeprogramowani/10x-cli -->
