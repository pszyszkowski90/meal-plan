<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Profil użytkownika i wyliczone zapotrzebowanie kaloryczne

- **Plan**: `context/changes/profile-and-calorie-target/plan.md`
- **Zakres**: Faza 1 z 4 — „Wzór i walidacja jako czysty moduł z testem" (commit `8da373c`, przed naprawą F1: `122e87f`)
- **Data**: 2026-09-12
- **Werdykt**: ODRZUCONY — po sortowaniu wszystkie 5 ustaleń NAPRAWIONE (2026-09-12)
- **Ustalenia**: 1 krytyczne, 3 ostrzeżenia, 1 obserwacja

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | WARNING |
| Dyscyplina zakresu | WARNING |
| Bezpieczeństwo i jakość | FAIL |
| Architektura | PASS |
| Spójność wzorców | WARNING |
| Kryteria sukcesu | PASS |

## Weryfikacja kryteriów sukcesu fazy 1

| Kryterium | Polecenie | Wynik |
|---|---|---|
| 1.1 `npm test` | `npm test` | PASS — `tests 26 / pass 26 / fail 0` |
| 1.2 `npx tsc --noEmit` | `npx tsc --noEmit` | PASS — exit 0, zero wyjścia |
| 1.3 `npx expo lint` | `npx expo lint` | PASS — czysto |
| 1.4 `npm run check-lock` | `npm run check-lock` | PASS — 1127 pakietów, 0 bez sumy kontrolnej; `package-lock.json` nietknięty w commicie |
| 1.5 Moduł bez importów (ręczne) | `grep -n import src/lib/calorie-target.ts` | PASS — zero instrukcji `import`, jedyne trafienie to komentarz w linii 11 |

Wszystkie pięć pozycji `## Progress` odznaczonych jako `[x]` ma pokrycie w dowodach. Brak
„podpisywania na ślepo".

Dodatkowo zweryfikowano kontrakt zaokrąglania niezależnym przeliczeniem: dla kobiety 61,3 kg /
170 cm / 45 lat, poziom 3 `rawBmr` = 1289.5 → `bmrKcal` = 1290 → `1290 × 1.55` = 1999.5 →
`computedKcal` = 2000. Liczenie z surowego BMR dałoby 1999, więc test na `calorie-target.test.ts:90-102`
realnie chroni regułę, a nie tylko ją deklaruje. Wszystkie 10 wierszy tabeli przypadków z planu ma
odpowiadający test — **zero przypadków brakujących**.

## Ustalenia

### F1 — Hasło w postaci jawnej i 19 artefaktów Playwrighta zacommitowanych razem z fazą

- **Ważność**: ❌ KRYTYCZNE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość (oraz Dyscyplina zakresu)
- **Lokalizacja**: `.playwright-mcp/page-2026-09-11T07-46-35-817Z.yml:8`, `.playwright-mcp/page-2026-09-11T07-48-10-301Z.yml:8`
- **Szczegóły**: Commit `122e87f` wciągnął 19 plików `.playwright-mcp/*` — logi konsoli i zrzuty
  DOM z sesji Playwrighta z 11.09. Plan nie wymienia ich w żadnej pozycji „Wymagane zmiany" fazy 1.
  Dwa zrzuty zawierają **działającą parę poświadczeń** do instancji Clerka obsługującej produkcyjny
  deploy `meal-plan.kurs-ai-szysza.workers.dev`: pole „E-mail" z adresem konta testowego
  (`mealplan-e2e-…+clerk_test@example.com`) i pole „Hasło" z 16-znakowym hasłem w czystym tekście.
  Zrzut DOM zapisuje zawartość pola hasła dosłownie. Trzy dalsze pliki zawierają Clerk `userId`
  (`user_3JAnd…`) — dokładnie roszczenie `sub`, czyli klucz główny `app_user` w D1; repo ma własną
  regułę, że `userId` nie trafia do logów, a tutaj trafił do historii gita.
  Zweryfikowano, czego **nie ma**: żadnego JWT (`eyJ…`), ciasteczka `__session`, `sk_`/`pk_`,
  nagłówka `Bearer`. `CLERK_SECRET_KEY` i `CLERK_JWT_KEY` nie wyciekły.
  **Commit nie jest wypchnięty** — `origin/main` stoi na `86017c2`, a `git branch -r --contains 122e87f`
  jest puste. To czyni naprawę tanią; po pushu zostałby tylko rewrite historii i force push.
