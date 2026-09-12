<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Konto e-mail + hasło i granica danych użytkownika (v2)

- **Plan**: `context/changes/account-and-login/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-09-01
- **Werdykt**: DO POPRAWY → SOLIDNY (po zastosowaniu wszystkich ośmiu poprawek, plan v2.1)
- **Ustalenia**: 2 krytyczne, 4 ostrzeżenia, 2 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność ze stanem końcowym | ZALICZONY (po poprawce F3) |
| Oszczędne wykonanie | ZALICZONY |
| Dopasowanie architektoniczne | ZALICZONY |
| Martwe punkty | ZALICZONY (po poprawkach F1, F5, F6) |
| Kompletność planu | ZALICZONY (po poprawkach F2, F4, F7, F8) |

## Ugruntowanie

11/11 ścieżek ✓ (jedno twierdzenie o treści pliku fałszywe → F4), 6/6 symboli ✓ (jeden typ za
wąski dla kontraktu → F2), brief↔plan ✓, Progress↔Faza mechanicznie ✓ (jeden `## Progress` na dole
po `## Referencje`, 4 nagłówki faz ↔ 4 bloki Progress, 34 kryteria ↔ 34 pozycje `- [ ]`, zero pól
wyboru poza sekcją Progress), roadmap S-01 ↔ plan ✓.

Sprawdzone ścieżki: `src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/explore.tsx`,
`src/app/api/health+api.ts`, `src/server/env.ts`, `src/components/app-tabs.tsx`,
`src/components/app-tabs.web.tsx`, `src/components/ui/` (tylko `collapsible.tsx`, jak twierdzi
plan), `.gitignore`, `package.json`, `app.json`. Katalog `migrations/` nie istnieje — zgodnie
z planem. Sprawdzone symbole: `getWorkerEnv`, `WorkerEnv.DB`, `NativeTabs.Trigger name="index"`,
`TabTrigger href="/"`, `web.output: "server"`, `typedRoutes` / `reactCompiler`.

## Ustalenia

### F1 — Auto-deploy z `main` publikuje każdą fazę, ale warunki produkcji są w fazie 4

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: „Podejście do implementacji” + Faza 4, kroki 1 i 2
- **Szczegóły**: Plan uzasadnia kolejność faz zdaniem „fazy 1–2 nie ruszają schematu D1, więc
  auto-deploy z `main` nie może wystawić na produkcję kodu odwołującego się do nieistniejących
  tabel”. Rozumowanie obejmuje wyłącznie D1 i pomija dwa inne warunki, które plan sam umieszcza
  dopiero w fazie 4.
  **(a)** `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` w Workers Builds to krok 1 fazy 4.
  `deploy-plan.md:221` potwierdza: „Push na `main` → build → wdrożenie, bez udziału człowieka”,
  build command `npx expo export -p web`. Ten sam dokument (`deploy-plan.md:299`) mówi wprost:
  zmienna „ustawiona wyłącznie lokalnie da działający `wrangler dev` i martwą produkcję”. Od
  wypchnięcia fazy 1 produkcja jest martwa przez trzy fazy.
  **(b)** `npx wrangler d1 migrations apply mealplan --remote` to krok 2 fazy 4, ale
  `/api/account` powstaje w fazie 3. Wypchnięcie fazy 3 wystawia trasę czytającą `app_user`,
  zanim tabela istnieje zdalnie — wprost przeciw regule z „Krytycznych szczegółów implementacji”:
  „Migracja D1 idzie przed wdrożeniem kodu, który jej używa”.
- **Poprawka A ⭐ Zalecana**: Przenieś warunki produkcyjne przed fazę, która od nich zależy —
  zmienna buildu jako krok 0 fazy 1, `migrations apply --remote` jako pierwszy krok fazy 3; faza 4
  zostaje przebiegiem i `CLAUDE.md`.
  - Siła: `main` pozostaje wdrażalny po każdym commicie — a to jedyny tryb pracy, jaki repo ma
    (Workers Builds, bez GitHub Actions).
  - Kompromis: Migracja zdalna ląduje przed kodem, który jej używa — nieszkodliwe, bo jest
    addytywna, a tabela do fazy 3 nie ma czytelnika.
  - Pewność: WYSOKA — obie zależności są udokumentowane w `deploy-plan.md`, nie wywnioskowane.
  - Martwy punkt: Nie sprawdzono, czy Workers Builds wymaga ponownego builda po samej zmianie
    zmiennej środowiskowej, czy dopiero po commicie.
