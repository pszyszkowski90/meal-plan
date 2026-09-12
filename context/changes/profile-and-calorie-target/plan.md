# Profil użytkownika i wyliczone zapotrzebowanie kaloryczne — plan implementacji

> Zmiana: `profile-and-calorie-target` (S-02 mapy drogowej, kamień M-01)
> Odnośniki PRD: FR-002, FR-003, Open Question 5 · Wymaganie wstępne: S-01 (`account-and-login`, done)
> Wersja 1.1 (2026-09-12, po przeglądzie planu F1–F5). Wcześniejsze badanie tej zmiany (8.09.2026) nie zostało zacommitowane
> i przepadło razem z folderem; jego ustalenia zostały odtworzone w sesji planowania.

## Przegląd

Zalogowany użytkownik podaje w zakładce **Profil** wiek, wagę, wzrost, płeć (do wzoru) i poziom
aktywności w skali 1–5, może to później edytować i widzi wynikające z tego dzienne zapotrzebowanie
kaloryczne z rozbiciem na podstawową przemianę materii i współczynnik aktywności. Może nadpisać
cel własną liczbą kcal i jednym gestem wrócić do wyliczenia. Ekran startowy pokazuje kartę
obowiązującego celu albo wezwanie do uzupełnienia profilu.

Wynik tej zmiany jest **wejściem ograniczenia ±10%** generatora (S-04): to stąd generator weźmie
cel dnia. Dlatego wzór żyje w jednym czystym module współdzielonym przez klienta i serwer, a jego
stałe są przypięte testem.

## Analiza stanu obecnego

Wszystko, czego ta zmiana potrzebuje od infrastruktury, zostało zbudowane w S-01 świadomie „pod
S-02” i działa na produkcji:

- **Granica danych.** [`requireUserId`](../../../src/server/auth.ts) zamienia żądanie na `userId`
  albo 401/500; [`touchAppUser`](../../../src/server/repository/app-users.ts) jest wzorcem
  repozytorium (`userId` pierwszym argumentem, `bind(...)`, komentarz nagłówkowy nazywa regułę);
  [`account+api.ts`](../../../src/app/api/account+api.ts) jest wzorcem trasy (`requireUserId` →
  repozytorium → JSON, `try/catch` z 500 bez wycieku, `userId` nie trafia do logu).
- **Transport tokenu.** [`useAuthedFetch()`](../../../src/hooks/use-authed-fetch.ts) z trzema
  stanami (`OfflineError`, `NotSignedInError`, odpowiedź). Nagłówki idą przez `new Headers(...)`,
  więc `Content-Type: application/json` w pierwszym `PUT` nie zginie.
- **Schemat.** [`0001_app_user.sql`](../../../migrations/0001_app_user.sql) z parą w `down/`;
  komentarz w migracji obiecuje `REFERENCES app_user(id)` dla profilu. Typ D1 w
  [`env.ts`](../../../src/server/env.ts) ma `bind`, `first`, `run` — wystarcza.
- **UI.** [`TextField`](../../../src/components/ui/text-field.tsx) (etykieta + błąd pod polem),
  [`ActionButton`](../../../src/components/ui/action-button.tsx) (`busy`), `ThemedText` /
  `ThemedView`, `Spacing`. Ekrany `(app)` to nadal starter: `index.tsx` z „Welcome to Expo”
  i wierszem `userId`, `explore.tsx` o Expo. Zakładki są zdublowane platformowo
  ([`app-tabs.tsx`](../../../src/components/app-tabs.tsx) `NativeTabs`,
  [`app-tabs.web.tsx`](../../../src/components/app-tabs.web.tsx) `expo-router/ui`).

Czego **nie ma**:

- Żadna trasa nie czyta ciała żądania ani nie waliduje wejścia — to będzie pierwszy `PUT`.
- Nie ma kontrolki wyboru (płeć, aktywność 1–5) — `TextField` obsługuje tylko tekst.
- Nie ma runnera testów. Repo działa na Node 25, więc `node --test` ze zdejmowaniem typów
  (sprawdzone empirycznie w sesji planowania: `.test.ts` importujący `./modul.ts` przechodzi bez
  transpilera) pozwala przetestować czysty moduł bez nowej zależności.
- Typed routes (`.expo/types/router.d.ts`) znają `/explore`, nie znają `/profile`; regenerują
  się dopiero po uruchomieniu Metro.

## Pożądany stan końcowy

Na produkcji (web) i w Expo Go przeciw produkcyjnemu API:

1. Zakładki to **Home** i **Profil**; Explore nie istnieje (`/explore` → 404 na webie).
2. Profil bez danych pokazuje pusty formularz i komunikat „Uzupełnij pola, żeby policzyć”.
   W trakcie wpisywania, gdy wszystkie pola są poprawne, pod formularzem pojawia się rozbicie:
   „Podstawowa przemiana materii: 1 780 kcal (Mifflin-St Jeor)”, „× 1.55 za aktywność
   umiarkowaną (poziom 3)”, „= 2 759 kcal dziennie”, plus zdanie, że tyle utrzymuje wagę i że cel
   można nadpisać.
3. „Zapisz” utrwala profil w D1 przez `PUT /api/profile`; błędy walidacji wracają pod pola;
   offline nie kasuje wpisanych wartości i nie wylogowuje.
4. Pole „Własny cel (kcal)” nadpisuje cel obowiązujący; ekran pokazuje oba („wyliczone 2 759,
   Twój cel 2 200”), a „Wróć do wyliczenia” czyści nadpisanie. Edycja profilu **nie** kasuje
   nadpisania.
5. Home pokazuje kartę: obowiązujący cel dnia (z dopiskiem „nadpisany, wyliczone X”, gdy dotyczy)
   albo „Uzupełnij profil, żeby policzyć zapotrzebowanie” z przejściem do Profilu. Po zapisie
   w Profilu i powrocie na Home karta jest aktualna.
6. `GET /api/profile` bez tokenu → 401; z tokenem konta bez profilu → 200 `{ profile: null,
   target: null }`; z tokenem konta A nigdy nie zwraca danych konta B.
7. `npm test` przechodzi i przypina stałe wzoru; `npx tsc --noEmit` i `npx expo lint` czyste.

### Kluczowe odkrycia:

- [`account+api.ts:1-20`](../../../src/app/api/account+api.ts) — komentarz zabrania dokładania
  tam pól profilu i wskazuje własną trasę dla S-02; kształt `try/catch` → `{ error: 'internal' }`
  jest kontraktem odpowiedzi, który trasa profilu powtarza.
- [`app-users.ts:1-16`](../../../src/server/repository/app-users.ts) — reguła repozytorium;
  `touchAppUser` pisze co najwyżej raz na godzinę, więc wołanie go przed zapisem profilu nie
  narusza limitu zapisów D1.
- [`use-authed-fetch.ts:28-32`](../../../src/hooks/use-authed-fetch.ts) — nagłówki przez
  `new Headers(init?.headers)`, komentarz wprost przewiduje pierwszy `POST` z `Content-Type`.
