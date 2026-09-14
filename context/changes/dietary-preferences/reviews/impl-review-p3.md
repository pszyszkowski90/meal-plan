# Przegląd implementacji — domknięcie S-03 (PR #20)

**Werdykt:** `ZATWIERDZONY` — 0 krytycznych, 1 ostrzeżenie, 1 obserwacja
(plus F3 i F4 dopisane przy rozliczaniu — dotyczą samej bramki, nie tej zmiany)
**Plan:** [../plan.md](../plan.md)
**Zakres:** cały PR #20 (kryteria 1.6, 2.9 i 2.10)
**Data:** 2026-09-14

| Wymiar | Werdykt |
|---|---|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | PASS |
| Architektura | PASS |
| Spójność wzorców | PASS |
| Pokrycie testami | PASS |
| Kryteria sukcesu | WARNING |

> **Dlaczego ten raport jest zacommitowany ręcznie.** Agent przeglądu wypisał go jako komentarz
> do PR-a, ale **nie zapisał jako pliku** — w jego środowisku narzędzie Bash wymagało zatwierdzenia,
> którego nikt nie mógł udzielić, więc `git commit` nie doszedł do skutku. Bramka „Sprawdź werdykt
> przeglądu" czyta PLIK, nie komentarz, więc bez tego pliku nie miała czego przeczytać i przeszła
> notką „Brak raportu". Treść poniżej jest przepisana z komentarza agenta bez zmian, a decyzje
> dopisał człowiek prowadzący zadanie. **Przyczyna jest naprawiana osobno** — patrz F3.

## F1 — `roadmap.md` twierdził, że S-03 jest zarchiwizowane, a nie było

- **Waga:** OSTRZEŻENIE
- **Wymiar:** Kryteria sukcesu
- **Miejsce:** `context/foundation/roadmap.md` — tabela „Przekazanie do backlogu"
- **Opis:** Komórka „Uwagi" dla S-03 mówiła `**Zrobione** 14.09.2026; zmiana zarchiwizowana`,
  podczas gdy `change.md` miał dalej `status: impl_reviewed` i `archived_at: null`, a folder leżał
  w `context/changes/`. PR, którego deklarowanym celem jest doprowadzenie statusów do stanu
  faktycznego, w tym jednym wierszu robił dokładnie odwrotnie: opisywał zamiar jako fakt.
- **Decyzja**: NAPRAWIONE 14.09.2026 — komórka mówi teraz `do zarchiwizowania`. Archiwizacja idzie
  osobnym PR-em świadomie: `/10x-archive` przenosi folder do `context/archive/`, a razem z nim
  **ten raport**, którego bramka pod tą ścieżką już nie znajdzie. Zrobione w jednym PR-ze
  oznaczałoby, że przegląd tej zmiany nie ma jak zadziałać.

## F2 — nowe komentarze miały wcięcie niezgodne z otoczeniem

- **Waga:** OBSERWACJA
- **Wymiar:** Spójność wzorców
- **Miejsce:** `src/app/(app)/profile.tsx`, `src/app/(app)/preferences.tsx` — blok `container`
- **Opis:** Komentarze uzasadniające wewnątrz `StyleSheet.create({ container: { … } })` miały
  wcięcie 2 spacji, podczas gdy wszystkie właściwości obiektu obok — 4. Nie łapie tego ani
  `expo lint`, ani `check-conventions`, bo reguły wcięć w tym repo nie ma.
- **Decyzja**: NAPRAWIONE 14.09.2026 — oba bloki wyrównane do 4 spacji.

## F3 — bramka werdyktu znowu meldowała sukces, nie przeczytawszy niczego

