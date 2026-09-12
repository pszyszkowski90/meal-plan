<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Profil użytkownika i wyliczone zapotrzebowanie kaloryczne

- **Plan**: `context/changes/profile-and-calorie-target/plan.md`
- **Zakres**: Faza 2 z 4 — „Granica danych profilu na serwerze" (commit `029517f`)
- **Data**: 2026-09-12
- **Werdykt**: WYMAGA UWAGI → wszystkie 8 ustaleń NAPRAWIONE w sortowaniu 2026-09-12
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 5 obserwacji

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | WARNING |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | PASS |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | PASS |

## Co zostało zweryfikowane niezależnie

| Kryterium | Wynik |
|---|---|
| 2.1 `tsc --noEmit`, `expo lint`, `npm test` | ✅ tsc exit 0, lint bez zgłoszeń, 28/28 testów |
| 2.2 `migrations list --local` | ✅ „No migrations to apply!" |
| 2.3 `wrangler deploy --dry-run` | ✅ 12 modułów, 559 KiB, zero `node_modules`; `profile+api.js` obecny, `routes.json` mapuje `/api/profile` |
| 2.11 `migrations list --remote` | ✅ „No migrations to apply!"; `select count(*) from user_profile` → 0 wierszy, tabela istnieje |
| 2.12 grep `prepare(` / `getWorkerEnv` w `src/app/api/` | ✅ realny kod tylko w `health+api.ts`; trafienia w `profile+api.ts` i `account+api.ts` to komentarze |
| Smoke produkcji | ✅ `/api/health` → `{"ok":true,"d1":true}`, `/api/account` → 401, `/api/profile` → 404 (faza 2 niewypchnięta — `main` wyprzedza `origin/main` o 4 commity) |

Kolejność produkcyjna jest zachowana i to jest mocna strona tej fazy: migracja `0002` jest już
na produkcji, kod jeszcze nie — czyli dokładnie odwrotnie niż tryb awarii, przed którym ostrzega
`CLAUDE.md`.

Nie dało się odtworzyć w tym przeglądzie: 2.4–2.10 (żądania HTTP na `wrangler dev` z tokenami kont
A i B) oraz 2.13–2.14. Świeży `npx expo export -p web` przerwał się na `EBUSY: rmdir dist\client`
(proces trzyma katalog) — dry-run poszedł na istniejącym `dist/` z tego samego drzewa.

## Ustalenia

### F1 — Cztery nieplanowane ograniczenia CHECK powielają `ProfileBounds`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Dyscyplina zakresu / Bezpieczeństwo danych
- **Lokalizacja**: `migrations/0002_user_profile.sql:29-34` vs `src/lib/calorie-target.ts:35-40`
- **Szczegóły**: Plan kontraktował `CHECK` wyłącznie na `sex` i `activity_level`
  (`plan.md:305-310`). Implementacja dołożyła cztery zakresy liczbowe: `age BETWEEN 18 AND 100`,
  `weight_kg BETWEEN 30 AND 300`, `height_cm BETWEEN 100 AND 250`, `target_kcal_override …
  BETWEEN 1000 AND 6000`. Dziś wszystkie zgadzają się co do cyfry z `ProfileBounds` — sprawdzone
  wartość po wartości, łącznie z przypadkiem wagi (normalizacja do 0,1 kg biegnie PRZED kontrolą
  granic, więc okno akceptacji `[29.95, 300.05)` zawsze zapisuje wartość z `[30, 300]`; komentarz
  migracji w wierszach 20-21 jest prawdziwy). Problemem nie jest dzisiejsza zgodność, tylko brak
  mechanizmu jej utrzymania i asymetryczny koszt rozjazdu: rozluźnienie `ProfileBounds.age.min`
  do 16 tylko po stronie TS daje użytkownikowi **500 `internal`** z `internalError`
  (`profile+api.ts:44-48`) zamiast 400 z błędem pod polem — nierozróżnialne od awarii D1. Naprawa
  nie jest jednolinijkową migracją: SQLite nie ma `ALTER TABLE … DROP CONSTRAINT`, więc każda
  zmiana granicy to przebudowa tabeli (create/copy/drop/rename) z własną parą w `down/`.
  Uboczne: `target_kcal_override IS NULL OR …` (wiersz 34) jest zbędne — `CHECK` zwracający NULL
  i tak przechodzi w SQLite.