- **Poprawka**: (1) zmień hasło tego konta w Clerku albo usuń konto — hasło działa na produkcji
  niezależnie od tego, co stanie się z gitem; (2) dopisz `.playwright-mcp/` do `.gitignore`, obok
  `.wrangler/` i `.wrangler-dry/` — ta sama klasa artefaktów narzędzia; (3) `git rm -r --cached
  .playwright-mcp && git commit --amend` przed jakimkolwiek pushem.
  - Siła: Zamyka ekspozycję zanim wyjdzie poza dysk lokalny; `.gitignore` zapobiega nawrotowi
    w fazach 2–4, które też będą uruchamiać Playwrighta.
  - Kompromis: Amend zmienia SHA `122e87f`, więc pięć pozycji `## Progress` fazy 1 trzeba
    przepisać na nowy skrót.
  - Pewność: HIGH — brak commitu na zdalnym potwierdzony dwoma niezależnymi sprawdzeniami.
  - Martwy punkt: Nie sprawdzono, czy te pliki nie zostały wcześniej skopiowane poza repo
    (backup, sync katalogu, artefakt innego narzędzia).
- **Decyzja**: NAPRAWIONE — .gitignore + git rm -r --cached + amend; commit 122e87f → 8da373c, 19 plików poza repo. Zmiana hasła w Clerku pozostaje po stronie użytkownika.

### F2 — `effectiveKcal: overrideKcal ?? computedKcal` przepuszcza `0` jako obowiązujący cel

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `src/lib/calorie-target.ts:240`
- **Szczegóły**: `??` cofa się wyłącznie przy `null` / `undefined`. Sprawdzone wykonaniem:
  `computeCalorieTarget({… targetKcalOverride: 0})` zwraca `effectiveKcal: 0` przy `computedKcal: 2759`;
  `-0` daje `-0`. Dziś broni tego `validateProfile` (granica 1000 kcal, potwierdzone: wejście `0`
  daje błąd na polu). Ale `computeCalorieTarget` jest **eksportowane osobno**, a nagłówek modułu
  (linie 7–9) ustala, że cel nie jest utrwalany w D1 i liczy się przy odczycie. Faza 2 — już
  zaplanowana — prowadzi ścieżkę `getUserProfile` → `computeCalorieTarget` **bez ponownej walidacji**,
  więc wiersz z `target_kcal_override = 0` da cichy cel 0 kcal, który zasili ograniczenie ±10%
  generatora (S-04) — twarde ograniczenie produktu z `CLAUDE.md`.
- **Poprawka A ⭐ Zalecana**: Domknąć w module — `typeof overrideKcal === 'number' && overrideKcal > 0
  ? overrideKcal : computedKcal`, plus test przypinający `0` i `-0`.
  - Siła: Chroni każdego wywołującego `computeCalorieTarget`, także generator S-04, niezależnie od
    tego, skąd przyszedł profil; zgodne z rolą modułu jako jedynego źródła prawdy o celu.
  - Kompromis: Moduł zaczyna po cichu naprawiać dane zamiast je odrzucać — maskuje zepsuty wiersz
    zamiast go ujawnić.
  - Pewność: HIGH — zachowanie potwierdzone wykonaniem, poprawka jednowierszowa.
  - Martwy punkt: Nie sprawdzono, czy S-04 nie będzie chciał odróżnić „brak nadpisania" od
    „nadpisanie nieprawidłowe".
- **Poprawka B**: Zostawić moduł i dołożyć w migracji `0002` `CHECK (target_kcal_override IS NULL OR
  target_kcal_override BETWEEN 1000 AND 6000)`.
  - Siła: Trzyma się zasady z planu, że `CHECK` jest drugą linią za `validateProfile`; zepsuty
    wiersz nie powstanie, zamiast być naprawiany przy odczycie.
  - Kompromis: Broni tylko drogi przez D1 — wywołanie `computeCalorieTarget` z ręcznie złożonym
    obiektem (podgląd na żywo w fazie 3) nadal przyjmie `0`.
  - Pewność: MEDIUM — zależy od tego, czy jakikolwiek zapis do `user_profile` ominie kiedyś trasę.
  - Martwy punkt: Nie sprawdzono, czy D1 egzekwuje `CHECK` przy `ON CONFLICT DO UPDATE`.
- **Decyzja**: NAPRAWIONE poprawką A — `calorie-target.ts:236-244` liczy `overrideApplies`
  (`typeof === 'number' && > 0`) zamiast `??`, z komentarzem nazywającym powód; test
  „nadpisanie 0 i -0 nie obowiązuje" przypina oba. `npm test` → 27/27.

