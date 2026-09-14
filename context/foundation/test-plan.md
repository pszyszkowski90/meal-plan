# Plan testów — MealPlan

> Strategia stopniowego wdrażania testów. Dokument jest **specyfikacją QA**, nie audytem kodu:
> mówi, *co może się zepsuć* i *dlaczego uważamy to za prawdopodobne*. Nie twierdzi, która linia
> odpowiada za awarię — tę wiedzę produkuje `/10x-research` w każdej fazie wdrożenia.

- Utworzony: 2026-09-12
- Źródła: `context/foundation/prd.md`, `context/foundation/roadmap.md`,
  `context/foundation/tech-stack.md`, `CLAUDE.md`,
  `context/archive/2026-09-12-profile-and-calorie-target/` (plan i trzy przeglądy; zarchiwizowane 13.09.2026),
  skan hot-spotów historii gita (30 dni)
- Profil bazy testowej w chwili pisania: **`sparse`** — runner jest podpięty
  (`npm test` → `node --test` na `src/lib/*.test.ts`), ale istnieje **jeden** plik testowy,
  skupiony wyłącznie w `src/lib/`. Reszta bazy kodu jest pusta.

---

## 1. Strategy

Testy w tym projekcie podlegają trzem nienegocjowalnym zasadom:

1. **Koszt × sygnał.** Wygrywa najtańszy test, który daje prawdziwy sygnał dla danego ryzyka.
   Nie promuj do e2e dlatego, że e2e „wydaje się bezpieczniejsze". Nie nakładaj modelu wizyjnego
   na deterministyczną różnicę, która już wykrywa regresję.
2. **Obawy zespołu są dowodem pierwszej kategorii.** Ryzyko zakotwiczone w „zespół obawia się X,
   awaria wyszłaby gdzieś w `<obszar>`" waży tyle samo, co linia PRD czy dane o hot-spotach.
3. **Ryzyka to scenariusze, nie lokalizacje w kodzie.** Ten plan dokumentuje *co mogłoby zawieść*
   i *dlaczego uważamy to za prawdopodobne* — na podstawie dokumentów i *sygnału* z bazy kodu
   (zmienność, struktura, baza testowa). **Nie** twierdzi, że zna linię, która jest właścicielem
   awarii. Tę wiedzę produkuje `/10x-research` w trakcie każdej fazy wdrożenia. Jeśli plan
   i badanie nie zgadzają się co do tego, gdzie mieszka awaria, **prawdą jest badanie**.

Zakres hot-spotów użyty do ważenia prawdopodobieństwa: `src/`, `migrations/`, `scripts/`
(15 commitów w 30 dni; wykluczone `node_modules`, `dist`, `.expo`, `context/`, `notes/`).

---

## 2. Risk Map