Ustalenie **dopisane przy rozliczaniu**, nie pochodzi od agenta — agent opisał objaw
(„nie mogłem uruchomić poleceń") jako własne ograniczenie, nie jako defekt bramki.

- **Waga:** OSTRZEŻENIE
- **Wymiar:** Bezpieczeństwo i jakość
- **Miejsce:** `.github/workflows/impl-review.yml` — krok „Przegląd implementacji"
- **Opis:** To jest **czwarty defekt tej samej klasy** co trzy naprawione 14.09 rano (#15, #17):
  krok „Sprawdź werdykt przeglądu" przechodzi na zielono, nie przeczytawszy żadnego werdyktu.
  Mechanizm: krok agenta nie przekazuje `claude_args`, więc agent nie ma zgody na `Bash` i nie
  wykonuje `git commit` raportu. Bramka szuka wtedy pliku raportu wśród plików PR-a, nie znajduje
  go, wypisuje notkę „Brak raportu — prawdopodobnie PR nie dotyczy żadnego planu" i kończy się
  sukcesem. Ta notka jest **prawdziwa tylko dla PR-ów bez planu**; tutaj plan był, przegląd się
  odbył i wystawił dwa ustalenia PENDING — a bramka i tak przepuściła.
- **Decyzja**: NAPRAWIONY **OBJAW**, nie przyczyna — osobnym PR-em, bo zmiana `impl-review.yml`
  wyłącza recenzenta na swoim własnym PR-ze (walidacja wobec gałęzi domyślnej), więc wciągnięcie
  jej do #20 kosztowałoby przegląd całej reszty tej pracy.

  **Co dokładnie zostało zrobione, a co nie.** Bramka rozróżnia teraz „raportu nie było, bo PR nie
  dotyczy planu" od „raport był należny i go nie ma": PR zmieniający `context/changes/*/plan.md`
  bez pliku `reviews/impl-review*.md` jest **błędem**. Logika sprawdzona lokalnie na sześciu
  przypadkach (dwa prawdziwe raporty, oba warianty `PENDING`, raport z ustaleniami bez decyzji,
  raport bez ustaleń) — kody wyjścia zgodne z oczekiwanymi.

  **Przyczyna zostaje otwarta świadomie:** agent dalej nie ma zgody na `git commit`. Naprawa
  wymagałaby `claude_args: --allowedTools …`, a ta flaga **zastępuje** domyślny zestaw narzędzi,
  nie dodaje do niego — więc może odebrać agentowi narzędzia MCP, którymi wystawia komentarz
  i etykiety. Nie da się tego sprawdzić na PR-ze, który tę zmianę wprowadza, bo recenzent jest
  na nim wyłączony. Zgadywanie konfiguracji kroku CI z prawem zapisu do repozytorium, bez
  możliwości zweryfikowania skutku, kosztuje więcej niż daje. **Praktyczny skutek do czasu
  naprawy:** raport do PR-a zmieniającego plan commituje prowadzący zadanie — tak jak ten.

## F4 — bramka nie widzi ustalenia zapisanego w prawdopodobnym wariancie formatu

Ustalenie **znalezione przy rozliczaniu tego właśnie raportu**, na nim samym.

- **Waga:** OSTRZEŻENIE
- **Wymiar:** Bezpieczeństwo i jakość
- **Miejsce:** `.github/workflows/impl-review.yml` — krok „Sprawdź werdykt przeglądu"
- **Opis:** Bramka szuka pola wyrażeniem `^- [*][*](Decision|Decyzja)[*][*]:`, czyli wymaga
  **dwukropka poza pogrubieniem** (`- **Decyzja**: …`). Pierwsza wersja tego raportu miała
  `- **Decyzja:** …` — dwukropek wewnątrz — i bramka policzyła **zero** ustaleń: zero
  rozliczonych i zero otwartych. Werdykt był tu zatwierdzający, więc przebieg i tak byłby
  zielony, ale przy werdykcie odrzucającym **każde `PENDING` zapisane w tym wariancie byłoby
  dla bramki niewidoczne**. Format nie jest nigdzie udokumentowany poza samym wyrażeniem
  regularnym, a oba zapisy renderują się w Markdownie identycznie — więc to nie jest literówka
  do wytknięcia autorowi, tylko bramka wymagająca niewidocznej konwencji.
- **Decyzja**: NAPRAWIONE 14.09.2026 w tym raporcie (pola doprowadzone do formatu, którego bramka
  szuka), a **przyczyna naprawiana osobnym PR-em razem z F3**: wyrażenie ma przyjmować oba
  warianty, a raport z zerem pól decyzji ma być błędem, nie cichą zgodą. Raport bez ani jednego
  pola `Decyzja` znaczy dziś dokładnie to samo, co raport ze wszystkim rozliczonym — a to jest ta
  sama cicha zgoda, którą ta bramka miała zlikwidować.

## Uwaga agenta o weryfikacji

Agent nie mógł samodzielnie uruchomić `npm test`, `npx tsc --noEmit`, `npx expo lint` ani
`npm run check-conventions` — z tego samego powodu co w F3. Oparł się na czytaniu diffu i na
zalogowanej weryfikacji z PR-a (44/44 E2E, 100/100 jednostkowych, czyste `tsc`/lint/konwencje,
`wrangler deploy --dry-run` 15 modułów). Bramka „Typy, lint, testy, konwencje, lockfile"
uruchomiła te narzędzia niezależnie i przeszła — to ona jest tu dowodem, nie przegląd.