### F3 — Normalizacja wagi przed sprawdzeniem granic poszerza faktyczny przedział wejściowy

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Zgodność z planem (DRIFT)
- **Lokalizacja**: `src/lib/calorie-target.ts:152-158`
- **Szczegóły**: Plan mówi „`weightKg` 30–300 (normalizowane do 0,1 kg), granice włącznie", ale nie
  rozstrzyga kolejności. Implementacja normalizuje **przed** sprawdzeniem granicy, więc faktycznie
  przyjmowany surowy przedział to `[29,95; 300,05)`. Sprawdzone wykonaniem: `29.95 → ok, value 30`;
  `300.04 → ok, value 300`; `29.9` i `300.05` odrzucone. Wartość zapisana zawsze mieści się
  w granicach, więc guardrail nie cierpi — ale **żaden test tej szczeliny nie pokrywa** (testy
  sprawdzają 29.9 / 30 / 300 / 300.1, czyli po obu jej stronach). Dla kontrastu `age`, `heightCm`
  i `targetKcalOverride` sprawdzają całkowitość **przed** granicami, więc 17.6 daje błąd
  całkowitości — kolejność jest w module niejednolita. Faza 2 uczyni z `validateProfile` granicę
  zaufania trasy `PUT /api/profile`, więc warto to rozstrzygnąć teraz.