- [`index.tsx:116-157`](../../../src/app/(app)/index.tsx) — wzorzec „jedno żądanie przy wejściu”
  na `useRef`, mapowanie `OfflineError` / `NotSignedInError` na stany ekranu; komunikat offline
  mówi to, co kod robi (bez obietnicy ponowienia).
- `expo-router` eksportuje `useIsFocused` i `useFocusEffect` (`build/exports.d.ts:19-20`) — sygnał
  fokusu zakładki załatwia odświeżenie karty na Home po zapisie w Profilu bez globalnego stanu.
  Używamy **`useIsFocused()`**, nie `useFocusEffect`: ten drugi to `useEffect(..., [effect, …])`
  (`build/useFocusEffect.js`), który w fokusie wykonuje callback synchronicznie przy każdej zmianie
  jego tożsamości — bez `useCallback` (zakazanego w repo) poprawność zależałaby od tego, czy React
  Compiler zmemoizował closure. Boolean z `useIsFocused` jest deterministyczny (przegląd planu, F2).
- `NativeTabs.Trigger.Icon` przyjmuje też `sf` (SF Symbols, iOS) i `drawable` (Android)
  (`build/native-tabs/common/elements.d.ts:84,141`), ale `drawable` to nazwa **natywnego zasobu**
  skompilowanego w aplikację — Expo Go nie ma drawable'i projektu, więc na Androidzie ikona by
  nie wyszła. Zakładka Profil dostaje PNG w istniejącym wzorcu (`src={require(…)}` +
  `renderingMode="template"`), jak Home (przegląd planu, F3).
- D1 wymusza klucze obce domyślnie, więc `user_profile.user_id REFERENCES app_user(id)` odrzuci
  zapis dla konta, które nigdy nie wołało `/api/account`. Trasa zapisu **musi** wołać
  `touchAppUser` przed `saveUserProfile`.
- `tsconfig.json` dziedziczy `noEmit: true` z `expo/tsconfig.base`, więc `allowImportingTsExtensions`
  jest dozwolone; `@types/node` jest już w `node_modules/@types` tranzytywnie, więc `node:test`
  i `node:assert` przejdą `tsc` bez nowej zależności.
- `package.json` nie ma `"type"`. Node ostrzega (`MODULE_TYPELESS_PACKAGE_JSON`) przy każdym
  teście; dopisanie `"type": "module"` jest **zakazane** (CommonJS-owe `scripts/*.js` i trasy Metro
  emitowane jako CommonJS — reguła `rules` w `wrangler.jsonc`). Ostrzeżenie wyciszamy flagą
  `--disable-warning`.

## Czego NIE robimy

- **Pola celu** (schudnąć / utrzymać / przytyć) ani presetów deficytu — decyzja z sesji
  planowania: jedyną korektą jest ręczne nadpisanie z FR-003. Wybór wielkości deficytu ociera się
  o poradę dietetyczną wykluczoną w Non-Goals PRD.
- **Historii pomiarów, wykresów, automatycznego przeliczania celu** — Non-Goals PRD.
- **Onboardingu wymuszającego profil** (przekierowanie na `/profile` do czasu zapisu) — bramki
  sesji mają jednego właściciela; S-04 sam odmówi generowania bez profilu.
- **Utrwalania wyliczonego celu w D1** — zapisujemy wejścia i nadpisanie, liczymy przy odczycie
  tym samym modułem, którego użyje S-04. Zero dryfu między ekranem a generatorem.
- **Jednostek imperialnych, wieku poniżej 18 lat, trzeciej wartości płci** — decyzje z sesji.
- **Podziału zapotrzebowania na posiłki** — liczba posiłków to S-03 (FR-007), podział to S-04.
- **Vitest, testów komponentów, testów tras API** — runner ogranicza się do czystych modułów
  w `src/lib/`; szerszy runner to osobna decyzja, gdy pojawi się drugi kandydat.
- **Usuwania konta / profilu, eksportu danych** — poza zakresem M-01.
- **Przebudowy Home poza kartą celu** — Home docelowo należy do S-04 (plan tygodnia).
- **Sprzątania nieużywanych assetów startera** (`tutorial-web.png`, `react-logo*.png`,
  `collapsible.tsx`) — nic nie kosztują; wrócą przy S-04.

## Podejście do implementacji

Cztery fazy od środka na zewnątrz, każda z własną bramką:

1. **Wzór jako czysty moduł z testem** — najpierw to, co niesie ryzyko z mapy drogowej („błąd we
   wzorze przenosi się na każdy plan”). Moduł nie ma zależności od Reacta ani D1, więc testuje się
   natywnym runnerem Node bez zmiany `package-lock.json`.
2. **Serwer** — migracja, repozytorium, trasa. Powtarza kształt S-01 jeden do jednego; jedyna
   nowość to czytanie i walidacja ciała, którą robi moduł z fazy 1. Migracja idzie `--remote`
   **przed** commitem fazy (auto-deploy z `main`).
3. **Klient** — prymityw wyboru, ekran profilu z podglądem na żywo (ten sam moduł liczy po obu
   stronach), zakładki na dwóch platformach, karta na Home.
4. **Produkcja i reguły** — smoke na wdrożonym Workerze, przebieg na webie i w Expo Go,
   `CLAUDE.md` opisuje stan po zmianie.

Kontrakt przewodowy `/api/profile` jest jeden dla `GET` i `PUT` (`{ profile, target }`), więc
ekran po zapisie nie musi niczego przeliczać ani scalać — bierze to, co wróciło.

## Krytyczne szczegóły implementacji

- **Kolejność faz 2 i 3 względem produkcji.** Push fazy 2 wystawia trasę czytającą `user_profile`
  w chwili wdrożenia — `migrations apply --remote` idzie przed commitem, jak `0001` w S-01. Faza 3
  nie ma warunku produkcyjnego.
- **Zaokrąglanie jest częścią kontraktu, nie detalem.** Wyjaśnienie ma być sprawdzalne ręcznie,
  więc wynik liczy się z **zaokrąglonego** BMR: `computedKcal = round(round(bmr) × mnożnik)`. Bez
  tego „1 320 × 1.375 = 1 815” na ekranie rozjechałoby się o 1 kcal z tym, co użytkownik policzy
  w kalkulatorze. Test przypina tę regułę.
- **Import z rozszerzeniem `.ts` istnieje wyłącznie w pliku testu.** Node nie zgaduje rozszerzeń
  w ESM, więc `calorie-target.test.ts` importuje `./calorie-target.ts`. Sam moduł nie ma żadnego
  importu względnego, więc Metro i typed routes nic nie zauważą. To świadomy wyjątek od reguły
  „względne `./` tylko w `src/components/`” — zapisany w `CLAUDE.md` w fazie 4.