- **Poprawka B**: Prowadź całą zmianę na gałęzi roboczej, scal dopiero po fazie 4.
  - Siła: Produkcja nigdy nie widzi stanu pośredniego; jedno wdrożenie.
  - Kompromis: Kasuje kryteria „na produkcji” z faz 1–3 i wymaga dyscypliny gałęzi, o której plan
    nic nie mówi, a `/10x-implement` commituje na bieżącej gałęzi.
  - Pewność: ŚREDNIA — działa, ale zmienia sposób weryfikacji trzech faz.
  - Martwy punkt: Nie ustalono, jak wtedy zdobyć token produkcyjny do fazy 3.
- **Decyzja**: NAPRAWIONE — Poprawka A (warunki produkcyjne przeniesione: zmienna buildu → faza 1 krok 3, migracja `--remote` → faza 3 krok 4; faza 4 tylko sprawdza)

### F2 — Typ `D1Database` w `env.ts` nie wyraża zapytań, które pisze repozytorium

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 3, krok 2 vs. krok 5
- **Szczegóły**: Krok 2 mówi: „`WorkerEnv` zyskuje `CLERK_JWT_KEY: string`. **Nic więcej w tym
  pliku się nie zmienia**”. Krok 5 wymaga `DB.prepare(...).bind(...)` oraz `INSERT … ON CONFLICT
  DO UPDATE`. Tymczasem `src/server/env.ts:16-22` deklaruje ręcznie okrojony typ:
  `D1PreparedStatement` ma wyłącznie `first<T>()`, bez `bind()`, `run()` i `all()`. `touchAppUser`
  nie skompiluje się — a kryterium 3.1 („`npx tsc --noEmit` czyste”) jest bramką tej samej fazy.
- **Poprawka**: W kroku 2 dopisz rozszerzenie `D1PreparedStatement` o
  `bind(...values: unknown[]): D1PreparedStatement` i `run(): Promise<unknown>`, i usuń zdanie
  „Nic więcej w tym pliku się nie zmienia”. Komentarz na górze pliku zostaje nietknięty — opisuje
  mechanizm `globalThis`, nie typy.