| # | Ryzyko (scenariusz awarii) | Wpływ | Prawdop. | Źródło (dowód — nie kotwica) |
|---|---|---|---|---|
| 1 | Konto A odczytuje lub nadpisuje dane profilu konta B (wiek, waga, płeć) | Wysoki | Wysoki | PRD §Guardrails („dane profilu nie są dostępne dla nikogo poza właścicielem"), PRD §Access Control („pełna izolacja danych między kontami"); `CLAUDE.md` — D1 nie ma RLS, filtrowanie po `userId` jest **jedyną** izolacją; katalog hot-spot `src/server/repository/` (5 commitów/30d) |
| 2 | Bramka sesji wpuszcza niezalogowanego do widoku produktowego albo wyrzuca zalogowanego przy odświeżeniu strony | Wysoki | Wysoki | PRD §Access Control („niezalogowany nie ma dostępu do żadnego widoku produktowego"); `CLAUDE.md` — web renderuje HTML bez sesji, Clerk odtwarza ją dopiero po hydracji, stan neutralny jest konieczny; katalog hot-spot `src/app/(auth)/` (10 commitów/30d) |
| 3 | Chwilowa utrata sieci jest interpretowana jako wylogowanie — użytkownik wypada z aplikacji zamiast zobaczyć komunikat | Wysoki | Średni | `CLAUDE.md` — reguła wprost: „**offline** to nie **wylogowany**", kod nie może ich mylić; PRD §NFR (plan i lista mają być dostępne bez połączenia); katalog hot-spot `src/lib/` (6 commitów/30d) |
| 4 | Cel kaloryczny pokazany lub zapisany rozjeżdża się z wyliczeniem z profilu | Wysoki | Średni | PRD §Guardrails (±10% unieważnia obietnicę produktu), PRD FR-003; `CLAUDE.md` — ograniczenie twarde, nie preferencja; przegląd fazy 1, ustalenia F2 i F3 (zero jako obowiązujący cel, normalizacja przed sprawdzeniem granic) |
| 5 | Sekret, hasło testowe lub dane osobowe wyciekają do repozytorium, logu albo cache pośrednika | Wysoki | Średni | **Przegląd fazy 1, ustalenie F1 (KRYTYCZNE) — hasło w postaci jawnej i 19 artefaktów narzędzia E2E trafiły do commitu.** To realne sparzenie, nie hipoteza; przegląd fazy 2, ustalenie F2 (dane osobowe oddawane bez `no-store`) |
| 6 | Serwer ufa klientowi — wartość odrzucona przez formularz przechodzi, gdy wysłać ją z pominięciem UI | Wysoki | Średni | PRD §Business Logic („wykluczenia i cel są twardymi ograniczeniami"); przegląd fazy 2, ustalenie F1 (ograniczenia bazy powielają granice walidacji); kryterium 2.6 planu fazy 2 |
| 7 | Zmiana przechodzi lokalnie i pada po wdrożeniu na Workers (adapter, reguły bundlowania, brak sekretu) | Średni | Wysoki | `CLAUDE.md` — `expo start --web` **nie jest** testem wdrożenia, cztery reguły `rules` zapobiegają konkretnym awariom, bindingi nie są w `process.env`; katalog hot-spot `src/app/api/` (7 commitów/30d) |

**Wysoki wpływ × niskie prawdopodobieństwo, świadomie poza mapą:** awaria Cloudflare lub Clerka
jako dostawców. To temat obserwowalności i komunikatu o niedostępności, nie testu.

### Risk Response Guidance

| Ryzyko | Co udowodniłoby ochronę | Musi kwestionować | Kontekst do ugruntowania przez `/10x-research` | Prawdopodobnie najtańsza warstwa | Anty-wzorzec do uniknięcia |
|---|---|---|---|---|---|
| #1 | Żądanie z tożsamością B nigdy nie zwraca ani nie modyfikuje wiersza należącego do A — także gdy identyfikator zasobu podać wprost | „Skoro trasa woła `requireUserId`, dane są odizolowane" — uwierzytelnienie to nie autoryzacja | Kształt tożsamości w tokenie, sposób filtrowania w zapytaniu, czy istnieje ścieżka zapisu pomijająca filtr | integracyjna (dwie tożsamości po HTTP) | Test z jednym kontem; sprawdzenie wyłącznie 200/401 bez porównania **treści** między kontami |
| #2 | Nieuwierzytelniona nawigacja na trasę produktową kończy się na logowaniu, a odświeżenie strony zalogowanego **nie** miga ekranem logowania i nie wyrzuca z aplikacji | „HTML wrócił 200, więc bramka działa" — serwer renderuje bez sesji z założenia | Kolejność: render serwerowy → hydracja → odtworzenie sesji; kto jest właścicielem nawigacji po zmianie sesji | e2e (przeglądarka — tylko tam istnieje hydracja) | Asercja na samym kodzie HTTP; czekanie na stały czas zamiast na stan; test, który loguje się raz i zakłada sesję do końca pliku |
| #3 | Przy zerwanej sieci użytkownik widzi komunikat o braku połączenia i **zostaje** zalogowany, z wartościami na ekranie | „Żądanie się nie udało, więc sesja jest nieważna" | Skąd bierze się rozróżnienie obu błędów i którędy przechodzi na ekran | e2e z przechwyceniem ruchu sieciowego (przeglądarka) | Mockowanie warstwy błędów zamiast samej sieci — testowałoby własny mock, nie zachowanie |
| #4 | Dla danego profilu wartość widoczna na ekranie i wartość utrwalona są **tą samą** liczbą, zgodną z niezależnie policzoną wyrocznią | „Test przechodzi, bo wynik równa się temu, co zwraca moduł" — to tautologia | Gdzie wartość jest liczona, gdzie utrwalana i czy istnieją dwa miejsca liczące | jednostkowa (wyrocznia) + integracyjna (utrwalenie) | **Problem wyroczni**: wartość oczekiwana przepisana z implementacji. Liczby biorą się z wymagania, nie z kodu |
| #5 | Po przebiegu testów `git status` jest czysty, a żaden commit nie zawiera poświadczeń ani artefaktów przebiegu | „Plik z hasłem jest tymczasowy, nie trafi do commitu" — już raz trafił | Co narzędzie E2E zapisuje na dysk i czy te ścieżki są ignorowane | bramka (sprawdzenie przed commitem) + poświadczenia wyłącznie ze zmiennych środowiskowych | Trzymanie danych logowania w pliku testowym „na chwilę" |
| #6 | Wartość odrzucona przez formularz, wysłana bezpośrednio do API, zostaje odrzucona z tym samym skutkiem | „Formularz waliduje, więc dane są bezpieczne" — klient jest pod kontrolą atakującego | Czy walidacja serwerowa i klientowa dzielą jedno źródło granic, czy są dwiema kopiami | integracyjna (żądanie po HTTP z pominięciem UI) | Testowanie wyłącznie przez UI; asercja na komunikacie zamiast na skutku (brak zapisu) |
| #7 | Zbudowany artefakt uruchomiony w docelowym środowisku uruchomieniowym obsługuje HTML, trasę API i nieznaną ścieżkę tak samo jak produkcja | „Działa w trybie deweloperskim, więc zadziała po wdrożeniu" — to inny runtime | Co dokładnie emituje build i które reguły decydują o kształcie bundla | dymny na zbudowanym artefakcie w docelowym runtime | Traktowanie serwera deweloperskiego jako dowodu wdrożeniowego |

---

## 3. Phased Rollout

| # | Nazwa fazy | Cel (jedna linia) | Ryzyka | Typy testów | Status | Folder zmiany |
|---|---|---|---|---|---|---|
| 1 | Ścieżka krytyczna w przeglądarce | Udowodnić, że bramka sesji i granica danych trzymają się na zbudowanym artefakcie | #2, #1, #7 | e2e + dymny | `complete` | — (harness powstał w ramach `profile-and-calorie-target`, zarchiwizowanej 13.09.2026) |
| 2 | Ścieżka profilu i cel kaloryczny | Udowodnić, że liczba widziana i liczba zapisana to ta sama liczba, a błędne dane nie jadą do sieci | #4, #6, #3 | e2e + jednostkowe | `complete` | — (wykonane w `profile-and-calorie-target`: `profile-api.spec.ts`, `profile-screen.spec.ts`) |
| 3 | Odporność granicy danych | Dwie tożsamości i żądania z pominięciem UI jako stały test, nie ręczne sprawdzenie | #1, #6, #5 | integracyjne | `complete` | — (wykonane w `dietary-preferences`: `account-isolation.spec.ts` na dwóch kontach, `data-boundary.spec.ts`, `preferences-api.spec.ts`) |
| 4 | Bramki jakości | Zabetonować dolną granicę, żeby regresja nie przeszła po cichu | przekrojowe | bramki | `complete` | — (trzy warstwy lokalne w `hooks/` + `quality-gate.yml` w CI, działają od 13.09.2026) |

**Słownictwo statusu:** `not started` → `change opened` → `researched` → `planned` →
`implementing` → `complete`.

> **Uwaga o fazie 1.** Harness powstaje w ramach nocnej pracy nad `profile-and-calorie-target`
> (zadania T1 i T4 w `notes/night-queue.md`), a nie w osobnym folderze zmiany. To świadome
> odstępstwo od domyślnej mechaniki tej umiejętności: testy weryfikują fazę 3 tej właśnie zmiany,
> więc rozdzielanie ich do własnego folderu rozjechałoby kryteria sukcesu z ich dowodami.
> Fazy 2–4 mogą pójść normalną ścieżką `/10x-new` → `/10x-research` → `/10x-plan`.

---

## 4. Stack

| Warstwa | Narzędzie | Wersja | Uwagi |
|---|---|---|---|
| jednostkowe | `node --test` (wbudowany w Node) | runtime hosta | Już podpięte jako `npm test`. Zero zależności — świadome, bo `npm install` psuje lockfile na Windowsie |
| e2e | Playwright | instalowany **poza** `package.json` | Ograniczenie twarde: `npm install` w tym repo zapisuje wpisy `*-wasm32*` bez ich zależności i wywraca `npm ci` na Linuksie. Po przebiegu `git diff package-lock.json` musi być pusty |
| środowisko dla e2e | `wrangler dev` na zbudowanym `dist/` | wrangler ^4.127.1 | Jedyne wierne odwzorowanie runtime'u. Serwer deweloperski Expo uruchamia trasy API w Node i **nie jest** dowodem wdrożeniowym |
| typy | `tsc --noEmit` | typescript ~6.0.3 | Jedyne pełne sprawdzenie poprawności w repo poza testami |
| lint | `expo lint` | eslint-config-expo ~57.0.2 | Włącza reguły React Compilera; `setState` w efekcie jest **błędem**, nie ostrzeżeniem |
| spójność zależności | `npm run check-lock` | — | Odtwarza sprawdzenie z `npm ci` lokalnie |
| (opcjonalnie) AI-natywne | przegląd wizualny | — | Nie rekomendowane na tym etapie: deterministyczne asercje pokrywają dzisiejsze ryzyka taniej |

**Stack grounding tools (sesja z 2026-09-12):**

- Docs: Context7 dostępny w sesji — **nie odpytany**; wersje frameworka bierzemy z `package.json`
  i `CLAUDE.md`, które są dla tego repo bardziej wiążące niż dokumentacja ogólna.
  Sprawdzono: 2026-09-12
- Search: Exa dostępny — nie użyty; pytanie „jak testować to repo" rozstrzygają reguły projektu,
  nie sieć. Sprawdzono: 2026-09-12
- Runtime/browser: Playwright MCP dostępny w sesji — **rozważany jako warstwa wykonawcza** dla
  fazy 1. Sprawdzono: 2026-09-12
- Provider/platform: brak MCP Cloudflare w sesji; weryfikacja wdrożenia idzie przez CLI wranglera.
  Sprawdzono: 2026-09-12

---

## 5. Quality Gates

| Bramka | Gdzie | Wymagana? | Co łapie |
|---|---|---|---|
| `tsc --noEmit` + `expo lint` | lokalnie przed pushem | wymagana | dryf typów, `setState` w efekcie, martwe trasy |
| `npm test` | lokalnie przed pushem | wymagana | regresje logiki wyliczeń i walidacji |
| `npm run check-lock` | lokalnie po zmianie zależności | wymagana | lockfile zepsuty w sposób niewidoczny do czasu builda na Linuksie |
| czysty `git status` + brak poświadczeń w diffie | przed każdym commitem | **wymagana** | ryzyko #5 — to się już wydarzyło |
| e2e ścieżki krytycznej na `wrangler dev` | przed wdrożeniem | wymagana po fazie 1 | zepsuta bramka sesji, zepsuta granica danych |
| `wrangler deploy --dry-run` | przed wdrożeniem | wymagana | bundel przekraczający limit, moduły z `node_modules` |
| dymny po wdrożeniu | po wdrożeniu | wymagana | awarie widoczne tylko na produkcji |
| CI (Workers Builds na `main`) | po pushu | informacyjna | build; **nie** uruchamia typechecku ani testów |

> CI w tym repo to Cloudflare Workers Builds, nie GitHub Actions. **Nie uruchamia lintu,
> typechecku ani testów** — bramki lokalne są jedyną realną obroną. Faza 4 wdrożenia ma to zmienić.

---

## 6. Cookbook Patterns

### 6.1 Test jednostkowy

Wzorzec istnieje: `src/lib/calorie-target.test.ts` (`node:test` + `node:assert/strict`,
`describe` / `it`, nazwy przypadków po polsku). Nowy plik `*.test.ts` w `src/lib/` jest
automatycznie łapany przez `npm test`. Wartości oczekiwane biorą się z wymagania, nie
z uruchomienia implementacji.

### 6.2 Test integracyjny

Wzorzec odniesienia: `tests/e2e/account-isolation.spec.ts` — dwa prawdziwe konta naraz, jedno
z zapisanej sesji, drugie zalogowane w świeżym kontekście, i ta sama własność sprawdzona dwiema
drogami: przez ekran i przez żądanie z pominięciem UI. Sprawdzone celowym zepsuciem filtra
`user_id` (14.09.2026) — bez dowodu, że test potrafi się zaczerwienić, zielony przebieg niczego
nie znaczy.

### 6.3 Test e2e

TBD — patrz §3 faza 1, wzorzec „bramka sesji przeżywa odświeżenie strony".

### 6.4 Test nowej trasy API

TBD — patrz §3 faza 3, wzorzec „odmowa bez tożsamości i odmowa dla cudzego zasobu".

### 6.5 Uwagi per faza wdrożenia

Uzupełniane przez ostatnią podfazę każdej fazy.

---

## 7. Czego świadomie nie testujemy

| Obszar | Powód |
|---|---|
| Wewnętrzne mechanizmy Clerka (siła hasła, limit prób, dostarczanie maili) | Kupiona usługa; testowalibyśmy cudzy produkt. Nasza granica to weryfikacja podpisu tokenu |
| Warstwa prezentacji na Androidzie i iOS | Brak automatyzacji natywnej w tym repo. Weryfikacja ręczna, świadomie przyjęte ryzyko |
| Zakres poza MVP (dziennik jedzenia, śledzenie wagi, plan miesięczny, FR-005, FR-015) | Nie istnieje |
| Generator planu i guardrail ±10% na poziomie tygodnia | Zablokowane decyzją o źródle przepisów. Wejdzie do mapy, gdy zapadnie |
| Migawki wizualne ekranów | Kruche i nic nie wykrywają przy dzisiejszej zmienności UI |

---

## 8. Freshness Ledger

| Pozycja | Sprawdzono | Odśwież, gdy |
|---|---|---|
| Skan hot-spotów (15 commitów/30d) | 2026-09-12 | po zamknięciu fazy 4 zmiany `profile-and-calorie-target` |
| Profil bazy testowej (`sparse`, 1 plik) | 2026-09-12 | po każdej fazie wdrożenia |
| Mapa ryzyk | 2026-09-12 | gdy zapadnie decyzja o źródle przepisów — odblokuje ryzyka wokół generatora |
| Rekomendacje narzędzi | 2026-09-12 | po 3 miesiącach albo przy zmianie stosu |