- **Klucz obcy wymaga wiersza `app_user`.** Zapis profilu na koncie, które nigdy nie weszło na
  Home (a więc nie wołało `/api/account`), padłby na `FOREIGN KEY constraint failed`. Trasa `PUT`
  woła `touchAppUser(userId)` przed `saveUserProfile` — to jedno tanie zapytanie.
- **Typed routes.** `href="/profile"` na Home jest błędem typu, dopóki Metro nie zregeneruje
  `.expo/types/router.d.ts`. W fazie 3 najpierw powstaje `profile.tsx`, potem jedno `npx expo
  start` (można przerwać po starcie), dopiero potem `Link` na Home i `tsc`.
- **Odświeżanie karty na Home.** `const isFocused = useIsFocused()` + `useEffect` z `isFocused`
  w zależnościach i refem `fetchedForFocus`: gdy `isFocused` jest `false`, efekt zeruje ref i kończy;
  gdy `true` i ref jest pusty — ustawia ref i wysyła jedno żądanie. Tak jak w `index.tsx:87-88`
  o „raz” decyduje ref, nie tożsamość `authedFetch` ani closure — pętla żądań jest niemożliwa
  niezależnie od tego, co zmemoizuje React Compiler. Efekt ustawia stan wyłącznie w callbackach
  obietnicy (nie synchronicznie w ciele efektu — reguła lintu `react-hooks/set-state-in-effect`)
  i zwraca cleanup ustawiający flagę `cancelled`, żeby odpowiedź z poprzedniego wejścia nie
  nadpisała nowszej.
- **Wejście liczbowe po polsku.** Waga z przecinkiem („70,5”) jest normalna na polskiej
  klawiaturze; parser modułu zamienia przecinek na kropkę. Pola liczbowe dostają
  `keyboardType="decimal-pad"` / `"number-pad"` oraz `inputMode="decimal"` / `"numeric"` dla webu.

## Phase 1: Wzór i walidacja jako czysty moduł z testem

### Przegląd

Powstaje jedyne miejsce w repo, które wie, czym jest profil i jak liczy się cel — używane przez
formularz (podgląd na żywo, błędy pod polami) i przez trasę API (walidacja ciała, wyliczenie
w odpowiedzi). Stałe wzoru są przypięte testem uruchamianym natywnym runnerem Node.

### Wymagane zmiany:

#### 1. Konfiguracja TypeScript

**Plik**: `tsconfig.json`

**Cel**: pozwolić plikowi testu importować sąsiada z jawnym rozszerzeniem `.ts`, czego wymaga
Node przy zdejmowaniu typów.

**Umowa**: `compilerOptions.allowImportingTsExtensions: true`. Dozwolone, bo baza Expo ma
`noEmit: true`. Nic więcej się nie zmienia; `include` już obejmuje `**/*.ts`, więc test jest
typowany przez `tsc` (typy `node:test` z tranzytywnego `@types/node`).

#### 2. Skrypt testowy

**Plik**: `package.json`

**Cel**: dać repo komendę `npm test` bez nowej zależności.

**Umowa**: `"test": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/lib/*.test.ts"`.
Zero zmian w `dependencies` / `devDependencies`, więc `package-lock.json` zostaje nietknięty —
`npm run check-lock` mimo to uruchamiamy (kryterium 1.4), bo to reguła przed pushem.

#### 3. Moduł wzoru i kontraktu

**Plik**: `src/lib/calorie-target.ts`

**Cel**: jedna definicja profilu, granic, walidacji, wzoru i kontraktu przewodowego, bez importów
z Reacta, React Native, Clerka ani D1 — moduł ma wchodzić do bundla klienta i do `dist/server`.
Składnia ograniczona do tego, co Node zdejmuje w trybie strip-only: **zero `enum`, `namespace`
i parameter properties** (`ActivityLevel` to unia literałów, mnożniki to `Record` z `as const`) —
inaczej `npm test` pada, a `tsc` tego nie zgłosi.

**Umowa** (nazwy są nośne — używa ich faza 2 i 3):

- `type Sex = 'female' | 'male'`; `type ActivityLevel = 1 | 2 | 3 | 4 | 5`.
- `interface ProfileInput { age: number; weightKg: number; heightCm: number; sex: Sex;
  activityLevel: ActivityLevel; targetKcalOverride: number | null }`.
- `ProfileBounds` — `age 18–100` (całkowity), `weightKg 30–300` (normalizowane do 0,1 kg),
  `heightCm 100–250` (całkowity), `targetKcal 1000–6000` (całkowity). Granice włącznie.
- `ActivityMultiplier: Record<ActivityLevel, number>` = `1.2, 1.375, 1.55, 1.725, 1.9`;
  `ActivityLabel: Record<ActivityLevel, string>` — polskie etykiety poziomów („siedzący”, „lekko
  aktywny”, „umiarkowanie aktywny”, „bardzo aktywny”, „wyczynowo aktywny”). Etykiety są tu, nie
  w ekranie, bo wyjaśnienie w odpowiedzi API i w podglądzie ma brzmieć identycznie.
- `parseNumberInput(text: string): number | null` — trim, przecinek → kropka, pusty / nieliczbowy
  → `null`.
- `validateProfile(input: unknown): { ok: true; value: ProfileInput } | { ok: false; errors:
  ProfileFieldErrors }`, gdzie `ProfileFieldErrors = Partial<Record<keyof ProfileInput, string>>`
  z polskimi komunikatami gotowymi do renderu pod polem. Przyjmuje `unknown`, bo po stronie
  serwera wejściem jest ciało żądania; odrzuca nieznane kształty bez rzucania wyjątku. Reguły
  wspólne dla obu wywołujących (ekran i trasa), żeby nie rozjechały się w interpretacji:
  pola liczbowe przyjmują **wyłącznie skończony `number`** — `null`, `undefined`, `NaN`, string
  → błąd „Podaj …” na tym polu; **formularz parsuje tekst przez `parseNumberInput` przed
  wywołaniem `validateProfile`** (moduł nie przyjmuje stringów liczbowych); `targetKcalOverride`
  brakujący (`undefined`) jest równoważny `null` — „obowiązuje wyliczenie”.
- `interface CalorieTarget { bmrKcal: number; multiplier: number; activityLevel: ActivityLevel;
  computedKcal: number; overrideKcal: number | null; effectiveKcal: number }`.
- `computeCalorieTarget(profile: ProfileInput): CalorieTarget` — Mifflin-St Jeor:
  `10·kg + 6.25·cm − 5·lata`, `+5` dla `male`, `−161` dla `female`; `bmrKcal = round(bmr)`;
  `computedKcal = round(bmrKcal × multiplier)`; `effectiveKcal = overrideKcal ?? computedKcal`.
- Kontrakt przewodowy: `interface ProfileResponse { profile: (ProfileInput & { updatedAt: string })
  | null; target: CalorieTarget | null }` — to, co zwraca `GET` i `PUT /api/profile`.

#### 4. Test wzoru

