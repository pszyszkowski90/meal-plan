<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Konto e-mail + hasło i granica danych użytkownika

- **Plan**: `context/changes/account-and-login/plan.md`
- **Zakres**: Faza 4 z 4 („Wdrożenie i przebieg na dwóch platformach")
- **Data**: 2026-09-11
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 4 ostrzeżenia, 3 obserwacje

## Ten przegląd zastępuje wcześniejszy z tego samego dnia

Poprzedni raport (ten sam plik, wcześniejsza godzina) kończył się werdyktem ODRZUCONY, bo faza nie
była rozpoczęta: `origin/main` stał na `44dce3d`, a produkcja nie miała kodu zmiany. Od tamtej pory:

| Poprzednie ustalenie | Stan dziś |
|---|---|
| F1 — 7 commitów nigdy nie trafiło na `origin/main` | **Rozwiązane.** `main` == `origin/main` == `c41166b`, produkcja serwuje kod zmiany |
| F2 — `CLAUDE.md` opisuje stan przed zmianą | **Rozwiązane w drzewie roboczym** (niezacommitowane) — patrz F1 niżej oraz F2–F7 o jakości tego zapisu |
| F3 — kryterium 4.7 zderzy się z wymogiem `EXPO_PUBLIC_API_URL` | **Rozwiązane.** `.env.local` ma `EXPO_PUBLIC_API_URL` wskazujący produkcję, z komentarzem odsyłającym do kryterium 4.7 |
| F4 — produkcja na instancji Development Clerka nieudokumentowana | **Rozwiązane.** `CLAUDE.md:148-150` zapisuje decyzję |

## Stan wyjściowy

- Faza 4 **nie ma commitu**. HEAD to `c41166b` (poprawki z przeglądu fazy 3); praca fazy 4 leży
  w drzewie roboczym: `M CLAUDE.md`, `M plan.md` (ticks 4.1/4.2/4.3/4.5), `M change.md`,
  `?? reviews/impl-review-phase-4.md`.
- **Wdrożenie zadziałało przez CI, nie z lokalnej maszyny.** Wdrożona wersja `d266ab42`
  (2026-09-11 06:31 UTC) serwuje `entry-64b3005e…`, a lokalne `dist/client` i cały prerender
  w `dist/server` wskazują `entry-1c4d9d52…`, zapisane **przed** wdrożeniem (08:28 CEST vs
  08:31 CEST). `wrangler deploy` wysyła `dist/client` bez przebudowy, więc wdrożony bundel nie może
  pochodzić z tego drzewa — zbudował go Workers Builds. To zamyka martwy punkt poprzedniego
  przeglądu („czy CI w ogóle działa dla tego projektu").
- Podagent od bezpieczeństwa i wzorców został skierowany na **zgodność nowego `CLAUDE.md` z kodem**,
  bo faza nie wprowadza kodu, a nieprawdziwa reguła w pliku reguł jest tu jedynym realnym ryzykiem —
  dziedziczy ją każdy kolejny fragment (S-02, S-03).

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | WARNING |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | PASS |
| Architektura | PASS |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | WARNING |

## Zgodność z planem — kroki fazy 4

| Krok | Plan | Rzeczywistość | Werdykt |
|---|---|---|---|
| 1. Potwierdzenie stanu produkcji | trzy sprawdzenia: klucz w zmiennych buildu, `secret list`, `migrations list --remote` | wszystkie trzy PASS (klucz potwierdzony pośrednio: `pk_test_` w bundlu zbudowanym zdalnie) | MATCH |
| 2. Wdrożenie | push na `main` → Workers Builds | push wykonany, CI zbudowało i wdrożyło `d266ab42` | MATCH |
| 3. Aktualizacja `CLAUDE.md` | 12 klauzul kontraktu w trzech sekcjach | **12/12 MATCH**; ale 6 nieścisłości faktograficznych i brak commitu | DRIFT |

Kontrakt kroku 3, klauzula po klauzuli — wszystkie spełnione: Clerk jako dostawca tożsamości
(`CLAUDE.md:138`), `userId` z tokenu weryfikowanego PEM (`:141-142`), D1 bez danych tożsamościowych
(`:152-154`), dostęp przez `src/server/repository/` z `userId` pierwszym argumentem (`:155-157`),
trasy produktowe w `(app)` za bramką (`:128-131`), `src/server/repository/` w Strukturze (`:73-75`),
`src/lib/api.ts` (`:75-77`), `migrations/` (`:78`), kolejność migracji (`:181-188`), `migrations/down/`
tylko ręcznie (`:193-195`), warunek produkcyjny przed commitem fazy (`:190-192`), usunięte zdanie
o nierozstrzygniętym auth (zero trafień w `grep`).

**Dyscyplina zakresu: PASS.** Zmiana dotyka dokładnie jednego pliku, który kontrakt nazywa. Poza
dwunastoma klauzulami poprawia dziewięć innych zdezaktualizowanych zdań (m.in. `web.output: "static"`
→ `"server"`, akapit o pustym backendzie, smoke test z `/api/account`). To mieści się w celu kroku 3
(„reguły opisują stan po tej zmianie, a nie przed nią"), a dwie pozycje — wymóg `EXPO_PUBLIC_API_URL`
i zdanie o instancji Development — są wprost zlecone przez poprawki F2 i F4 poprzedniego przeglądu.
Nic z zakresu produktowego nie wjechało.

## Kryteria sukcesu — wynik weryfikacji (2026-09-11)

| Wiersz | Sprawdzenie | Wynik |
|---|---|---|
| 4.1 | `npx tsc --noEmit` | PASS (exit 0) |
| 4.1 | `npx expo lint` | PASS (exit 0) |
| 4.1 | `npm run check-lock` | PASS — 1127 pakietów, 0 bez sumy kontrolnej |
| 4.2 | `migrations list mealplan --remote` | PASS — „No migrations to apply!" |
| 4.3 | `GET /` → HTML | PASS (200, `text/html`) |
| 4.3 | `GET /does-not-exist-xyz` → 404 | PASS |
| 4.3 | `GET /api/health` | PASS — `{"ok":true,"d1":true,"at":"2026-09-11T06:52:32.305Z"}` |
| 4.4 | `GET /api/account` bez tokenu → 401 | **PASS** — `{"error":"unauthorized"}`, 401 |
| 4.4 | `GET /api/account` z ważnym tokenem → `userId` | OCZEKUJE — wymaga tokenu z działającej aplikacji, nie do zrobienia z CLI |
| 4.5 | `wrangler secret list` pokazuje `CLERK_JWT_KEY` | PASS |
| 4.5 | klucz publikowalny w zmiennych buildu | PASS — `pk_test_` obecny w `entry-64b3005e…`, czyli w bundlu zbudowanym przez Workers Builds, gdzie `.env.local` nie istnieje |
| 4.6–4.9 | przebiegi ręczne na produkcji i w Expo Go | OCZEKUJĄ — `/sign-in` na produkcji zwraca 200, `AUTHORIZED_PARTIES` zawiera `ProductionOrigin` (`src/server/auth.ts:21`), więc nic nie blokuje wykonania |
| 4.10 | `CLAUDE.md` opisuje stan po zmianie | **PASS po sortowaniu** — w chwili przeglądu treść była na miejscu z sześcioma nieścisłościami (F2–F7); po ich naprawie wiersz odhaczony |

Ticks 4.1/4.2/4.3/4.5/4.10 są `[x]` **bez SHA**, wbrew konwencji z nagłówka `## Progress`
(„Dodaj ` — <commit sha>` po zakończeniu kroku"). Tak samo zachowały się fazy 1–3: w commicie fazy
wiersze były bez SHA, a SHA dopisano commitem późniejszym. Dla fazy 4 SHA wejdą z commitem
domykającym, po przebiegach ręcznych 4.4 (połowa z tokenem) i 4.6–4.9.

## Ustalenia

### F1 — Faza 4 nie ma commitu: praca i odhaczenia leżą w drzewie roboczym, a produkcja już działa

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: N/A (stan repozytorium)
- **Szczegóły**: Krok 3 jest wykonany, ale `CLAUDE.md` (111 zmienionych wierszy), ticks Progress
  i `change.md` są niezacommitowane, a raport przeglądu jest nietrackowany — podczas gdy przeglądy
  faz 1–3 weszły do repo razem z commitami poprawek (`c41166b`). Efekt: produkcja serwuje kod
  zmiany, ale plik reguł opisujący ten kod istnieje tylko na jednej maszynie. Każdy inny klon repo
  (i każda sesja agenta w nim) dostaje `CLAUDE.md` mówiący „Backend stoi, ale jest pusty" i „D1 nie
  ma schematu" — dokładnie ten fałszywy obraz, który krok 3 miał usunąć. Dodatkowo commit fazy jest
  jedynym źródłem SHA dla wierszy Progress.
- **Poprawka**: zacommitować fazę 4 razem z raportem przeglądu i dopisać SHA do wierszy 4.1/4.2/4.3/
  4.5 oraz 4.10 — po poprawkach z tego przeglądu, żeby nie commitować nieścisłości F2–F7.
- **Decyzja**: FIXED

### F2 — `CLAUDE.md` nazywa `setActive`, czyli API, którego w tym repo nie ma

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: `CLAUDE.md:132`
- **Szczegóły**: Zdanie „**Nawigacja po zmianie sesji ma jednego właściciela — te dwie bramki**;
  ekrany po `setActive` nie nawigują same" trafia w sedno, ale pod nieistniejącą nazwą: `grep -rn
  "setActive" src/` daje **zero** trafień. Ekrany domykają sesję nowszym API Clerka — `finalize()`:
  `src/app/(auth)/sign-in.tsx:68` i `:84`, `sign-up.tsx:66`, `forgot-password.tsx:110`. Sama reguła
  jest prawdziwa i zweryfikowana: w `src/app/(auth)/` nie ma ani jednego `router.replace`, a każde
  `router.*` jest przejściem bocznym albo powrotem. Ryzyko jest konkretne: agent w S-02 szukający
  `setActive`, żeby zrozumieć kontrakt, nie znajdzie go i może uznać regułę za martwą.
- **Poprawka**: w `CLAUDE.md:132` zamienić `setActive` na `finalize()`.
- **Decyzja**: FIXED

### F3 — `CLAUDE.md` twierdzi teraz dwie sprzeczne rzeczy o tym, kto montuje `AppTabs`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: `CLAUDE.md:105` kontra `CLAUDE.md:128`
- **Szczegóły**: Nietknięty akapit „Warstwa nawigacji jest rozdwojona" wciąż otwiera się zdaniem
  „[_layout.tsx](src/app/_layout.tsx) montuje jeden komponent `AppTabs`". To już nieprawda:
  `src/app/_layout.tsx` montuje `ClerkProvider` → `ThemeProvider` → `AnimatedSplashOverlay` →
  `Stack` i nie importuje `AppTabs` wcale; robi to `src/app/(app)/_layout.tsx:5,26`. Nowy akapit
  o bramce (`:128`) mówi to poprawnie, więc plik zawiera obie wersje jednocześnie. Reszta akapitu
  (rozdwojenie `NativeTabs` / `expo-router/ui`, `name` = nazwa pliku natywnie) jest nadal aktualna —
  psuje się tylko pierwsze zdanie.
- **Poprawka**: w `CLAUDE.md:105` przekierować zdanie na `src/app/(app)/_layout.tsx` jako miejsce
  montujące `AppTabs`.
- **Decyzja**: FIXED

### F4 — `sso-callback` leży poza obiema bramkami i `CLAUDE.md` o tym nie mówi

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: `CLAUDE.md:71-72`, `src/app/sso-callback.tsx`
- **Szczegóły**: Nowy wiersz Struktury dzieli trasy na „produktowe w `(app)`, logowanie w `(auth)`,
  trasy API w `api/`", a akapit o bramce wylicza grupę `(auth)` jako `sign-in`, `sign-up`,
  `forgot-password`. Tymczasem `sso-callback.tsx` leży **na najwyższym poziomie** `src/app/`, czyli
  w żadnej z dwóch grup i za żadną z dwóch bramek. Jest to celowe — plik woła
  `WebBrowser.maybeCompleteAuthSession()` w zakresie modułu, żeby przeżyć prerender, a kryterium 1.12
  fazy 1 wprost wymaga, by `/sso-callback` było w wyeksportowanych trasach i zwracało 200. Ale nigdzie
  tego nie zapisano: agent porządkujący strukturę pod hasłem „logowanie mieszka w `(auth)`"
  przeniesie plik i zabije Google SSO, a `tsc` tego nie złapie.
- **Poprawka**: dopisać do wiersza Struktury (albo do akapitu o bramkach), że
  `src/app/sso-callback.tsx` zostaje na najwyższym poziomie, poza obiema bramkami, bo musi przeżyć
  prerender i domknąć sesję przeglądarki — nie przenosić go do `(auth)`.
- **Decyzja**: FIXED

### F5 — `CLAUDE.md` nazywa typy błędów Clerka, a nie te, które kod naprawdę rzuca

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: `CLAUDE.md:145-146`, `CLAUDE.md:177`
- **Szczegóły**: Dwa nazwane symbole nie są tymi, z którymi zetknie się kod produktowy.
  (1) „`getToken()` przy braku sieci rzuca `ClerkOfflineError`" — prawda o Clerku, ale
  `src/hooks/use-authed-fetch.ts:27-29` mapuje go na repo-lokalny `OfflineError`
  (`src/lib/api.ts:29`), i to on dochodzi do ekranu; `NotSignedInError` (`src/lib/api.ts:17`) nie jest
  w `CLAUDE.md` wspomniany wcale. (2) „bez niego `resolveUrl` rzuca czytelny błąd" — rzuca wewnętrzny
  `resolveNativeOrigin()` (`src/lib/api.ts:61`); `resolveUrl` (`:68`) tylko go woła i propaguje.
  Sama zasada „offline to nie wylogowany" jest prawdziwa i zaimplementowana.
- **Poprawka**: wymienić w `CLAUDE.md` repo-lokalne `OfflineError` i `NotSignedInError` jako to, co
  łapie kod, zachowując `ClerkOfflineError` jako źródło; przy `EXPO_PUBLIC_API_URL` napisać
  „`src/lib/api.ts` rzuca" zamiast nazywać funkcję.
- **Decyzja**: FIXED

### F6 — Nietknięty wiersz o bezpośrednich importach `useColorScheme` jest już nieprawdziwy

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: `CLAUDE.md:94`
- **Szczegóły**: „Starter (`_layout.tsx`, `app-tabs.tsx`) importuje jeszcze wprost — nie powielaj
  tego". `src/app/_layout.tsx:7` importuje już z `@/hooks/use-color-scheme`, czyli poprawnie —
  wiersz wskazuje plik, który reguły przestrzega. Faktyczne odstępstwa to
  `src/components/app-tabs.tsx:2`, `src/components/app-tabs.web.tsx:10` i
  `src/components/web-badge.tsx:3`. Wiersz nie był w kontrakcie kroku 3, ale krok 3 poprawił obok
  niego sąsiednie zdanie o `web.output`, więc zostawienie go jest przeoczeniem, nie decyzją.
- **Poprawka**: poprawić listę na `app-tabs.tsx`, `app-tabs.web.tsx`, `web-badge.tsx`.
- **Decyzja**: FIXED

### F7 — `src/constants/api.ts` — nowy plik tej zmiany — nie istnieje w `CLAUDE.md`

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: `CLAUDE.md:70-72`, `src/constants/api.ts:12`
- **Szczegóły**: Wiersz Struktury wylicza z `src/constants/` tylko `theme.ts`. Tymczasem ta zmiana
  dodała `src/constants/api.ts` z `ProductionOrigin`, czytanym po **obu** stronach granicy:
  `src/lib/api.ts:3` (klient natywny celujący w produkcję) i `src/server/auth.ts:3` (lista
  `AUTHORIZED_PARTIES`). Komentarz w samym pliku nazywa ryzyko rozjazdu: „zmiana nazwy Workera albo
  własna domena — objawiłby się jako 401 bez żadnej wskazówki". Agent zmieniający adres Workera nie
  dowie się z `CLAUDE.md`, że jest jedno miejsce, które trzeba ruszyć.
- **Poprawka**: dopisać `src/constants/api.ts` (`ProductionOrigin` — jedno miejsce na adres Workera,
  czytane przez klienta i przez `AUTHORIZED_PARTIES`) do wiersza Struktury.
- **Decyzja**: FIXED

## Sortowanie — 2026-09-11

Wszystkie siedem ustaleń naprawione w tej samej sesji. Zastosowane edycje w `CLAUDE.md`:

| Ustalenie | Co weszło |
|---|---|
| F2 | `setActive` → `finalize()` w akapicie o właścicielu nawigacji |
| F3 | „Warstwa nawigacji jest rozdwojona" wskazuje teraz `(app)/_layout.tsx`, z dopiskiem, co montuje root `_layout.tsx` |
| F4 | nowy wiersz Struktury: `sso-callback.tsx` zostaje na najwyższym poziomie, poza obiema bramkami, z powodem (prerender + 200 bez sesji) i ostrzeżeniem, że `tsc` przeniesienia nie złapie |
| F5 | nazwane repo-lokalne `OfflineError` i `NotSignedInError` z `src/lib/api.ts`; `resolveUrl` zastąpiony wskazaniem na plik |
| F6 | lista importujących `useColorScheme` wprost poprawiona na `app-tabs.tsx`, `app-tabs.web.tsx`, `web-badge.tsx` |
| F7 | `src/constants/api.ts` (`ProductionOrigin`) dopisany do Struktury z powodem istnienia |
| F1 | commit częściowy fazy 4 (poprawki + raport + tick 4.10); wiersze 4.4 i 4.6–4.9 zostają otwarte |

## Co pozostaje do domknięcia fazy

1. Poprawki F2–F7 w `CLAUDE.md` (wszystkie punktowe, jednowierszowe).
2. Przebiegi ręczne 4.4 (druga połowa), 4.6, 4.7, 4.8, 4.9 — nic ich nie blokuje: `/sign-in` na
   produkcji zwraca 200, `.env.local` ma `EXPO_PUBLIC_API_URL` wskazujący produkcję,
   `AUTHORIZED_PARTIES` zawiera `ProductionOrigin`.
3. Commit fazy 4 z SHA w wierszach Progress (F1) i odhaczenie 4.10.

## Jak wznowić

Sortowanie zakończone 2026-09-11 — wszystkie ustalenia F1–F7 naprawione. Wznowienie nie jest potrzebne:
`/10x-impl-review <ten plik>` pokaże wyłącznie decyzje FIXED.