- **Poprawka A ⭐ Zalecana**: Zostaw `CHECK`-i na `sex` i `activity_level`, usuń trzy zakresy
  liczbowe (faza nie jest wypchnięta, więc `0002` da się jeszcze poprawić na miejscu).
  - Siła: enumeratywne `CHECK`-i są jedynymi, które niosą argument poprawnościowy — chronią
    rzutowania `as Sex` / `as ActivityLevel` w `user-profile.ts:41-42`. Zakresy liczbowe kupują
    dużo mniej, a kosztują przebudowę tabeli przy każdej korekcie granicy.
  - Kompromis: druga linia obrony przed zapisem z pominięciem trasy staje się węższa.
  - Pewność: MEDIUM — `saveUserProfile` jest jedyną drogą zapisu, więc realny ruch i tak
    przechodzi przez `validateProfile`; ryzyko to przyszły skrypt migracyjny lub `d1 execute`.
  - Martwy punkt: nie sprawdzono, czy S-03/S-04 planują masowy zapis profili z pominięciem trasy.
- **Poprawka B**: Zostaw wszystkie `CHECK`-i i udokumentuj sprzężenie w obie strony — nagłówek
  `0002` mówi, że zmiana `ProfileBounds` wymaga migracji przebudowującej tabelę, a komentarz przy
  `ProfileBounds` (`calorie-target.ts:35`) odsyła do `0002`. Zaktualizuj plan aneksem.
  - Siła: zachowuje obronę w głąb i już wykonaną pracę; koszt to dwa komentarze.
  - Kompromis: sprzężenie zostaje, tylko przestaje być niewidoczne; plan staje się ruchomym celem.
  - Pewność: HIGH — to samo repo już rozwiązuje podobne sprzężenia komentarzem nagłówkowym.
  - Martwy punkt: komentarz nie jest wymuszany przez nic — `tsc` nie złapie rozjazdu.
- **Decyzja**: NAPRAWIONE poprawką A — trzy zakresy liczbowe usunięte z `0002`, zostały tylko `CHECK` na `sex` i `activity_level`; nagłówek migracji nazywa `ProfileBounds` jedynym źródłem prawdy dla granic. Obie bazy przebudowane (`down` + `apply`, `--local` i `--remote`), schemat na produkcji zweryfikowany przez `sqlite_master`.

### F2 — `GET /api/profile` oddaje dane osobowe bez `Cache-Control: no-store`

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `src/app/api/profile+api.ts:47, 60, 94`
- **Szczegóły**: Odpowiedź niesie wiek, wagę, wzrost i płeć — dokładnie pola, które
  `profile+api.ts:40-43` nazywa objętymi guardrailem prywatności z PRD — przez gołe
  `Response.json(...)`, bez dyrektyw cache'owania i bez `Vary`. Ekspozycja jest ograniczona
  (Cloudflare nie cache'uje domyślnie uwierzytelnionych `/api/*`, a odpowiedź nie ma
  `Last-Modified`), ale cache przeglądarki może przechować to na dysku wg reguł heurystycznych
  RFC 9111 — czytelne po wylogowaniu i na współdzielonej maszynie. `account+api.ts` ma tę samą
  lukę, więc to nie regresja; to pierwsza trasa, na której ładunek jest naprawdę osobowy.
