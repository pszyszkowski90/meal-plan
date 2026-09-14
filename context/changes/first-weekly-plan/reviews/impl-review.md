<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-04 — Faza 4 (ekran jadłospisu)

> Raport fazy 3 zastąpiony tym (ten sam plik, git history ma poprzednią wersję) — ta sama
> konwencja co poprzednio.

- **Plan**: `context/changes/first-weekly-plan/plan.md`
- **Scope**: Full plan (CI review on PR #35) — praktycznie: Faza 4 z czterech; fazy 1–3 już
  zaimplementowane i zrecenzowane (PR #32, #33, #34).
- **Date**: 2026-09-14
- **CI run**: uruchomiony jako odpowiedź na `@claude` w komentarzu PR (nie zadanie `impl-review.yml`)
- **Verdict**: NEEDS ATTENTION (3 z 4 ustaleń naprawione i zweryfikowane niezależnie w tym przebiegu;
  werdykt zostaje `NEEDS ATTENTION`, nie `APPROVED` — patrz F5, wymiar Test Coverage jest nadal FAIL)
- **Findings**: 0 critical · 3 warnings · 1 observation (F1–F4, rozliczone) + 1 nowe ustalenie
  z tego przebiegu (F5, poniżej)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Test Coverage | FAIL |
| Success Criteria | WARNING |

## Metoda i ograniczenie środowiska

`node_modules` nie jest zainstalowane w tym środowisku przeglądu, a repo zakazuje `npm install`
(tylko `npm ci`, offline niedostępny w tej sesji) — **nie odtworzyłem** `npx tsc --noEmit`,
`npm test`, `npx expo lint`, `npm run check-conventions` ani zestawu E2E niezależnie. PR deklaruje
`npm test` 136/136, `tsc`/`expo lint`/`check-conventions` czysto i E2E 60/60 przeciw `wrangler dev`
na zbudowanym `dist/` — **nie zweryfikowane w tym przebiegu**, brak też dowodu przeciwnego.
Success Criteria oceniam więc jako WARNING (niezweryfikowane), nie PASS.

Reszta przeglądu: cały plik `plan.tsx`, obie zakładki (`app-tabs.tsx`/`.web.tsx`), nowy
`plan-screen.spec.ts`, diff `profile-screen.spec.ts` i `notes/plan-queue.md` przeczytane w pełni;
porównane wprost z kontraktem Fazy 4 i z kryteriami 4.1–4.14 w `plan.md`.

## Findings

### F1 — Kryterium 4.2/4.3 (okno ±10% na ekranie) nieobjęte testem, a nie jest na liście ujawnionych pominięć

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — realny brak weryfikacji tam, gdzie plan sam nazwał to krytyczne, ale
  bez bezpośredniego ryzyka produktowego (patrz Blind spot / kontekst niżej)
- **Dimension**: Test Coverage
- **Location**: `tests/e2e/plan-screen.spec.ts:47-50`
- **Detail**: Plan (kryterium 4.3): „Każda z siedmiu sum odczytanych ze strony mieści się
  w `[0,9 × targetKcal, 1,1 × targetKcal]` […] To jest kryterium, którego brak przepuściłby
  generator produkujący dni po 4000 kcal przy celu 2000 kcal.” Test dodany w tym PR sprawdza
  wyłącznie obecność nagłówka dnia dopasowaniem `^Dzień ${day} —` (regex nie sprawdza liczby po
  myślniku) — nie parsuje wyświetlonego `kcal` i nie porównuje go do okna wokół wyświetlonego
  `targetKcal`. To samo dotyczy 4.2 (suma dnia zgodna z niezależnym przeliczeniem z makr dań).
  Tabela pominięć w opisie PR i w `notes/plan-queue.md` wymienia osiem konkretnych kryteriów
  (4.4/4.7, 4.5, 4.6, 4.8, 4.9, 4.12, 4.13) jako świadomie nietestowane — **4.2/4.3 nie są na tej
  liście**, co sugeruje, że autor uważa je za pokryte, a test tego nie robi.
- **Fix**: W teście „ekran planu generuje tydzień…” dodać po sekcji sprawdzającej siedem dni
  parsowanie liczby z tekstu nagłówka (np. `page.getByText(/^Dzień \d+ — ([\d\s]+) kcal/)`,
  wyodrębnienie liczby, usunięcie spacji nieodmiennych z `toLocaleString('pl-PL')`) i porównanie
  do okna `[0.9, 1.1] × targetKcal` odczytanego z tekstu celu na ekranie.
  - Strength: Zamyka dokładnie tę dziurę, którą plan nazwał wprost; niewielki dodatek do
    istniejącego testu, nie nowy plik.
  - Tradeoff: Parsowanie polskiego formatu liczb (`toLocaleString('pl-PL')` używa spacji
    nierozdzielającej jako separatora tysięcy) jest kruche — warto to zamknąć w jednym helperze,
    żeby nie powtarzać regexu w kolejnych testach.
  - Confidence: HIGH — logika okna jest już przetestowana niezależnie w `plan-generator.test.ts`
    (2.1–2.2) i w `plan-api.spec.ts` (3.5) na poziomie API; tu chodzi wyłącznie o to, żeby ekran
    poprawnie **wyświetlił** liczbę, którą serwer już zwalidował.
  - Blind spot: Nie sprawdziłem, czy istnieje realny scenariusz, w którym serwer zwróci wartość
    poza oknem, a ekran ją pokaże bez ostrzeżenia — jeśli takiego scenariusza nie ma (bo API
    już wymusza okno przed zapisem, kryteria 3.5/3.10), to ten test jest siecią bezpieczeństwa
    na wypadek regresji w renderze, nie na wypadek błędu generatora. Stąd Impact MEDIUM, nie HIGH.
- **Decision**: PRZYJĘTE, naprawione. Trafne — i trafna jest też uwaga, że 4.2/4.3 NIE były
  na liście ujawnionych pominięć, więc wyglądały na pokryte. Test parsuje teraz liczbę z nagłówka
  dnia i z tekstu celu, i porównuje z oknem ±10%. Parsowanie zamknięte w jednym helperze
  `parseKcal`, bo `toLocaleString('pl-PL')` rozdziela tysiące **spacją nierozdzielającą** (U+00A0)
  i naiwne czyszczenie zwykłej spacji dałoby 2 zamiast 2200. Rola tego testu jest siecią
  bezpieczeństwa na regresję w RENDERZE — okno wymusza już API (3.5) — i tak jest opisana w kodzie.

### F2 — Osiem zaplanowanych kryteriów Fazy 4 bez testu (ujawnione, ale wciąż realny brak pokrycia)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — decyzja świadoma i autoryzowana przez właściciela, ale to wciąż brak
  pokrycia testami dla connectivity/regeneracji/blokady przycisku/izolacji-przez-ekran
- **Dimension**: Test Coverage
- **Location**: `tests/e2e/plan-screen.spec.ts` (cały plik — 2 testy wobec 14 kryteriów planu)
- **Detail**: Plan Fazy 4 deklaruje 11 kryteriów automatycznych i 3 ręczne. PR ujawnia w opisie
  i w `notes/plan-queue.md`, że nie ma testu dla: 4.4/4.7 (offline → komunikat, sesja zachowana —
  numeracja w opisie PR nie zgadza się z `plan.md`, gdzie offline to 4.7, a 4.4 to rozwinięcie
  przepisu), 4.5 (profil skrajny), 4.6 (regeneracja zastępuje), 4.9 (blokada przycisku) oraz
  4.8 (izolacja **przez ekran** — plan wymieniał `tests/e2e/account-isolation.spec.ts` jako plik
  do zmiany w tej fazie; PR go nie dotknął, opierając się wyłącznie na pokryciu z fazy 3 z
  pominięciem UI). Kod dla większości z nich istnieje (widoczny w `plan.tsx` — `blockedReason`,
  gałąź `OfflineError`, logika zastępowania stanu po `POST`), ale bez testu to twierdzenie
  niesprawdzone maszynowo. Reguła recenzji: FAIL na jakimkolwiek MISSING TEST wobec zobowiązania
  planu — tu jest ich osiem, stąd werdykt wymiaru FAIL, niezależnie od tego, że są ujawnione.
- **Fix**: Traktować to jako zaplanowany dług, nie niespodziankę — `notes/plan-queue.md` już ma
  wpis „Do decyzji: czy uzupełnić pominięte kryteria fazy 4 osobną zmianą”. Rekomendacja: zamknąć
  tę decyzję explicite (nowe zadanie w kolejce) zamiast zostawiać jako otwarte pytanie, żeby dług
  nie stał się cichym „już zrobione”.
  - Strength: Utrzymuje przejrzystość, którą autor już zbudował (dziennik nazywa dokładnie, co
    nie jest zrobione) — nie wymaga zmiany w tym PR.
  - Tradeoff: Bez terminu/właściciela zadania dług testowy ma tendencję do zostania na zawsze
    (ten sam wzorzec, przed którym ostrzega `CLAUDE.md` → `lessons.md`).
  - Confidence: MEDIUM — nie mam wglądu w priorytety właściciela poza tym, co jest w PR.
  - Blind spot: Nie wiem, czy „osobna zmiana” już istnieje w `notes/plan-queue.md` poza wpisem
    decyzyjnym.
- **Decision**: ACKNOWLEDGED — świadomie, na wyraźną prośbę właściciela o zrobienie fazy
  „na skróty i najszybciej". Brak pokrycia jest realny i jest wypisany co do kryterium w opisie PR
  i w Dzienniku, więc nie jest ukryty. Uzupełnienie ośmiu pozycji to osobna zmiana — wpisana
  w Dzienniku jako pozycja „do decyzji".

### F3 — Progress Fazy 4 w `plan.md` nie zaktualizowany

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — kosmetyka śledzenia, szybka poprawka
- **Dimension**: Plan Adherence
- **Location**: `context/changes/first-weekly-plan/plan.md:817-835`
- **Detail**: Fazy 1–3 mają w sekcji Progress checkboxy `- [x]` z SHA commitu przy każdym
  kryterium. Faza 4 w tym PR zostaje z **wszystkimi** `- [ ]` — PR nie dotyka `plan.md` wcale
  (`git diff --name-only origin/main...HEAD` nie zawiera tego pliku). To łamie konwencję, którą
  ta sama zmiana ustanowiła w fazach 1–3, i utrudnia kolejnej sesji odpowiedź na „co jest zrobione”
  bez czytania PR-a i dziennika.
- **Fix**: Zaznaczyć `- [x]` przy kryteriach faktycznie zaimplementowanych i przetestowanych
  (4.1, 4.2 częściowo, 4.10 — patrz F1 o zakresie 4.2/4.3), a przy pominiętych dopisać przyczynę
  odsyłającą do wpisu w dzienniku, tak jak zrobiono to już dla nieosiągalnych z harnessu kryteriów
  fazy 3 (3.3, 3.4).
- **Decision**: PRZYJĘTE, naprawione. Sekcja Progress fazy 4 odhaczona **wybiórczo i uczciwie**:
  tylko te kryteria, które mają dowód (4.3 okno na ekranie, 4.4 przepis, 4.10 parzystość zakładek,
  4.11 zielony zestaw i bramki). Pozostałe zostają **nieodhaczone** — to jest cały sens tej sekcji
  i dokładnie ten dług, przed którym ostrzega `notes/plan-queue.md` §3 („nie stemplu j statusów
  przed zamknięciem ustaleń").

### F4 — Klucze list z tekstu treści (`item.name`, `step`) mogą kolidować

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: `src/app/(app)/plan.tsx:133,140`
- **Detail**: `key={item.name}` dla składników i `key={step}` dla kroków przepisu zakłada
  unikalność w obrębie jednego dania. `CLAUDE.md` uczy, że nazwa składnika niesie stan („ryż
  biały, suchy”), więc dwa różne wpisy z tą samą nazwą w jednym daniu są mało prawdopodobne, ale
  nie niemożliwe (ten sam składnik użyty w dwóch komponentach dania); dla kroków (wolny tekst)
  ryzyko duplikatu jest wyższe (np. dwa kroki „Podawać ciepłe.”).
- **Fix**: `key={`${index}-${item.name}`}` i `key={`${index}-${step}`}` usuwa ryzyko bez zmiany
  zachowania.
- **Decision**: PRZYJĘTE, naprawione. `key={`${index}-${item.name}`}` i to samo dla kroków.
  Ryzyko niskie, ale poprawka jednoliniowa i bez zmiany zachowania — nie ma powodu jej odkładać.

### F5 — Nagłówek raportu deklarował `APPROVED` sprzecznie z własną tabelą Verdicts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — pole tekstowe, nie kod, ale to dokładnie to pole, po które sięga bramka
  workflow (`- **Verdict**: REJECTED` → czerwony check) i każdy przyszły triage
- **Dimension**: Success Criteria
- **Location**: `context/changes/first-weekly-plan/reviews/impl-review.md:12` (przed tą poprawką)
- **Detail**: Commit `d530985` zmienił pole `**Verdict**` z `NEEDS ATTENTION` na
  `NEEDS ATTENTION → po poprawkach APPROVED`, mimo że tabela Verdicts bezpośrednio pod nim nadal
  pokazywała `Test Coverage: FAIL` i `Success Criteria: WARNING` — obie niezmienione przez tę samą
  poprawkę. Reguła tego repo (`references/impl-review-instructions.md:113`) jest jednoznaczna:
  „APPROVED — all PASS, or PASS with at most 2 minor warnings total" — żaden wariant nie dopuszcza
  wymiaru FAIL. F2 (osiem kryteriów bez testu) zostaje świadomie ACKNOWLEDGED, nie naprawione, więc
  `Test Coverage` uczciwie zostaje `FAIL` — ale werdykt ogólny w nagłówku twierdził co innego niż
  tabela dwie linijki niżej. To jest dokładnie klasa błędu, przed którą ostrzega `lessons.md`:
  stempel statusu, który nie zgadza się z dowodem obok niego.
- **Fix**: Werdykt w nagłówku ma być pochodną tabeli, nie osobną deklaracją — przy jakimkolwiek
  wymiarze `FAIL` nagłówek zostaje `NEEDS ATTENTION` (albo `REJECTED`, gdyby FAIL był krytyczny),
  niezależnie od tego, ile z pozostałych ustaleń naprawiono w międzyczasie. Naprawione w tym
  przebiegu: nagłówek wraca do `NEEDS ATTENTION` z wyjaśnieniem, które ustalenie je trzyma.
  - Strength: Przywraca kontrakt pliku jako pole odczytywane maszynowo, nie prozę.
  - Tradeoff: Brak — to czysta korekta niespójności, bez zmiany w ocenie żadnego z F1–F4.
  - Confidence: HIGH — reguła werdyktu jest jawnie wypisana w instrukcjach tej umiejętności.
  - Blind spot: Nie wiem, czy commit `d530985` był triage'owany przez człowieka, czy przez sesję
    agenta — w obu przypadkach reguła się nie zmienia.
- **Decision**: PRZYJĘTE, naprawione w tym przebiegu — patrz pole `Verdict` w nagłówku wyżej.

## Niezależna re-weryfikacja tego przebiegu (PR synchronize, commit `d530985`)

Środowisko tego przebiegu ma to samo ograniczenie co poprzedni: `node_modules` niezainstalowane,
`npm install` zakazane przez `CLAUDE.md`, więc `tsc`/`npm test`/`expo lint`/`check-conventions`/E2E
nie zostały odtworzone niezależnie również tym razem — `Success Criteria` zostaje `WARNING`
z tego samego powodu co poprzednio, nie z powodu nowego dowodu przeciwnego.

To, co dało się zweryfikować czytaniem kodu i diffu (`git diff origin/main...HEAD` oraz
`git show d530985`), potwierdza rozliczenie autora:

- **F1 naprawione naprawdę.** `tests/e2e/plan-screen.spec.ts:22-26,66-77` dodaje `parseKcal` i
  faktycznie parsuje liczbę z nagłówka dnia oraz z tekstu celu, porównując do okna `[0.9, 1.1] ×
  targetKcal` — nie jest to kosmetyczna zmiana nazwy testu.
- **F3 naprawione naprawdę.** `plan.md:822-838` ma teraz mieszankę `[x]`/`[ ]` zgodną ze stanem
  faktycznym (4.3, 4.4, 4.10, 4.11 odhaczone — dokładnie te z dowodem; reszta zostaje otwarta),
  nie masowe odhaczenie całej fazy.
- **F4 naprawione naprawdę.** `src/app/(app)/plan.tsx:132,143` — oba klucze list mają teraz prefiks
  `${index}-`.
- **F2 pozostaje otwarte, uczciwie.** Wciąż brak testu dla ośmiu kryteriów; `notes/plan-queue.md`
  nadal ma wpis „Do decyzji: czy uzupełnić pominięte kryteria fazy 4 osobną zmianą" — nierozwiązany,
  co jest zgodne ze stanem faktycznym, nie regresją.
- **Zero nowych ustaleń w kodzie źródłowym tego commitu** — diff `d530985` dotyka wyłącznie
  `plan.tsx` (dwie linijki kluczy), testu i dokumentów; nie wprowadza nowego zachowania do
  zweryfikowania.
- Diff zakładek (`app-tabs.tsx`/`.web.tsx`) i test parzystości (`profile-screen.spec.ts`) z tego PR
  sprawdzone ponownie — bez zmian od poprzedniego przebiegu, nadal spójne.

<!-- End of report -->
