<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Konto e-mail + hasło i granica danych użytkownika

- **Plan**: `context/changes/account-and-login/plan.md`
- **Zakres**: Faza 3 z 4 („Granica danych na serwerze", commit `46c9cd1`)
- **Data**: 2026-09-09
- **Werdykt**: WYMAGA UWAGI → wszystkie 10 ustaleń naprawionych 2026-09-10
- **Ustalenia**: 0 krytycznych, 6 ostrzeżeń, 4 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | WARNING |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | PASS |

**Brak ustaleń krytycznych.** Izolacja między kontami jest poprawna: `userId` pochodzi wyłącznie
z roszczenia `sub` zweryfikowanego tokenu — nigdy z query ani z body, więc nie ma IDOR-a. SQL istnieje
tylko w `src/server/repository/`, wartości wchodzą przez `bind(...)`, 401 jest jednolite i nie
różnicuje powodu odrzucenia, a do logów nie trafia token. Sekret nie wyciekł: `.dev.vars` ani żaden
`.pem` nie występują w historii gita.

Kryteria automatyczne przeweryfikowane na zacommitowanym drzewie: `check-lock`, `tsc --noEmit`,
`expo lint` — exit 0; `deploy --dry-run` 11 modułów i zero wystąpień `node_modules`; migracje
`--local` i `--remote` bez zaległych; `/api/account` bez nagłówka i z zepsutym podpisem → 401;
`/api/health` → `{"ok":true,"d1":true}`.

## Ustalenia

### F1 — Prowenancja tokenu nie jest przypięta: brak sprawdzenia `iss`, `azp` doradcze

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `src/server/auth.ts:36-41`, `src/server/auth.ts:69`
- **Szczegóły**: `verifyToken` z samym `jwtKey` sprawdza `sub`, `exp`, `nbf`, `iat`, `typ` i algorytm
  (RS256/384/512 — HS256 nie jest na liście, więc atak przez pomieszanie algorytmów jest wykluczony),
  ale **nie sprawdza `iss` ani `aud`**. Każdy JWT podpisany kluczem tej instancji — w tym token
  z custom JWT template — przejdzie jako sesja. Cross-account ryzyka to nie tworzy (`sub` zostaje
  `sub`), ale pochodzenie tokenu nie jest niczym przypięte. Warstwa `azp` tego nie domyka z dwóch
  powodów: brak `azp` przechodzi bezwarunkowo (świadoma gałąź z planu, bez niej wypada cały ruch
  natywny), a `hasAllowedParty` zwraca `true` również dla roszczenia obecnego, ale nie-stringowego
  (`typeof azp !== 'string'`), choć intencja jest węższa: „brak `azp` = klient natywny".
- **Poprawka A ⭐ Zalecana**: jedna linia `payload.iss === 'https://flying-dove-9587.clerk.accounts.dev'`
  przed zwróceniem `userId`, plus zawężenie `hasAllowedParty` tak, by nie-string traktować jako
  odrzucenie (`azp === undefined || azp === null` → klient natywny).
  - Siła: domyka prowenancję bez rundy sieciowej i bez zmian w dashboardzie; zero kosztu CPU.
  - Kompromis: adres wydawcy to trzecia stała powiązana z instancją w kodzie (obok klucza i listy originów).
  - Pewność: HIGH — brak asercji `iss` potwierdzony w `verifyJwt` (`chunk-QOX5XVDR.mjs:354-400`).
  - Martwy punkt: nie sprawdzono, czy instancja wystawia dziś jakiekolwiek tokeny z custom template.
- **Poprawka B**: skonfigurować `aud` w session tokenie Clerka i przekazać `audience` do `verifyToken`.
  - Siła: `assertAudienceClaim` działa dla OBU klientów, także natywnego, więc zastępuje doradcze `azp`
    roszczeniem, które mają wszyscy — to jedyne rozwiązanie usuwające przyczynę, nie objaw.
  - Kompromis: wymaga kroku człowieka w dashboardzie i wchodzi w konfigurację, którą krok 2 fazy 1
    celowo trzymał minimalną; do tego łamie logowanie do czasu wdrożenia obu stron.
  - Pewność: MED — mechanizm potwierdzony w SDK, ale nie sprawdzono, czy plan Hobby pozwala edytować
    szablon session tokena.
  - Martwy punkt: zachowanie starych, jeszcze ważnych tokenów bez `aud` po włączeniu.
- **Decyzja**: FIXED via Fix A — sprawdzenie `iss` w `requireUserId` + zawężenie `hasAllowedParty` (tylko `undefined`/`null` znaczy klient natywny). Poprawka B (`aud` w szablonie session tokena) odrzucona: wymaga dashboardu i łamie logowanie do czasu wdrożenia obu stron.

### F2 — Brak albo zepsuty `CLERK_JWT_KEY` udaje wygasłą sesję

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `src/server/auth.ts:69-82`, `src/server/env.ts:40-46`
- **Szczegóły**: gdy sekretu nie ma albo jest zniekształcony, `loadClerkJwkFromPem` rzuca
  `LocalJWKMissing`, a `catch` zamienia to na to samo nieodróżnialne 401. Skutek: nieudany
  `wrangler secret put` daje 401 **każdemu** użytkownikowi i wygląda dokładnie jak wygasła sesja.
  `getWorkerEnv()` sprawdza tylko truthiness całego `env`, nie obecność pola. To realny tryb awarii
  akurat teraz, bo faza 4 to przebieg na produkcji — i najbardziej prawdopodobne wytłumaczenie
  niewyjaśnionego 401 z pierwszego przebiegu implementacji, którego nie udało się odtworzyć.
- **Poprawka**: rozdziel dwie klasy — `reason === 'local-jwk-missing'` (oraz brak `CLERK_JWT_KEY`
  w `getWorkerEnv()`) → 500 z `console.error`, pozostałe powody → 401 bez zmian. Przy okazji obniż
  `token-expired` do poziomu `debug`, bo wygasanie jest rutynowe, a `head_sampling_rate` to 1.
- **Decyzja**: FIXED — `misconfigured()` (500 + `console.error`) dla braku sekretu i dla `jwk-local-missing`; 401 tylko dla odrzuconej tożsamości. `token-expired` zszedł na `console.debug`. Dodany log przy niezgodnych roszczeniach, który wcześniej nie istniał.

### F3 — `headers` przez spread cicho gubi nagłówki podane jako `Headers` lub tablica

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `src/lib/api.ts:77`
- **Szczegóły**: `headers: { ...init?.headers, Authorization: ... }` działa wyłącznie dla nagłówków
  podanych jako zwykły obiekt. `RequestInit['headers']` dopuszcza też `new Headers({...})` i tablicę
  par — dla nich spread da `{}` i nagłówki **znikną bez błędu i bez ostrzeżenia typów**. Pierwszy
  `POST` z `Content-Type` w S-02 wejdzie dokładnie w tę pułapkę, a plik jest opisany jako „JEDYNY
  KANAŁ ŻĄDAŃ KLIENTA DO WŁASNEGO API", więc koszt jest maksymalny.
- **Poprawka**: `const headers = new Headers(init?.headers); headers.set('Authorization', \`Bearer ${token}\`);`
  i przekazanie `headers` w `init`.
- **Decyzja**: FIXED — `new Headers(init?.headers)` + `headers.set(...)` zamiast spreadu.

### F4 — Migracja wstecz nie czyści `d1_migrations`, więc tabela się nie odtworzy

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `migrations/down/0001_app_user.down.sql:8`
- **Szczegóły**: `DROP TABLE IF EXISTS app_user` usuwa tabelę, ale nie wpis z księgi `d1_migrations`.
  Po ręcznym cofnięciu `wrangler d1 migrations apply` uzna `0001` za zastosowaną i **nie odtworzy
  tabeli** — środowisko zostaje z działającym kodem i „no such table: app_user" na każdym
  uwierzytelnionym żądaniu. Komentarz w pliku o tym nie mówi, a to jedyny scenariusz, w którym
  ktokolwiek ten plik uruchomi.
- **Poprawka**: dopisz `DELETE FROM d1_migrations WHERE name = '0001_app_user.sql';` oraz wzmiankę
  o `npx wrangler d1 export mealplan` przed uruchomieniem.
- **Decyzja**: FIXED — dopisane `DELETE FROM d1_migrations WHERE name = '0001_app_user.sql';` oraz krok `wrangler d1 export` przed uruchomieniem, z uzasadnieniem w komentarzu.

### F5 — Stan offline jest terminalny, a komunikat obiecuje ponowną próbę

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `src/app/(app)/index.tsx:62-68`, `src/app/(app)/index.tsx:82-92`
- **Szczegóły**: tekst mówi „konto pobierzemy, gdy sieć wróci", ale `requested.current` blokuje
  ponowną próbę do końca życia komponentu; nie ma ani nasłuchu na powrót sieci, ani przycisku.
  To ten sam rodzaj nieuczciwego komunikatu, który `sign-in.tsx` celowo eliminuje — stan
  `codeDelivery: 'failed'` istnieje właśnie po to, żeby nie twierdzić, że kod poszedł.
- **Poprawka A ⭐ Zalecana**: przeformułuj tekst na to, co faktycznie się stanie — „Brak połączenia —
  odśwież ekran, gdy sieć wróci. Sesja jest zachowana."
  - Siła: zero nowego stanu i zero ryzyka; usuwa rozbieżność między obietnicą a kodem natychmiast.
  - Kompromis: użytkownik musi działać sam; ekran nie leczy się bez interakcji.
  - Pewność: HIGH — zmiana jednego literału.
  - Martwy punkt: brak znaczących.
- **Poprawka B**: dodaj przycisk „Spróbuj ponownie" zerujący `requested.current` i stan.
  - Siła: dowozi to, co komunikat już obiecuje.
  - Kompromis: nowy element interfejsu na ekranie, który jest wciąż ekranem startera; realny retry
    (nasłuch powrotu sieci) to jeszcze więcej — a offline dla planu i listy zakupów należy do S-09.
  - Pewność: MED — wymaga sprawdzenia, czy zerowanie refa nie wejdzie w konflikt z regułą
    `react-hooks/set-state-in-effect`.
  - Martwy punkt: nie sprawdzono zachowania przy wielokrotnym szybkim naciśnięciu.
- **Decyzja**: FIXED via Fix A — komunikat zmieniony na „Brak połączenia — odśwież ekran, gdy sieć wróci. Sesja jest zachowana." Poprawka B (przycisk retry) odrzucona: realny retry z nasłuchem sieci należy do S-09.

### F6 — Granica D1 w trasie bez obsługi błędów, asymetrycznie do `auth.ts`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `src/app/api/account+api.ts:14-22`, `src/server/repository/app-users.ts:50-52`
- **Szczegóły**: awaria D1 albo `throw new Error('Zapis app_user nie zwrócił wiersza…')` wychodzi
  z `worker.ts` i workerd zwraca generyczne 500. Treść błędu **nie wycieka** do klienta — `expo-server`
  (`build/cjs/runtime/index.js:69-78`) przepuszcza dalej błąd bez pola `status`, a ani błąd D1, ani
  `new Error(...)` go nie mają. Zostaje jednak asymetria: `auth.ts` celowo zamienia awarię na
  kontrolowaną odpowiedź i loguje powód, a ścieżka danych nie robi ani jednego, ani drugiego — więc
  awaria bazy jest w `wrangler tail` niewidoczna.
- **Poprawka**: `try/catch` w trasie — `console.error` z kontekstem i `Response.json({ error: 'internal' },
  { status: 500 })`, żeby kontrakt odpowiedzi był ten sam co przy 401.
- **Decyzja**: FIXED — `try/catch` w trasie z `console.error` (bez `userId` w treści) i `Response.json({ error: 'internal' }, { status: 500 })`.

### F7 — `GET` wykonuje zapis przy każdym żądaniu, a to wzorzec dla S-02

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Architektura
- **Lokalizacja**: `src/app/api/account+api.ts:20`, `src/server/repository/app-users.ts:41-48`
- **Szczegóły**: trasa odczytowa jest nieidempotentna — każde wejście na ekran to zapis do D1, a plan
  darmowy limituje zapisy, nie odczyty. Na ścieżce uwierzytelnionej nie ma ograniczenia częstości.
  Plan przewidział to w „Uwagach dotyczących wydajności" („warto `touchAppUser` ograniczyć do zapisu
  raz na dobę"), więc nie jest to niespodzianka — ale `touchAppUser` jest **wzorcem odniesienia dla
  S-02 i dalszych**, więc kształt utrwali się taki, jaki jest teraz.
- **Poprawka**: rozdziel odczyt od zapisu (`getAppUser(userId)` + warunkowy `do update … where
  last_seen_at < ?`) albo przenieś „touch" do `waitUntil`, żeby nie wisiał w ścieżce odpowiedzi.
- **Decyzja**: FIXED via Fix A — `STALE_AFTER_MS` = 1 h, warunek `where app_user.last_seen_at < ?3` w `DO UPDATE`, plus odczyt awaryjny. Zachowanie `RETURNING` przy fałszywym predykacie ZMIERZONE na D1 (oddaje `[]`), nie założone. Zweryfikowane end-to-end: pierwsze żądanie zapisuje, drugie w tej samej godzinie zwraca ten sam `lastSeenAt` bez zapisu. Ubocznie usunięta tautologia `where app_user.id = ?1`.

### F8 — Hook mieszka w `src/lib/`, a repo trzyma hooki w `src/hooks/use-*.ts`

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: `src/lib/api.ts:56`
- **Szczegóły**: `useAuthedFetch` jest hookiem, a wszystkie pozostałe hooki repo leżą w `src/hooks/`
  z nazwami `use-*.ts` (`use-theme.ts`, `use-color-scheme.ts`). `src/lib/` powstał w tym commicie
  jako nowa, jednoplikowa konwencja. Krok 3 fazy 4 planu i tak dopisuje `src/lib/api.ts` do sekcji
  „Struktura i konwencje" w `CLAUDE.md`, więc rozstrzygnięcie należy podjąć przed tym krokiem.
- **Poprawka**: albo `src/hooks/use-authed-fetch.ts` dla hooka i `src/lib/api.ts` dla klas błędów
  oraz `resolveUrl`, albo świadomie zostaw i opisz `src/lib/` w `CLAUDE.md` jako miejsce klientów
  wychodzących.
- **Decyzja**: FIXED — hook przeniesiony do `src/hooks/use-authed-fetch.ts`; w `src/lib/api.ts` zostały klasy błędów i `resolveUrl`.

### F9 — Klient natywny w trybie deweloperskim pisze do produkcyjnej D1

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Architektura
- **Lokalizacja**: `src/lib/api.ts:41-46`, `src/server/auth.ts:21`
- **Szczegóły**: domyślnym adresem dla klienta natywnego jest produkcyjny Worker, więc `expo start`
  na telefonie zapisuje do produkcyjnej bazy. Komentarz to nazywa i dziś dotyczy wyłącznie
  `last_seen_at`, ale od S-02 w tabelach będą dane objęte guardrailem prywatności z PRD (waga, wiek,
  płeć). Dodatkowo adres produkcyjnego Workera jest zaszyty w **dwóch** plikach po dwóch stronach
  granicy (`api.ts:41` i `auth.ts:21`) — rozjazd przy zmianie nazwy Workera albo własnej domeny
  objawi się jako 401 bez żadnej wskazówki.
- **Poprawka**: wyprowadź adres do jednej stałej współdzielonej i uczyń wskazanie na produkcję
  jawnym wyborem (`EXPO_PUBLIC_API_URL` wymagany w dev), zamiast domyślnym.
- **Decyzja**: FIXED via Fix A — adres wyprowadzony do `src/constants/api.ts` (`ProductionOrigin`, czytany przez obie strony granicy); w trybie dev `EXPO_PUBLIC_API_URL` jest wymagany, a jego brak daje czytelny błąd zamiast cichego zapisu do produkcyjnej D1.

### F10 — `/api/health` nie wykryje niezastosowanej migracji

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `src/app/api/health+api.ts:9`
- **Szczegóły**: `select 1` zwraca `d1: true` również na bazie bez schematu, więc smoke test wdrożenia
  z kryterium 4.3 (`/api/health` → `{"ok":true,"d1":true}`) przejdzie także wtedy, gdy migracja nie
  została zastosowana. Do tego commitu to była teoria; od teraz jest realnym trybem awarii, bo
  `/api/account` czyta `app_user`. Zakres asercji, nie naruszenie udokumentowanego wyjątku
  o `getWorkerEnv()`.
- **Poprawka**: `select 1 from app_user limit 1` albo sprawdzenie `sqlite_master`, żeby smoke test
  odpowiadał na pytanie, które faktycznie zadajemy przed przebiegiem fazy 4.
- **Decyzja**: FIXED — `/api/health` sprawdza obecność `app_user` w `sqlite_master` przez `count(*)`, nie `select 1`. Asercja rozróżnia (`1` dla istniejącej tabeli, `0` dla nieistniejącej — sprawdzone).

## Zgodność z planem — szczegóły

| Krok | Plik | Werdykt |
|---|---|---|
| 1. Zależność i sekret | `package.json` | MATCH — `@clerk/backend` ^3.17.1, lock spójny, `CLERK_SECRET_KEY` nieobecny, ścieżka odwrotu `jose` nieużyta bo niepotrzebna |
| 2. Typy środowiska | `src/server/env.ts` | MATCH — `bind()`, `run()`, `CLERK_JWT_KEY`; brak `@cloudflare/workers-types`; komentarz nagłówkowy nietknięty |
| 3. Weryfikacja tokenu | `src/server/auth.ts` | MATCH przez gałąź warunkową, którą plan sam przewidział; implementacja mocniejsza od litery planu (lista zachowana dla przeglądarki, pominięcie tylko przy braku `azp`) |
| 4. Migracje | `migrations/0001_app_user.sql`, `down/` | MATCH — DDL zgodny, zero danych tożsamościowych, `migrations_pattern` nieustawione |
| 5. Repozytorium | `src/server/repository/app-users.ts` | MATCH — `touchAppUser`, `bind(...)`, brak funkcji listującej, nagłówek nazywa regułę |
| 6. Trasa odniesienia | `src/app/api/account+api.ts` | MATCH — zero SQL-a i `getWorkerEnv()`, komentarz o „nie funkcji produktowej" |
| 7. Transport tokenu | `src/lib/api.ts`, `src/app/(app)/index.tsx` | DRIFT tylko w nazwie eksportu (`useAuthedFetch` zamiast `authedFetch`) — forma hooka wymuszona przez `useAuth()`, sygnatura zwracanego domknięcia zgodna z kontraktem; trzy stany rozdzielone |

Rozszerzenia poza planem, wszystkie ocenione jako nieszkodliwe: `RETURNING` zamiast drugiej rundy do
D1, `NATIVE_API_ORIGIN` + `resolveUrl` (konieczne — klient natywny nie ma originu), nazwane klasy
błędów, `console.warn` z powodem odrzucenia, unia `AccountState` + `AccountRow`, `useRef` jako
gwardia jednokrotności.

Twarde reguły repo sprawdzone punktowo i spełnione: brak `useMemo`/`useCallback`/`React.memo`, brak
importów `../`, `setState` wyłącznie w asynchronicznych callbackach (nie w ciele efektu), kolory przez
`themeColor`, odstępy wyłącznie ze `Spacing`, `paddingBottom: BottomTabInset + Spacing.three`,
`globalThis` dotykany wyłącznie w `env.ts`.

## Czego nie dało się rozstrzygnąć statycznie

- Czy token z Expo Go **rzeczywiście** nie ma roszczenia `azp` — przyjęte z przebiegu ręcznego
  (kryterium 3.9 potwierdzone przez użytkownika); to przesłanka całej decyzji z F1.
- Realny czas CPU `verifyToken` na żądanie (PEM → JWK → `importKey` → `verify`, bez cache klucza
  w SDK). Statycznie to jedna operacja RSA, więc do limitu 10 ms daleko, ale liczby bez pomiaru nie ma.
- Przyrost rozmiaru skryptu: `account+api.js` to 199 KB z wbudowanym `@clerk/backend` wobec 10 KB dla
  `health`. Mieści się z zapasem, ale przy kolejnych trasach warto pilnować przez `--dry-run`.