- **Poprawka A ⭐ Zalecana**: Dodaj `{ headers: { 'Cache-Control': 'no-store' } }` do obu
  odpowiedzi `toResponse(...)` w `profile+api.ts`.
  - Siła: dwie linie, zero ryzyka regresji, zamyka rzecz tam, gdzie dane osobowe faktycznie są.
  - Kompromis: `account+api.ts` i przyszłe trasy dalej podejmują tę decyzję od nowa.
  - Pewność: HIGH — nagłówek jest jednoznaczny i nie wpływa na klienta natywnego.
  - Martwy punkt: brak znaczących.
- **Poprawka B**: Wprowadź wspólny helper JSON (np. `src/server/json.ts`) z `no-store`
  domyślnie i przepnij na niego `profile+api.ts` oraz `account+api.ts`.
  - Siła: S-03 (preferencje) i S-04 (plany) dziedziczą regułę, zamiast ją powtarzać — trzecia
    trasa produktowa jest już przewidziana w planie.
  - Kompromis: nowy plik i nowa granica do utrzymania w fazie, która miała tylko powtórzyć S-01;
    to zakres, którego plan nie przewidział.
  - Pewność: MEDIUM — kształt helpera zależy od tego, czy S-03 będzie potrzebować innych nagłówków.
  - Martwy punkt: nie sprawdzono, czy `health+api.ts` ma zostać poza tym helperem.
- **Decyzja**: NAPRAWIONE poprawką A — helper `profileJson` w `profile+api.ts` oddaje obie odpowiedzi `ProfileResponse` z `Cache-Control: no-store`.

### F3 — Komentarz `saveUserProfile` obiecuje bezpieczeństwo limitu zapisów D1, którego nie dowodzi

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `src/server/repository/user-profile.ts:60-63`, ścieżka `PUT`
  w `src/app/api/profile+api.ts:66-97`
- **Szczegóły**: Komentarz uzasadnia brak progu świeżości tym, że „zapis profilu jest jawną akcją
  użytkownika […], więc pętla renderów nie ma jak go wywołać i limit zapisów D1 nie jest
  zagrożony". Pierwsza połowa jest prawdziwa, druga nie wynika z pierwszej: rozumowanie obejmuje
  wyłącznie pętlę we własnym UI, a nie klienta skryptowego z ważnym tokenem, który po prostu
  woła `PUT /api/profile` w pętli. Każde takie żądanie to **dwa** zapisy do D1 (`touchAppUser`
  plus upsert profilu), a limit 100 tys./dobę jest wspólny dla wszystkich kont — czyli dokładnie
  ten zasób, o który `app-users.ts:30-36` tak starannie dba na ścieżce odczytu. Nie ma
  rate-limitu, bindingu Rate Limiting też nie ma w `wrangler.jsonc`. Realne ryzyko w MVP z kilkoma
  kontami jest znikome; problemem jest zdanie w kodzie, które czyta się jak dowód.
- **Poprawka**: Popraw komentarz tak, żeby mówił, co obejmuje rozumowanie (własny klient), a co
  nie (klient skryptowy z ważnym tokenem); rate-limit odnotuj jako świadomie odłożony. Opcjonalnie
  tanio: pomiń upsert, gdy nadesłany `ProfileInput` jest identyczny z wierszem w bazie.
- **Decyzja**: NAPRAWIONE — komentarz `saveUserProfile` nazywa granicę rozumowania (własny klient vs klient skryptowy z ważnym tokenem) i odnotowuje rate-limit jako świadomie odłożony.