- **Poprawka A ⭐ Zalecana**: Uznać zachowanie za zamierzone (użytkownik wpisujący 29,95 widzi
  „30,0 kg", a nie błąd) i przypiąć je testem — dodać przypadki `29.95 → 30` i `300.04 → 300`
  obok istniejących granic, a w komentarzu przy `normalizeWeight` nazwać kolejność.
  - Siła: Zachowuje przyjazne zaokrąglanie wejścia z klawiatury i zamienia niezapisaną decyzję
    w kontrakt widoczny w teście; zero zmian zachowania, więc faza 2 nie musi czekać.
  - Kompromis: Deklarowany w planie zakres „30–300" pozostaje półprawdą — czytelnik planu i kodu
    zobaczą dwie różne granice, dopóki nie zajrzy do testu.
  - Pewność: HIGH — zachowanie potwierdzone wykonaniem dla sześciu wartości brzegowych.
  - Martwy punkt: Nie ustalono, czy `CHECK` w migracji `0002` ma odzwierciedlać 30–300, czy
    szczelinę — rozjazd dałby błąd D1 zamiast czytelnego 400.
- **Poprawka B**: Sprawdzać granicę przed normalizacją, tak jak całkowitość przy pozostałych polach.
  - Siła: Zakres w kodzie zaczyna dosłownie znaczyć to, co mówi plan i co powie `CHECK` w `0002`;
    kolejność kroków staje się jednolita dla wszystkich czterech pól.
  - Kompromis: `29.95` przestaje być akceptowane, choć po zaokrągleniu byłoby poprawne — użytkownik
    dostaje błąd zakresu dla wartości, którą ekran i tak pokazałby jako 30,0 kg.
  - Pewność: MEDIUM — zmiana zachowania tuż przed fazą 2; wymaga przepisania testów granicznych wagi.
  - Martwy punkt: Nie sprawdzono, jak formularz z fazy 3 zachowa się przy wpisie „29,95" —
    czy pokaże błąd, czy po cichu zaokrągli pole.
- **Decyzja**: NAPRAWIONE poprawką A — zachowanie uznane za zamierzone i przypięte: komentarz przy
  `normalizeWeight` nazywa kolejność i jej skutek (`[29,95; 300,05)`), test „waga normalizuje się
  PRZED granicą" sprawdza 29.95 → 30, 300.04 → 300 oraz odrzucenie 29.94 i 300.05. `npm test` → 28/28.
  Do fazy 2: `CHECK` w migracji `0002` może mówić 30–300, bo zapisana wartość zawsze tam wpada.

### F4 — `validateProfile` nie jest tak twarde, jak obiecuje jego komentarz

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `src/lib/calorie-target.ts:127` (komentarz), `:135` i `:138` (kod)
- **Szczegóły**: Komentarz w linii 127 deklaruje „Nigdy nie rzuca". Destrukturyzacja w linii 138
  czyta sześć właściwości, więc getter rzucający wyjątek albo `Proxy` z pułapką `get` propaguje
  wyjątek na zewnątrz — potwierdzone wykonaniem (`THREW: boom`). Dodatkowo linia 135 przyjmuje
  każdy `typeof === 'object'`, więc **tablica z nazwanymi właściwościami** waliduje się na `ok: true`
  (potwierdzone), a odczyt idzie przez łańcuch prototypów, więc przy zatrutym `Object.prototype`
  puste ciało `{}` przeszłoby z wartościami atakującego. Realna ekspozycja z `request.json()` jest
  **zerowa** — `JSON.parse` nie produkuje ani getterów, ani tablic z nazwanymi polami. To zwężenie
  rozbieżności między obietnicą a kodem, nie łatanie czynnej dziury.
  Odporność, którą potwierdzono: brak prototype pollution przy `__proto__` w ciele JSON, odrzucanie
  `Infinity` / `NaN` / boxed `Number`, brak ReDoS (200 000 znaków → `null` w 1 ms) i — najważniejsze —
  **brak mass assignment**: zwracane `value` to świeży literał z dokładnie sześcioma znanymi kluczami,
  więc nadmiarowe pola z ciała żądania nie dojdą do SQL-a w fazie 2.
- **Poprawka**: Dopisać `&& !Array.isArray(input)` w linii 135 i złagodzić komentarz w 127 do
  „nie rzuca dla wejścia z `JSON.parse`" — albo, jeśli obietnica ma zostać dosłowna, opakować
  dostęp w `try/catch` zwracający `ok: false`.
- **Decyzja**: NAPRAWIONE — `!Array.isArray(input)` w budowie `source` (potwierdzone: tablica
  z nazwanymi polami daje teraz `ok: false`), a komentarz nie obiecuje już bezwarunkowego
  „Nigdy nie rzuca”, tylko nazywa getter/`Proxy` jako jedyną drogę wyjątku i stwierdza, że
  żaden realny wywołujący nią nie idzie. `npm test` 28/28, `tsc` i `lint` czyste.

### F5 — Komentarz przy `roundKcal` uzasadnia się nieprawdą; pre-zaokrąglenie jest no-opem

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: `src/lib/calorie-target.ts:213-219`
- **Szczegóły**: Komentarz twierdzi, że „`1290 × 1.55` ma prawo wyjść jako `1999.4999…`". W IEEE754
  ten iloczyn jest **dokładnie** 1999.5. Sprawdzono wyczerpująco całą dopuszczalną dziedzinę —
  wszystkie wagi 30–300 co 0,1 kg × wzrosty 100–250 cm × wiek 18–100 × obie płcie dla BMR, oraz
  wszystkie całkowite BMR 500–4000 × pięć mnożników dla TDEE: **zero przypadków**, w których
  `Math.round(v)` różni się od `Math.round(Math.round(v * 1e6) / 1e6)`. Pre-zaokrąglenie nie zmienia
  żadnego wyniku i nie może go zmienić dla poprawnego wejścia. Kod jest poprawny — mylące jest
  uzasadnienie, a to ma znaczenie w module, który plan wskazuje jako jedyne źródło prawdy dla
  generatora S-04 i który będzie czytany przy każdej późniejszej zmianie wzoru.
- **Poprawka**: Zastąpić komentarz stanem faktycznym — pre-zaokrąglenie jest zabezpieczeniem
  na wypadek przyszłej zmiany mnożników lub granic, nie reakcją na realny artefakt; albo usunąć je
  i zostawić `Math.round`.
- **Decyzja**: NAPRAWIONE — komentarz opisuje teraz stan faktyczny: bufor nigdy się nie uruchamia
  dla obecnych stałych (przytoczony zakres sprawdzenia), `1290 × 1.55` to dokładnie `1999.5`,
  a pre-zaokrąglenie zostaje jako zabezpieczenie na przyszłą zmianę mnożników lub granic.

## Poza ustaleniami

- **Dodatkowe eksporty ponad umowę planu** — `ActivityLevels` (`:42`) i nazwany typ
  `ProfileValidation` (`:67`). Oba uzasadnione (test iteruje po pierwszym, ekran z fazy 3 będzie
  renderował listę), nie zmieniają kontraktu. Nie traktuję ich jako rozszerzenia zakresu.
- **`/// <reference types="node" />`** w `calorie-target.test.ts:14` — nieprzewidziane przez plan,
  ale konieczne i rozwiązane bez nowej zależności. Dobra decyzja.
- **`context/foundation/roadmap.md`** w commicie — S-02 `proposed` → `in-progress`. Rutynowa
  księgowość, nie rozszerzenie zakresu.
- **`CLAUDE.md` nadal mówi „Nie ma runnera testów"** i nie zawiera wyjątku dla importu `./x.ts`
  w teście. Plan przypisuje oba zapisy fazie 4 — **stan zgodny z planem**, nie ustalenie.
- **`allowImportingTsExtensions` działa na całe repo**, a `npm test` obejmuje wyłącznie
  `src/lib/*.test.ts`. Oba zgodne z umową planu co do znaku; do rozważenia dopiero, gdy pojawi się
  drugi kandydat na test.