- **Decyzja**: NAPRAWIONE (`D1PreparedStatement` zyskuje `bind()` i `run()`; usunięte zdanie „nic więcej się nie zmienia")

### F3 — Kontrakt transportu tokenu jest opisany, ale żadna faza go nie buduje

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Zgodność ze stanem końcowym
- **Lokalizacja**: „Krytyczne szczegóły implementacji” + Faza 3 + kryterium 4.8
- **Szczegóły**: Plan poświęca dwa akapity klientowi: „Transport tokenu jest jednolity… oba
  wysyłają `Authorization: Bearer` z `getToken()`” oraz „`getToken()` rzuca, gdy nie ma sieci…
  nie wolno mylić offline z wylogowanym **w kodzie odpytującym API**”. Żadna faza nie tworzy tego
  kodu: fazy 1–2 to ekrany Clerka (nie dotykają Workera), faza 3 to strona serwerowa, faza 4 to
  wdrożenie. Kryteria 3.5–3.7 i 4.4 ćwiczą `/api/account` `curl`-em z ręcznie skopiowanym tokenem.
  Skutki: kryterium 4.8 („`wrangler tail` pokazuje żądania `/api/account` z produkcji”) nie ma
  źródła ruchu poza ręcznym `curl`-em; a `CLAUDE.md` **już dziś** twierdzi „klient wysyła token
  nagłówkiem `Authorization: Bearer` na obu platformach” — reguła bez implementacji. S-02 wymyśli
  ten kontrakt od zera, czyli dokładnie to, czemu ta zmiana miała zapobiec jako fundament.
- **Poprawka A ⭐ Zalecana**: Dołóż do fazy 3 cienki helper klienta (`authedFetch(path)`:
  `getToken()` → `Bearer` → rozróżnienie `ClerkOfflineError` od wylogowania) i jedno wywołanie
  z `(app)/index.tsx`.
  - Siła: Czyni 4.8 realnym, daje akapitowi o offline miejsce lądowania i zostawia S-02 wzorzec
    do skopiowania — symetrycznie do `src/server/repository/` po stronie serwera.
  - Kompromis: ~30 linii ponad minimum i jeden element więcej na ekranie startera.
  - Pewność: WYSOKA — plan sam nazywa ten kontrakt dwa razy; brakuje tylko pliku.
  - Martwy punkt: Nie sprawdzono, czy `ClerkOfflineError` da się zaimportować
    z `@clerk/react/errors` bez ostrzeżenia Metro na native.
- **Poprawka B**: Wypchnij transport klienta poza zakres — usuń oba akapity z „Krytycznych
  szczegółów”, przeredaguj 4.8 na `curl` przeciw produkcji, wycofaj zdanie o `Bearer`
  z `CLAUDE.md` do czasu S-02.
  - Siła: Najmniejsza możliwa zmiana; zakres pozostaje ściśle „granica danych”.
  - Kompromis: Reguły przestają opisywać nieistniejący kod, ale decyzja fundamentu przenosi się
    do fragmentu, który fundamentem nie jest.
  - Pewność: ŚREDNIA.
  - Martwy punkt: Nie oceniono, ile S-02 na tym straci.
- **Decyzja**: NAPRAWIONE — Poprawka A (faza 3 krok 7: `src/lib/api.ts` + wywołanie z `(app)/index.tsx`)

### F4 — Analiza bieżącego stanu twierdzi coś nieprawdziwego o `.gitignore`

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: „Analiza bieżącego stanu” + Faza 1, krok 2 + Progress 1.5
- **Szczegóły**: Plan pisze wytłuszczonym: „**`.gitignore` nie zawiera `.dev.vars` ani
  `.wrangler/`**”. Plik zawiera oba, plus `.wrangler-dry/` (`.gitignore:36-39`) — wpisy weszły
  31.08 wraz z wdrożeniem. To ślad po wersji 1 planu, nieodświeżony przy przepisaniu na Clerka.
  Krok 2 fazy 1 jest martwą robotą, a Progress 1.5 startuje jako spełniony, co maskuje realny
  warunek „sprawdzone przed pierwszym sekretem”.
- **Poprawka**: Popraw zdanie w analizie na „`.gitignore` już obejmuje `.dev.vars`, `.wrangler/`
  i `.wrangler-dry/`”, usuń krok 2 z fazy 1, a Progress 1.5 przeformułuj na weryfikację
  (`git check-ignore .dev.vars`) zamiast na edycję.
- **Decyzja**: NAPRAWIONE (analiza poprawiona, krok 2 fazy 1 usunięty, kryterium zmienione na `git check-ignore`)

### F5 — `authorizedParties` nie jest wyliczone, a plan sankcjonuje trzeci origin

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 3, krok 3
- **Szczegóły**: Kontrakt mówi tylko: „`authorizedParties` obejmuje adres produkcyjny Workera
  i adres `wrangler dev`” — bez konkretnych wartości. Tymczasem sam plan dopuszcza trzecie źródło
  tokenu: „`npx expo start --web` jest dopuszczalne wyłącznie do ćwiczenia przepływów Clerka”,
  a kryterium 3.10 wymaga, by token pochodził „z działającej aplikacji z fazy 1”. Token wzięty
  z `expo start --web` (`localhost:8081`) uderzy w `wrangler dev` (`localhost:8787`)
  z niepasującym `azp` i wróci 401 — nieodróżnialne od zepsutej weryfikacji. Osobno: plan nigdzie
  nie mówi, co ma się dziać z tokenami z Expo Go, które nie mają originu przeglądarki.
- **Poprawka**: Wypisz w kontrakcie dokładne wartości (adres produkcyjny Workera,
  `http://localhost:8787`, `http://localhost:8081`) i dodaj jedno zdanie o zachowaniu dla tokenów
  bez `azp` (native) — do potwierdzenia w fazie 3, a nie do odkrycia jako 401.
- **Decyzja**: NAPRAWIONE (trzy origins wyliczone wprost + kryterium 3.9 na token bez `azp`)

### F6 — Ryzyko bundlowania nazwane tylko dla fazy 3; faza 1 ma to samo ryzyko bez odwrotu

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: „Otwarte ryzyka i założenia” + Faza 1, kroki 5–10
- **Szczegóły**: Rejestr ryzyk wymienia jeden przypadek: „`@clerk/backend` w bundlu Metro jest
  niesprawdzony… ze ścieżką odwrotu (`jose`)”. `app.json` ma `web.output: "server"`, więc
  `expo export -p web` prerenderuje trasy w Node — z `ClerkProvider` i `tokenCache`
  z `expo-secure-store` w drzewie od kroku 5 fazy 1. To ta sama klasa ryzyka („ciężka biblioteka
  auth bundlowana przez Metro”), która wywróciła wersję 1 planu, tylko wcześniej i bez nazwanej
  ścieżki odwrotu. Kolejność kroków fazy 1 sprawia, że wyjdzie to dopiero na kryterium 1.4 — po
  napisaniu trzech ekranów i prymitywu pola.
- **Poprawka**: Rozbij fazę 1 na tanią bramkę: po kroku 5 (`ClerkProvider`) i przed krokami 8–10
  wstaw pojedyncze `npx expo export -p web` jako punkt kontrolny, i dopisz to ryzyko do „Otwartych
  ryzyk” z jawnym stwierdzeniem, że niepowodzenie jest blokerem do eskalacji, a nie do łatania
  w locie.
- **Decyzja**: NAPRAWIONE (faza 1 krok 5: bramka `expo export` po `ClerkProvider`; ryzyko dopisane do rejestru)

### F7 — „Stan neutralny” nigdy nie został zdefiniowany, a kryterium 1.8 na nim stoi

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1, krok 7 + Progress 1.8
- **Szczegóły**: Kontrakt `(app)/_layout.tsx` mówi „przy `!isLoaded` renderuje stan neutralny”
  i nie mówi czym on jest. To ma znaczenie, bo `AnimatedSplashOverlay` woła `hideAsync()`
  w `onLayout` (`src/app/_layout.tsx:14`), czyli zanim Clerk się załaduje — użytkownik faktycznie
  zobaczy „stan neutralny”, a nie splash. Kryterium 1.8 („zakładki nie migają ani przez moment”)
  ocenia dokładnie ten kadr.
- **Poprawka**: Dopisz w kontrakcie, co renderuje `!isLoaded` (np. `ThemedView` na pełny ekran
  w kolorze tła) i czy nakładka splash ma zostać zamontowana do `isLoaded`.
- **Decyzja**: NAPRAWIONE (stan neutralny = `ThemedView type="background"`, z uzasadnieniem względem splasha)

### F8 — Nagłówki Progress są polskie, a `/10x-implement` szuka angielskich

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: `## Progress` (plan.md:611-672)
- **Szczegóły**: Kontrakt mechaniczny przechodzi w całości (jeden `## Progress` na dole po
  `## Referencje`, 4↔4 fazy, 34↔34 pozycje, zero pól wyboru poza sekcją). Rozjazd jest nominalny:
  plan pisze `## Faza N:` / `### Faza N:` / `#### Automatyczne` / `#### Ręczne`, a
  `.claude/skills/10x-implement/SKILL.md` odwołuje się do `## Phase N:` (l. 55), `### Phase N:`
  (l. 59, 164, 294) i `#### Manual` (l. 164 — reguła podsumowania międzyfazowego). Osobno:
  przypis Progress linkuje `references/progress-format.md` ścieżką względną, która rozwiązuje się
  do folderu zmiany; plik leży w `.claude/skills/10x-plan/references/`.
- **Poprawka**: Zmień nagłówki na `## Phase N: <polski tytuł>` / `### Phase N: <ten sam tytuł>` /
  `#### Automated` / `#### Manual` (tytuły zostają po polsku, klucze parsowania po angielsku)
  i popraw link na `.claude/skills/10x-plan/references/progress-format.md`.
- **Decyzja**: NAPRAWIONE (`## Phase N:` / `### Phase N:` / `#### Automated` / `#### Manual`, link do reference naprawiony)

## Sortowanie — podsumowanie (2026-09-01)

- **Naprawione**: F1 (Poprawka A), F2, F3 (Poprawka A), F4, F5, F6, F7, F8 — wszystkie osiem.
- **Pominięte / zaakceptowane / odrzucone**: brak.
- **Werdykt po poprawkach**: SOLIDNY. Plan oznaczony jako wersja 2.1; `plan-brief.md`
  zaktualizowany dla spójności (tabela faz, wymagania wstępne, zakres, rejestr ryzyk, diagram).
- **Kontrakt Progress przeliczony po zmianach**: 4 fazy body ↔ 4 bloki Progress (nazwy zgodne),
  39 kryteriów ↔ 39 pozycji `- [ ]` (F1 5+6, F2 2+3, F3 10+3, F4 5+5), zero pól wyboru poza
  sekcją Progress, jeden nagłówek `## Progress` na dole.