### F4 — `touchAppUser` na ścieżce zapisu to złe narzędzie: do dwóch rund do D1 i obcy tryb 500

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Architektura / Wydajność
- **Lokalizacja**: `src/app/api/profile+api.ts:90` → `src/server/repository/app-users.ts:54-85`
- **Szczegóły**: Plan nazywa to „jedno tanie zapytanie" (sekcja Krytyczne szczegóły) i to jest
  nieścisłość samego planu, nie implementacji. W stanie ustalonym (wiersz `app_user` istnieje,
  `last_seen_at` świeży) `touchAppUser` wykonuje upsert, dostaje puste `RETURNING`, bo predykat
  `where app_user.last_seen_at < ?3` jest fałszywy, i **dociąga awaryjny SELECT** — dwie rundy,
  których wynik trasa w wierszu 90 wyrzuca w całości. `saveUserProfile` dokłada trzecią. Klucz
  obcy potrzebuje wyłącznie ISTNIENIA wiersza, co `insert … on conflict(id) do nothing` załatwia
  jedną rundą bez odczytu. Przy okazji na ścieżkę zapisu profilu wchodzi cudzy tryb awarii:
  `throw new Error('Wiersz app_user ani nie powstał, ani nie istnieje…')` (`app-users.ts:81`)
  zamienia się w 500, który nie ma nic wspólnego z profilem.