**Plik**: `src/lib/calorie-target.test.ts`

**Cel**: przypiąć stałe i regułę zaokrąglania tak, żeby zmiana któregokolwiek była widoczna.

**Umowa**: `node:test` + `node:assert/strict`, import `./calorie-target.ts`. Minimalny zestaw:

| Przypadek | Wejście | Oczekiwane |
| --- | --- | --- |
| BMR mężczyzna | 80 kg, 180 cm, 30 lat | `bmrKcal` 1780 |
| BMR kobieta | 60 kg, 165 cm, 30 lat | `bmrKcal` 1320 (surowe 1320.25) |
| Poziomy 1–5 dla 1780 | mnożniki | 2136, 2448, 2759, 3071, 3382 |
| Zaokrąglenie z zaokrąglonego BMR | kobieta 61,3 kg, 170 cm, 45 lat, poziom 3 | `bmrKcal` 1290 (surowe 1289.5), `computedKcal` 2000 (1290 × 1.55 = 1999.5) |
| Nadpisanie | dowolny profil, `targetKcalOverride` 2200 | `effectiveKcal` 2200, `computedKcal` bez zmian |
| Granice | wiek 17 / 18 / 100 / 101; waga 29.9 / 30 / 300 / 300.1; wzrost 99 / 100 / 250 / 251; cel 999 / 1000 / 6000 / 6001 | odrzucone / przyjęte parami |
| Całkowitość | wiek 30.5, wzrost 180.2, cel 2000.5 | odrzucone; waga 70.55 → przyjęta jako 70.6 |
| Kształt | `null`, `{}`, `sex: 'x'`, `activityLevel: 6`, `age: '30'` (string), `age: NaN` | `ok: false` z błędem na właściwym polu, bez wyjątku |
| Brak nadpisania | poprawny profil bez klucza `targetKcalOverride`; z `targetKcalOverride: null` | oba `ok: true` z `targetKcalOverride: null` |
| Parser | `"70,5"`, `" 80 "`, `""`, `"abc"` | 70.5, 80, `null`, `null` |

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npm test` przechodzi ze wszystkimi przypadkami z tabeli
- `npx tsc --noEmit` czyste (plik testu typowany, `node:test` rozpoznane)
- `npx expo lint` czyste
- `npm run check-lock` przechodzi (lockfile nietknięty)

#### Ręczna weryfikacja:

- Moduł nie importuje nic z `react`, `react-native`, `@clerk/*` ani `@/server/*` (`grep -n import
  src/lib/calorie-target.ts` pokazuje zero linii)

**Uwaga implementacyjna**: po zakończeniu tej fazy i weryfikacji automatycznej zatrzymaj się na
potwierdzenie przed fazą 2.

---

## Phase 2: Granica danych profilu na serwerze

### Przegląd

Profil dostaje tabelę, repozytorium i trasę — dokładnie w kształcie S-01. Nowe jest tylko
czytanie ciała `PUT` i walidacja modułem z fazy 1.

### Wymagane zmiany:

#### 1. Migracja i migracja wstecz

**Plik**: `migrations/0002_user_profile.sql`, `migrations/down/0002_user_profile.down.sql`

**Cel**: utrwalić wejścia wzoru i nadpisanie celu, jeden wiersz na użytkownika, dowiązany do
`app_user` tak, jak obiecuje komentarz migracji `0001`.

**Umowa**: plik tworzony przez `npx wrangler d1 migrations create mealplan user_profile`. Tabela
`user_profile(user_id TEXT PRIMARY KEY REFERENCES app_user(id), age INTEGER NOT NULL, weight_kg
REAL NOT NULL, height_cm INTEGER NOT NULL, sex TEXT NOT NULL CHECK (sex IN ('female','male')),
activity_level INTEGER NOT NULL CHECK (activity_level BETWEEN 1 AND 5), target_kcal_override
INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`. `target_kcal_override` `NULL`
znaczy „obowiązuje wyliczenie”. Ograniczenia `CHECK` są drugą linią za `validateProfile`, nie
zamiast niej. Plik wstecz: `DROP TABLE IF EXISTS user_profile` **i** `DELETE FROM d1_migrations
WHERE name = '0002_user_profile.sql'` — bez tego `migrations apply` nie odtworzy tabeli (lekcja
F4 z przeglądu S-01). Komentarze nagłówkowe jak w `0001`.

`--local` do pracy; `--remote` **przed commitem tej fazy** (kryterium 2.11).

#### 2. Repozytorium profilu

**Plik**: `src/server/repository/user-profile.ts`

**Cel**: jedyne miejsce z SQL-em do `user_profile`, z `userId` w pierwszym argumencie każdej funkcji.

**Umowa**:
- `interface UserProfile extends ProfileInput { createdAt: string; updatedAt: string }`
  (`ProfileInput` z `@/lib/calorie-target`).
- `getUserProfile(userId: string): Promise<UserProfile | null>` — `select … where user_id = ?1`,
  `first<Row>()`, mapowanie snake_case → camelCase jak `toAppUser`.
- `saveUserProfile(userId: string, input: ProfileInput): Promise<UserProfile>` — jedno zapytanie
  `insert … on conflict(user_id) do update set … returning …`; zapis jest jawną akcją użytkownika,
  więc **bez** progu świeżości z `touchAppUser` — każdy zapis pisze. `created_at` zostaje przy
  konflikcie, `updated_at` = teraz. `RETURNING` przy `DO UPDATE` bez predykatu `WHERE` zawsze
  oddaje wiersz, więc nie ma odczytu awaryjnego.
- Nagłówek pliku odsyła do reguły z `app-users.ts`, nie kopiuje jej.

#### 3. Trasa profilu

**Plik**: `src/app/api/profile+api.ts`

**Cel**: jedna trasa, dwie metody, jeden kształt odpowiedzi.

**Umowa**:
- `GET`: `requireUserId` → `getUserProfile(userId)` → 200 `ProfileResponse` — `target` liczone
  `computeCalorieTarget(profile)` albo `null`, gdy profilu nie ma. **200 z `profile: null`, nie
  404** — brak profilu jest stanem, nie błędem, a klient nie ma mylić go z awarią.
- `PUT`: `requireUserId` → `request.json()` w `try` (niepoprawny JSON → 400
  `{ error: 'invalid_json' }`) → `validateProfile(body)` (`ok: false` → 400 `{ error: 'invalid',
  fields }`) → `touchAppUser(userId)` (wiersz `app_user` musi istnieć dla klucza obcego) →
  `saveUserProfile(userId, value)` → 200 `ProfileResponse`.
- Obie metody: `try/catch` wokół ścieżki danych → `console.error('[api/profile] …', error)` bez
  `userId` i bez ciała żądania (dane objęte guardrailem prywatności) → 500 `{ error: 'internal' }`.
- Zero `prepare(`, zero `getWorkerEnv()` w pliku.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npx tsc --noEmit`, `npx expo lint`, `npm test` czyste
- `npx wrangler d1 migrations apply mealplan --local` stosuje `0002`; `migrations list --local`
  bez zaległych
- `npx expo export -p web` i `npx wrangler deploy --dry-run --outdir .wrangler-dry` bez modułów
  z `node_modules`; `profile+api.ts` jest w wyeksportowanych trasach
- Na `wrangler dev`: `GET /api/profile` i `PUT /api/profile` bez nagłówka `Authorization` → 401
- Na `wrangler dev`: `GET /api/profile` z tokenem konta A bez profilu → 200 `{"profile":null,"target":null}`
- Na `wrangler dev`: `PUT` z ciałem `{ age: 17 }` → 400 `invalid` z `fields.age`; z ciałem
  niebędącym JSON-em → 400 `invalid_json`
- Na `wrangler dev`: `PUT` konta A z poprawnym profilem (80 kg, 180 cm, 30 lat, `male`, poziom 3,
  bez nadpisania) → 200 z `target.computedKcal` 2759 i `effectiveKcal` 2759; kolejny `GET` oddaje
  to samo; `wrangler d1 execute --local` pokazuje jeden wiersz `user_profile`
- Na `wrangler dev`: `PUT` konta A z `targetKcalOverride: 2200` → `effectiveKcal` 2200,
  `computedKcal` nadal 2759; `PUT` z `targetKcalOverride: null` wraca do 2759
- Na `wrangler dev`: `GET` z tokenem konta B → `profile: null`, a wiersz konta A nietknięty;
  `PUT` konta B tworzy drugi wiersz i nie zmienia pierwszego
- `GET /api/health` nadal `{"ok":true,"d1":true}`; `GET /api/account` bez zmian
- `npx wrangler d1 migrations list mealplan --remote` bez zaległych **przed** commitem fazy

#### Ręczna weryfikacja:

- `grep -rn "prepare(\|getWorkerEnv" src/app/api/` pokazuje wyłącznie `health+api.ts`
- Tokeny kont A i B pochodzą z działającej aplikacji (`getToken()`), nie z ręcznej generacji
- W `wrangler tail` / logu `wrangler dev` przy wymuszonym błędzie D1 (np. tabela usunięta lokalnie
  plikiem `down`) widać `[api/profile]` bez `userId` i bez treści ciała, a klient dostaje 500
  `internal`

**Uwaga implementacyjna**: zatrzymaj się na potwierdzenie przed fazą 3; migracja `--remote` musi
być zastosowana zanim commit tej fazy trafi na `main`.

---

## Phase 3: Ekran profilu i karta celu

### Przegląd

Użytkownik dostaje zakładkę Profil z formularzem, podglądem wyliczenia na żywo i nadpisaniem,
a Home — kartę obowiązującego celu. Starter przestaje udawać produkt.

### Wymagane zmiany:

#### 1. Prymityw wyboru

**Plik**: `src/components/ui/choice-field.tsx`

**Cel**: kontrolka dla płci i poziomu aktywności — kilka przycisków w rzędzie, jeden wybrany.
Powstaje jako prymityw, bo pojawia się dwa razy w tej zmianie, a S-03 (liczba posiłków) użyje
go trzeci raz.

**Umowa**: `ChoiceField<T extends string | number>({ label, value, options: { value: T; label:
string; hint?: string }[], onChange: (value: T) => void, error?: string | null })`. Etykieta nad
polem i błąd pod polem jak w `TextField`. Opcja to `Pressable` + `ThemedView` typu
`backgroundSelected` (wybrana) / `backgroundElement`, `accessibilityRole="radio"`,
`accessibilityState={{ checked }}`; `flexWrap: 'wrap'`, żeby pięć poziomów zmieściło się na
telefonie. Kolory z motywu, odstępy ze `Spacing`.

#### 2. Ekran profilu

**Plik**: `src/app/(app)/profile.tsx`

**Cel**: podać i edytować profil, zobaczyć skąd bierze się liczba, nadpisać cel i do niego wrócić.

**Umowa**:
- Trasa `/profile` w grupie `(app)` (za bramką sesji). `ScrollView` z `paddingBottom:
  BottomTabInset + Spacing.three` (reguła dla przewijalnych ekranów) i `maxWidth: MaxContentWidth`.
- Stan ładowania: jedno `GET /api/profile` przy wejściu (wzorzec `useRef` z `index.tsx`);
  `OfflineError` → komunikat „Brak połączenia — profil nie został pobrany, odśwież ekran, gdy sieć
  wróci” **bez** wylogowania; `NotSignedInError` → „Sesja wygasła” (bramka odsyła sama).
- Pola: wiek (`number-pad` / `inputMode="numeric"`), waga w kg (`decimal-pad` / `"decimal"`,
  przecinek dozwolony), wzrost w cm, `ChoiceField` „Płeć (do wyliczenia)” z opcjami kobieta /
  mężczyzna, `ChoiceField` „Poziom aktywności” 1–5 z `ActivityLabel` jako `hint`. Wartości
  liczbowe trzymane jako **tekst** do momentu walidacji — inaczej nie da się wpisać „70,”.
- Podgląd na żywo: przy każdej zmianie ekran buduje kandydata — pola tekstowe przez
  `parseNumberInput` (pusty / nieliczbowy → `null`), puste „Własny cel” → `null` — i woła
  `validateProfile` na tym obiekcie, nigdy na surowych stringach; `ok: true` →
  `computeCalorieTarget` i trzy wiersze: „Podstawowa przemiana materii: {bmrKcal} kcal
  (Mifflin-St Jeor)”, „× {multiplier} za aktywność {ActivityLabel} (poziom {n})”,
  „= {computedKcal} kcal dziennie”, plus zdanie: „Tyle utrzymuje obecną wagę. Jeśli chcesz inny
  cel, wpisz go poniżej.” `ok: false` → „Uzupełnij pola, żeby policzyć zapotrzebowanie”, a błędy
  pod polami pokazują się dopiero **po próbie zapisu** albo po opuszczeniu pola (nie w trakcie
  pisania pierwszej cyfry).
- Nadpisanie: `TextField` „Własny cel (kcal), opcjonalnie”. Gdy wypełnione i poprawne: wiersz
  „Twój cel: {override} kcal (wyliczone {computedKcal})” i link „Wróć do wyliczenia”, który czyści
  pole. Edycja innych pól **nie** czyści nadpisania.
- Zapis: `ActionButton` „Zapisz” (`busy` → „Zapisuję…”), `PUT /api/profile` z `Content-Type:
  application/json`. 200 → stan z odpowiedzi (`profile`, `target`) i „Zapisano”. 400 `invalid` →
  `fields` pod pola. `OfflineError` → „Brak połączenia — zmiany nie zostały zapisane”, wartości
  zostają w formularzu. Inne → „Nie udało się zapisać profilu.” Bez `setState` w ciele efektu.
- Liczby w tekście z separatorem tysięcy przez `toLocaleString('pl-PL')`.

#### 3. Zakładki na dwóch platformach

**Plik**: `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx`,
`assets/images/tabIcons/profile.png` + `profile@2x.png` + `profile@3x.png` (nowe — kopie trzech
gęstości `explore*.png`; Metro dobiera gęstość po sufiksie, więc wszystkie trzy są potrzebne)

**Cel**: zakładka „Profil” w miejsce „Explore” — na obu platformach, inaczej trasa istnieje, ale
jest nieosiągalna na jednej z nich.

**Umowa**: natywnie `NativeTabs.Trigger name="profile"` (nazwa **musi** równać się nazwie pliku
trasy) z etykietą „Profil” i ikoną `src={require('@/assets/images/tabIcons/profile.png')}`
`renderingMode="template"` — dokładnie wzorzec zakładki Home; `profile.png` powstaje jako kopia
ikony `explore` (docelowo własna grafika, poza tą zmianą). Bez `sf` / `drawable` — patrz Kluczowe
odkrycia. Trigger `explore` znika. Na webie
`TabTrigger name="profile" href="/profile"` z etykietą „Profil”; trigger `explore` znika. Tekst
marki w `CustomTabList` zmienia się z „Expo Starter” na „MealPlan”, link „Docs” do docs.expo.dev
znika — jeśli po tym `external-link.tsx` nie ma żadnego importera (`grep`), plik usuwamy.
Etykieta „Home” zostaje.

#### 4. Usunięcie ekranów startera

**Plik**: `src/app/(app)/explore.tsx` (usunięty), `src/components/hint-row.tsx` (usunięty)

**Cel**: `/explore` przestaje istnieć; komponenty używane wyłącznie przez starter znikają.

**Umowa**: po usunięciu `npx expo lint` i `tsc` nie zgłaszają nieużywanych importów;
`collapsible.tsx`, `web-badge.tsx`, `animated-icon*` zostają (`animated-icon` jest wzorcem
Reanimated cytowanym w `CLAUDE.md`, `WebBadge` zostaje na Home).

#### 5. Regeneracja typed routes

**Plik**: `.expo/types/router.d.ts` (generowany, w `.gitignore`)

**Cel**: `href="/profile"` ma przejść `tsc`, a `/explore` ma zniknąć z typu.

**Umowa**: po utworzeniu `profile.tsx` i usunięciu `explore.tsx` uruchom raz `npx expo start`
(wystarczy do startu Metro), dopiero potem krok 6 i `npx tsc --noEmit`.

#### 6. Karta celu na Home

**Plik**: `src/app/(app)/index.tsx`

**Cel**: użytkownik widzi obowiązujący cel dnia od razu po wejściu; bez profilu — wie, co zrobić.

**Umowa**: znikają `HintRow`, `getDevMenuHint`, tekst „Welcome to Expo” i „get started”; `AnimatedIcon`
zostaje jako element hero, tytuł „MealPlan”. Wiersz `AccountRow` z `userId` i żądanie
`/api/account` znikają — dowodem granicy danych jest teraz `/api/profile`. Nowy komponent lokalny
`TargetCard` (`ThemedView type="backgroundElement"`) ze stanami: `loading` („Sprawdzam profil…”),
`offline` (komunikat jak dotąd, sesja zachowana), `error`, `missing` („Uzupełnij profil, żeby
policzyć zapotrzebowanie” + `Link href="/profile"` „Przejdź do profilu”), `ready`
(„{effectiveKcal} kcal dziennie”; gdy `overrideKcal` nie jest `null` — dopisek „cel nadpisany,
wyliczone {computedKcal}”; `Link` „Zmień profil”). Pobranie przy każdym wejściu w zakładkę przez
`useIsFocused()` z `expo-router` + `useEffect` z refem `fetchedForFocus` (zerowany, gdy fokus znika;
uzbrajany przy pierwszym renderze w fokusie) i flagą `cancelled` w cleanupie — bez `useCallback`
i bez `useFocusEffect` (patrz „Krytyczne szczegóły”).
Przycisk „Wyloguj się” i `WebBadge` zostają.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npx tsc --noEmit` czyste po regeneracji typed routes (`/profile` w typie, `/explore` poza nim)
- `npx expo lint` czyste, bez `react-hooks/set-state-in-effect`
- `npm test` nadal przechodzi
- `npx expo export -p web` i `wrangler deploy --dry-run` bez modułów z `node_modules`
- Na `wrangler dev`: `GET /profile` zwraca HTML 200 (prerender bez sesji, stan neutralny);
  `GET /explore` zwraca 404
- `grep -rn "hint-row\|explore" src/` nie zwraca nic

#### Ręczna weryfikacja:

- W przeglądarce (`wrangler dev`): Profil bez danych → „Uzupełnij pola…”; po wpisaniu
  80 / 180 / 30 / mężczyzna / poziom 3 podgląd pokazuje 1 780 → × 1.55 → 2 759 **przed** zapisem
- Zapis → „Zapisano”; przejście na Home → karta „2 759 kcal dziennie”
- Wpisanie „70,5” w wagę jest przyjęte; wiek 17 i waga 7 dają błędy pod polami po „Zapisz”,
  a zapis nie wychodzi
- Własny cel 2 200 → wiersz „Twój cel: 2 200 (wyliczone 2 759)”, po zapisie Home pokazuje 2 200
  z dopiskiem o nadpisaniu; zmiana wagi na 82 i zapis **nie** kasuje 2 200; „Wróć do wyliczenia”
  + zapis → Home pokazuje nowe wyliczenie
- Sieć wyłączona: wejście na Profil → komunikat offline, użytkownik nadal zalogowany; zapis
  offline → „zmiany nie zostały zapisane”, wartości w polach zostają
- W Expo Go (przeciw `wrangler dev --ip 0.0.0.0` przez `EXPO_PUBLIC_API_URL`): zakładka Profil
  widoczna z ikoną, ten sam przebieg; klawiatura liczbowa dla pól liczbowych; ostatni element
  formularza nie chowa się pod zakładkami
- Zakładki na webie pokazują „MealPlan”, „Home”, „Profil”, bez „Docs”

**Uwaga implementacyjna**: zatrzymaj się na potwierdzenie ręczne na obu platformach przed fazą 4.

---

## Phase 4: Produkcja i reguły

### Przegląd

Fazy 2 i 3 są już na produkcji przez auto-deploy. Ta faza to sprawdza, przechodzi przepływ na
wdrożonym Workerze i zapisuje stan po zmianie w regułach projektu.

### Wymagane zmiany:

#### 1. Smoke na produkcji

**Plik**: brak (komendy)

**Cel**: potwierdzić, że warunki produkcyjne z fazy 2 faktycznie weszły.

**Umowa**: `npx wrangler d1 migrations list mealplan --remote` bez zaległych; na adresie
`ProductionOrigin`: `/` HTML, `/profile` HTML 200, `/explore` 404, `/api/health` `d1:true`,
`/api/profile` bez tokenu 401. Nazwę bundla do sprawdzenia bierz z wdrożonego HTML-a, nie
z lokalnego `dist/` (pułapka z `CLAUDE.md`).

#### 2. Reguły projektu

**Plik**: `CLAUDE.md`

**Cel**: reguły mają opisywać stan po zmianie, nie przed.

**Umowa** — edycje punktowe, bez przepisywania sekcji:
- „Komendy i weryfikacja”: zdanie „Nie ma runnera testów” → `npm test` uruchamia `node --test`
  wyłącznie dla czystych modułów w `src/lib/*.test.ts`; „przetestowane” nadal znaczy `tsc` +
  ekran otwarty, a dla `src/lib/` dodatkowo zielony `npm test`. Bez Vitest/Jest — świadomie.
- „Struktura i konwencje”: wyjątek od reguły importów — `src/lib/*.test.ts` importuje sąsiada
  z jawnym `.ts`, bo wymaga tego Node; `allowImportingTsExtensions` w `tsconfig.json` istnieje
  tylko po to. Zakaz `"type": "module"` w `package.json` z powodem.
- „Architektura › Backend”: trasy API to teraz trzy — `health`, `account` (odniesienie),
  `profile` (`GET`/`PUT`, kontrakt `ProfileResponse` z `src/lib/calorie-target.ts`); wzór
  i walidacja żyją w jednym module współdzielonym przez klienta i serwer; cel **nie** jest
  utrwalany, S-04 liczy go tym samym modułem; klucz obcy `user_profile → app_user` wymaga
  `touchAppUser` przed zapisem. Zdanie „Wiersz powstaje leniwie przy pierwszym uwierzytelnionym
  żądaniu” przeredagować: wiersz `app_user` powstaje przy pierwszym **zapisie** (`PUT /api/profile`,
  przez `touchAppUser`) albo przy wejściu na trasę odniesienia `/api/account`; `GET /api/profile`
  nie pisze, więc `last_seen_at` nie jest wskaźnikiem aktywności — Home po tej zmianie nie woła
  już `/api/account` (przegląd planu, F5).
- „Twarde reguły › zakładki”: przykład zakładek to teraz `index` / `profile`; ikony zakładek
  to PNG z `assets/images/tabIcons/` w `renderingMode="template"` — nie `drawable` (Expo Go nie
  ma natywnych zasobów projektu).
- „Produkt”: granice profilu (18–100 lat, 30–300 kg, 100–250 cm, cel 1000–6000 kcal) i płeć
  dwuwartościowa jako decyzje S-02, z odnośnikiem do `plan-brief.md`.
- „Pułapki”: typed routes po dodaniu/usunięciu trasy regenerują się dopiero po `expo start`.

#### 3. Mapa drogowa

**Plik**: `context/foundation/roadmap.md`

**Cel**: brak działań w tej fazie — `/10x-implement` ustawia `in-progress` przy fazie 1,
`/10x-archive` zamyka do `done`. Wpisane, żeby nikt nie edytował ręcznie.

### Kryteria sukcesu:

#### Automatyczna weryfikacja:

- `npx tsc --noEmit`, `npx expo lint`, `npm test`, `npm run check-lock` czyste
- `migrations list --remote` bez zaległych
- Smoke na produkcji: `/` HTML, `/profile` 200, `/explore` 404, `/api/health` `d1:true`,
  `/api/profile` bez tokenu 401

#### Ręczna weryfikacja:

- Pełny przebieg na produkcji w przeglądarce: logowanie → Home z wezwaniem → Profil → podgląd →
  zapis → Home z celem → nadpisanie → powrót do wyliczenia
- Ten sam profil widoczny w Expo Go przeciw produkcji (`EXPO_PUBLIC_API_URL=ProductionOrigin`
  świadomie) — ten sam stan na telefonie i w przeglądarce
- `CLAUDE.md` przeczytany po edycji: żadne zdanie nie opisuje stanu sprzed zmiany (grep po
  „Nie ma runnera”, „explore”, „Explore”, „pierwszym uwierzytelnionym żądaniu”)

---

## Strategia testowania

### Testy jednostkowe (`npm test`):

- Wyłącznie `src/lib/calorie-target.ts` — tabela przypadków z fazy 1. To jedyna logika w zmianie,
  której błąd byłby niewidoczny bez ręcznego liczenia.

### Sprawdzenia po HTTP (na `wrangler dev`, potem produkcja):

- 401 bez tokenu na obu metodach; 400 `invalid` z `fields`; 400 `invalid_json`; 200 z `target`
  zgodnym z tabelą testów; izolacja kont A/B w obu kierunkach; `health` i `account` bez regresji.

### Kroki testowania ręcznego:

1. Web: pusty profil → podgląd po wypełnieniu → zapis → Home → nadpisanie → edycja nie kasuje →
   powrót do wyliczenia.
2. Walidacja: wiek 17, waga 7, wzrost 17, cel 900 — błędy pod polami, brak żądania.
3. Offline: odczyt i zapis bez sieci, sesja zachowana, wartości zachowane.
4. Expo Go: zakładka, klawiatury, wcięcie pod zakładkami, ten sam przebieg.
5. Produkcja: przebieg z fazy 4 na obu platformach.

## Uwagi dotyczące wydajności

- Odczyt: jedno zapytanie D1; wyliczenie w Workerze to kilka mnożeń. Zapis: `touchAppUser`
  (zapis co najwyżej raz na godzinę) + jeden upsert. Zapisy są jawnymi akcjami użytkownika, więc
  limit 100 tys. zapisów/dobę planu darmowego nie jest tematem.
- Home woła `/api/profile` przy każdym wejściu w zakładkę — odczyt, nie zapis; przy małej skali
  PRD to nie jest koszt. Gdyby był, efekt na `useIsFocused` zamienia się na odświeżanie po powrocie
  z Profilu, nie na cache.
- Moduł wzoru wchodzi do bundla klienta i do `dist/server`; jest rzędu kilkuset linii bez
  zależności — bez wpływu na limit rozmiaru skryptu.

## Uwagi dotyczące migracji

- `0002` jest addytywna; nie zmienia `app_user`. Kolejność: `--local` w trakcie fazy 2,
  `--remote` przed commitem fazy 2 (auto-deploy wystawia trasę natychmiast).
- Migracja wstecz w `down/`: eksport bazy (`wrangler d1 export … --remote`) → `execute --file`;
  usuwa też wpis z `d1_migrations`. `wrangler rollback` cofa kod, nie schemat.
- Klucz obcy: cofnięcie `0001` przed `0002` jest niemożliwe (D1 odrzuci `DROP TABLE app_user`
  przy istniejących wierszach `user_profile`) — kolejność cofania to `0002`, potem `0001`.

## Otwarte ryzyka i założenia

- **Dokładność wzoru dla skrajnych profili.** Mifflin-St Jeor jest zwalidowany dla dorosłych
  o typowym składzie ciała; dla osób bardzo umięśnionych zaniża, dla otyłych zawyża. Produkt tego
  nie koryguje (Non-Goals) — nadpisanie celu jest zaworem bezpieczeństwa.
- **`allowImportingTsExtensions` a lint.** Jeśli preset `eslint-config-expo` zgłosi `.ts`
  w specyfikatorze importu, wyciszenie punktowe w pliku testu z uzasadnieniem — nie globalne.
- **`useIsFocused` na webie z `expo-router/ui`.** Headless `Tabs` powinny emitować fokus tak
  samo jak natywne; jeśli nie, karta na Home odświeża się przez `useEffect` przy montowaniu,
  a użytkownik po zapisie w Profilu widzi stary cel do odświeżenia strony — ryzyko sprowadza się
  do jednego dodatkowego odświeżenia i musi być wtedy nazwane w komunikacie „Zapisano”.
- **Podgląd na żywo a wydajność klawiatury.** `validateProfile` + `computeCalorieTarget` przy
  każdym znaku to kilkadziesiąt operacji; bez ryzyka. Gdyby ekran się dławił, wina jest gdzie
  indziej.

## Referencje

- Mapa drogowa: `context/foundation/roadmap.md` → S-02
- PRD: `context/foundation/prd.md` → FR-002, FR-003, Guardrails (prywatność profilu), Open Question 5
- Wzorzec trasy: `src/app/api/account+api.ts`; wzorzec repozytorium:
  `src/server/repository/app-users.ts`; wzorzec ekranu z granicą danych: `src/app/(app)/index.tsx`
- Archiwum S-01 z konwencją migracji i przeglądem fazy 3 (F4 `d1_migrations`, F6 `try/catch`,
  F7 zapisy w `GET`): `context/archive/2026-08-31-account-and-login/`
- Wzór: Mifflin MD, St Jeor ST et al., *Am J Clin Nutr* 1990; mnożniki aktywności 1.2–1.9 —
  konwencja kalkulatorów TDEE (współczynniki aktywności Harris-Benedict)

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw kroków. Zobacz
> [`.claude/skills/10x-plan/references/progress-format.md`](../../../.claude/skills/10x-plan/references/progress-format.md).

### Phase 1: Wzór i walidacja jako czysty moduł z testem

#### Automated

- [x] 1.1 `npm test` przechodzi ze wszystkimi przypadkami z tabeli — 8da373c
- [x] 1.2 `npx tsc --noEmit` czyste z plikiem testu — 8da373c
- [x] 1.3 `npx expo lint` czyste — 8da373c
- [x] 1.4 `npm run check-lock` przechodzi, lockfile nietknięty — 8da373c

#### Manual

- [x] 1.5 Moduł `calorie-target.ts` bez importów z React, React Native, Clerka i `@/server` — 8da373c

### Phase 2: Granica danych profilu na serwerze

#### Automated

- [ ] 2.1 `npx tsc --noEmit`, `npx expo lint`, `npm test` czyste
- [ ] 2.2 Migracja `0002` stosuje się lokalnie, `migrations list --local` bez zaległych
- [ ] 2.3 `expo export` i `wrangler deploy --dry-run` bez modułów z `node_modules`, `profile+api.ts` w trasach
- [ ] 2.4 `GET` i `PUT /api/profile` bez nagłówka `Authorization` → 401
- [ ] 2.5 `GET` konta A bez profilu → 200 `{"profile":null,"target":null}`
- [ ] 2.6 `PUT` z `age: 17` → 400 `invalid` z `fields.age`; nie-JSON → 400 `invalid_json`
- [ ] 2.7 `PUT` konta A z profilem 80/180/30/male/3 → `computedKcal` 2759; `GET` to samo; jeden wiersz w D1
- [ ] 2.8 `PUT` z `targetKcalOverride` 2200 → `effectiveKcal` 2200, `computedKcal` 2759; `null` wraca do 2759
- [ ] 2.9 Konto B: `GET` → `profile: null`, `PUT` tworzy drugi wiersz, wiersz A nietknięty
- [ ] 2.10 `GET /api/health` `d1:true` i `GET /api/account` bez regresji
- [ ] 2.11 `migrations list --remote` bez zaległych przed commitem fazy

#### Manual

- [ ] 2.12 Żadna trasa poza `health+api.ts` nie woła `prepare(` ani `getWorkerEnv()`
- [ ] 2.13 Tokeny kont A i B pochodzą z działającej aplikacji
- [ ] 2.14 Wymuszony błąd D1 loguje `[api/profile]` bez `userId` i ciała, klient dostaje 500 `internal`

### Phase 3: Ekran profilu i karta celu

#### Automated

- [ ] 3.1 `npx tsc --noEmit` czyste po regeneracji typed routes (`/profile` w typie, `/explore` poza nim)
- [ ] 3.2 `npx expo lint` czyste, bez `react-hooks/set-state-in-effect`
- [ ] 3.3 `npm test` nadal przechodzi
- [ ] 3.4 `expo export` i `wrangler deploy --dry-run` bez modułów z `node_modules`
- [ ] 3.5 Na `wrangler dev`: `GET /profile` HTML 200, `GET /explore` 404
- [ ] 3.6 `grep -rn "hint-row\|explore" src/` bez trafień

#### Manual

- [ ] 3.7 Web: podgląd 1 780 → × 1.55 → 2 759 przed zapisem dla 80/180/30/mężczyzna/3
- [ ] 3.8 Web: zapis → „Zapisano”, Home pokazuje „2 759 kcal dziennie”
- [ ] 3.9 Web: „70,5” przyjęte; wiek 17 i waga 7 dają błędy pod polami po „Zapisz”, bez żądania
- [ ] 3.10 Web: nadpisanie 2 200 widoczne na Profilu i Home; edycja wagi nie kasuje; „Wróć do wyliczenia” działa
- [ ] 3.11 Web offline: odczyt i zapis komunikują brak sieci bez wylogowania, wartości zostają
- [ ] 3.12 Expo Go: zakładka Profil z ikoną, ten sam przebieg, klawiatury liczbowe, formularz nie chowa się pod zakładkami
- [ ] 3.13 Web: zakładki „MealPlan” / „Home” / „Profil”, bez „Docs”

### Phase 4: Produkcja i reguły

#### Automated

- [ ] 4.1 `npx tsc --noEmit`, `npx expo lint`, `npm test`, `npm run check-lock` czyste
- [ ] 4.2 `migrations list --remote` bez zaległych
- [ ] 4.3 Smoke na produkcji: `/` HTML, `/profile` 200, `/explore` 404, `/api/health` `d1:true`, `/api/profile` 401 bez tokenu

#### Manual

- [ ] 4.4 Pełny przebieg na produkcji w przeglądarce
- [ ] 4.5 Ten sam profil widoczny w Expo Go przeciw produkcji
- [ ] 4.6 `CLAUDE.md` bez zdań opisujących stan sprzed zmiany