- **Poprawka A ⭐ Zalecana**: Dodaj `ensureAppUser(userId)` w `app-users.ts` (`insert … on
  conflict(id) do nothing`, bez `RETURNING` i bez odczytu) i wołaj je w `PUT` zamiast
  `touchAppUser`.
  - Siła: jedna runda zamiast dwóch, intencja („zapewnij wiersz") wyrażona wprost, a obcy 500
    znika ze ścieżki profilu; `touchAppUser` zostaje tym, czym jest — narzędziem ścieżki odczytu.
  - Kompromis: nowa funkcja w repozytorium i zmiana w pliku spoza kontraktu fazy 2.
  - Pewność: HIGH — `DO NOTHING` bez `RETURNING` to jedno zapytanie, a FK sprawdza tylko istnienie.
  - Martwy punkt: `last_seen_at` przestaje się odświeżać przy samym zapisie profilu — do ustalenia,
    czy to komukolwiek przeszkadza (dziś nic tej kolumny nie czyta).
- **Poprawka B**: Zostaw `touchAppUser` i popraw komentarz w `profile+api.ts:87-89` oraz zdanie
  w planie, żeby mówiły „do dwóch zapytań", nie „jedno tanie zapytanie".
  - Siła: zero zmian w kodzie działającym i zweryfikowanym; koszt jest realnie mały przy jednym
    kliknięciu „Zapisz".
  - Kompromis: zostaje trzecia runda i obcy tryb 500 na ścieżce produktowej.
  - Pewność: HIGH — nic się nie psuje.
  - Martwy punkt: brak znaczących.
- **Decyzja**: NAPRAWIONE poprawką A — `ensureAppUser(userId)` w `app-users.ts` (`on conflict(id) do nothing`, jedna runda, bez odczytu); `PUT` woła je zamiast `touchAppUser`. Plan zaktualizowany w czterech miejscach.

### F5 — Interpolacja `${SELECT_COLUMNS}` wewnątrz `prepare(` psuje grep-owy wykrywacz wstrzyknięć

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: `src/server/repository/user-profile.ts:29, 51, 87`
- **Szczegóły**: `SELECT_COLUMNS` jest stałą modułu, więc **wstrzyknięcia tu nie ma** — wszystkie
  wartości idą przez `bind(...)`. Rzecz w tym, że `app-users.ts:62-66, 76` wypisuje listy kolumn
  dosłownie, a ten plik pierwszy raz w repo wprowadza `${…}` do napisu w `prepare(`. Praktyczny
  koszt: grep za interpolacją wewnątrz `prepare(` przestaje być wiarygodnym sygnałem alarmowym
  w katalogu, który — przy braku testów — jest jedyną izolacją danych między kontami.
- **Poprawka**: Albo rozwiń listy kolumn dosłownie, jak w `app-users.ts`, albo zostaw
  `SELECT_COLUMNS` i dopisz w nagłówku jedną linię z regułą: identyfikatory wolno interpolować
  ze stałych modułu, wartości nigdy.
- **Decyzja**: NAPRAWIONE — nagłówek `user-profile.ts` zapisuje regułę: interpolować wolno wyłącznie identyfikatory ze stałych modułu, wartości nigdy.

### F6 — `requireUserId` jest awaitowane poza `try`, więc awaria bindingów ucieka bez logu

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `src/app/api/profile+api.ts:52` i `:67`
- **Szczegóły**: `requireUserId` woła `getWorkerEnv()` (`auth.ts:95`), które rzuca, gdy bindingów
  nie ma (trasa uruchomiona poza workerd). Odrzucenie wychodzi z handlera bez wpisu
  `[api/profile]` i z generycznym 500 od workerd — czyli dokładnie tym trybem awarii, przed którym
  `account+api.ts:29-31` deklaruje, że chroni `try/catch`. Wada jest odziedziczona po
  `account+api.ts`, ale nowa trasa ją powiela.
- **Poprawka**: Albo rozszerz `try` tak, żeby objął wywołanie `requireUserId`, albo świadomie tego
  nie rób i zapisz powód w nagłówku pliku, żeby trzecia trasa nie rozstrzygała tego od zera.
- **Decyzja**: NAPRAWIONE — `requireUserId` jest w obu metodach objęte `try`; w `PUT` osobnym, żeby nie połknął 400 za ciało i za walidację.

### F7 — Klucz obcy bez `ON DELETE`

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo danych
- **Lokalizacja**: `migrations/0002_user_profile.sql:28`
- **Szczegóły**: `REFERENCES app_user(id)` bez akcji znaczy, że przyszłe usuwanie konta poleci na
  `FOREIGN KEY constraint failed`, dopóki profil nie zostanie skasowany pierwszy. Dziś nic nie jest
  zepsute — usuwanie konta jest jawnie poza zakresem M-01 — ale nagłówek `down/0002` już musiał
  opisać tę samą kolejność, więc ograniczenie zaczyna kosztować, a schemat ma dopiero dwie tabele.
- **Poprawka**: Rozważ `ON DELETE CASCADE` albo odnotuj zamierzoną kolejność usuwania w nagłówku
  `0002` teraz, zanim dojdą preferencje (S-03) i plany (S-04).
- **Decyzja**: NAPRAWIONE — `ON DELETE CASCADE` w `0002` plus uzasadnienie w nagłówku; obie bazy przebudowane tym samym ruchem, schemat produkcyjny zweryfikowany.

### F8 — Część odhaczonych kryteriów nie ma śladu w repo; adnotacje SHA nie są zacommitowane

- **Ważność**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: `context/changes/profile-and-calorie-target/plan.md:703-719`
- **Szczegóły**: Kryteria 2.1, 2.2, 2.3, 2.11 i 2.12 odtworzyłem samodzielnie i wszystkie
  przechodzą. Kryteria 2.4–2.10 (żądania na `wrangler dev` z tokenami kont A i B) oraz ręczne
  2.13–2.14 są odhaczone, ale nie zostawiają żadnego artefaktu w repo — to świadoma cecha tej
  zmiany („zero testów tras API" w „Czego NIE robimy"), nie zaniedbanie, więc stoją na słowie
  wykonawcy. Kod jest z nimi strukturalnie zgodny (401 przed ścieżką danych, 200 z `profile: null`,
  400 `invalid_json` oddzielone od 500, log bez `userId` i bez ciała). Osobno: `plan.md` jest
  brudny w drzewie roboczym — wszystkie adnotacje `— 029517f` w `## Progress` są niezacommitowane,
  więc zapis fazy istnieje tylko na dysku.
- **Poprawka**: Zacommituj adnotacje SHA razem z domknięciem ustaleń tego przeglądu; jeśli chcesz
  ślad dla 2.4–2.10, wklej surowe odpowiedzi HTTP do `reviews/` albo do notatek `change.md`.
- **Decyzja**: NAPRAWIONE — adnotacje SHA i domknięcie ustaleń idą jednym commitem. Ślad dla 2.4–2.10 nie powstał; poprawki F1/F2/F4/F6 zmieniły schemat i zachowanie tras, więc te kryteria wymagają ponownego przebiegu na `wrangler dev` przed pushem.
