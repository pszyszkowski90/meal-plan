<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-04 — Faza 2 (czysty moduł generatora)

- **Plan**: `context/changes/first-weekly-plan/plan.md`
- **Scope**: Faza 2 z czterech (czysty moduł generatora). Faza 1 (schemat) scalona w PR #32; fazy
  3–4 jawnie poza zakresem tego PR-a.
- **Date**: 2026-09-14
- **CI run**: https://github.com/pszyszkowski90/meal-plan/actions/runs/34880202524
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 0 observations

> **Kontekst tego przebiegu.** To jest czwarty commit na gałęzi i drugi przebieg tej umiejętności
> w CI. Poprzedni przebieg (`34879232914`) zgłosił jedno ustalenie (F1 — martwa gałąź obronna
> `if (list.length === 0) { return false; }` w `findDay`). Commit `1634237` usuwa dokładnie tę
> gałąź i zapisuje niezmiennik, który ją czynił martwą, komentarzem w jej miejscu. Ten przebieg
> weryfikuje **stan po tej poprawce** od zera — pełny plan wobec pełnej różnicy PR-a — a nie tylko
> deltę względem poprzedniego raportu.
>
> **Metoda automatycznej weryfikacji.** Sandbox tego zadania odmawia `npm ci`/`npx tsc`/
> `npx expo lint`/`npm test`/`npm run check-conventions` przez Bash bez potwierdzenia, którego
> nikt w CI nie da. Zamiast zgadywać, przegląd użył **rzeczywistego wyniku** równoległego
> workflow „Bramka jakości" na TYM SAMYM commicie (run `34880202519`, job „Typy, lint, testy,
> konwencje, lockfile", **sukces**) jako dowodu: `tsc --noEmit` bez błędów, `expo lint` bez błędów,
> `npm test` → `ℹ pass 136` / `ℹ fail 0`, `check-conventions: czysto (51 plików)`,
> `check-lock: package-lock.json spójny — 1127 pakietów`. Ten sam licznik testów (136) jak przed
> poprawką potwierdza, że usunięcie gałęzi nie zmieniło zaobserwowanego zachowania — zgodne
> z tym, że gałąź była martwa.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Test Coverage | PASS |
| Success Criteria | PASS |

## Metoda

Porównanie: pełny tekst planu (Faza 2, sekcje „Krytyczne szczegóły implementacji" i cztery
niezmienniki udokumentowane przy pętli) wobec `git diff origin/main...HEAD` (5 plików), diff
commita `1634237` przeczytany w całości (`+7/-4` w `plan-generator.ts`), oraz ponowne przeczytanie
funkcji `findDay` (`plan-generator.ts:280-410`) w kontekście kroku 1 diagnozy (`:442-491`), żeby
zweryfikować niezmiennik, na który powołuje się nowy komentarz.

## Cross-reference: pliki zmienione vs. zaplanowane

| Plik | W planie fazy 2? | Werdykt |
|---|---|---|
| `src/lib/plan-generator.ts` | tak | MATCH |
| `src/lib/plan-generator.test.ts` | tak (bez zmian w tym commicie) | MATCH |
| `context/changes/first-weekly-plan/plan.md` | konwencja Progress | oczekiwane (Faza 2 odhaczona, `f6ff446`) |
| `context/changes/first-weekly-plan/reviews/impl-review.md` | konwencja przeglądu | oczekiwane (autor rozliczył F1 przed tym przebiegiem) |
| `notes/plan-queue.md` | konwencja Dziennika (`CLAUDE.md` §Dokumenty projektu) | oczekiwane |

Zero plików fazy 3/4. `git diff --stat` dla `package-lock.json` puste.

## Weryfikacja poprawki F1

Poprzedni przebieg: `if (list.length === 0) { return false; }` w `walk()` był nieosiągalny, bo
krok 1 diagnozy w `generatePlan` gwarantuje `pools[slot].length >= needed >= 1` dla każdej pory
obecnej w dniu, a `pools` nie jest mutowane w trakcie przeszukiwania.

Commit `1634237` usuwa gałąź i zostawia komentarz:

```
// Niezmiennik: `generatePlan` kończy działanie w kroku 1 diagnozy, gdy którakolwiek pora ma
// mniej dań, niż dzień potrzebuje, a `pools` nie jest mutowane w trakcie przeszukiwania
// (użycie śledzą `usedToday` i `usesLeft`, nikt nie usuwa z listy). Lista jest więc tu
// zawsze niepusta.
const list = pools[slot];
const start = offsets[position] % list.length;
```

Sprawdzone niezależnie, że usunięcie jest bezpieczne **także gdyby niezmiennik przestał
zachodzić**: przy `list.length === 0`, `start = offsets[position] % 0` daje `NaN`; obie części
zawinięcia stają się `[NaN, 0]` i `[0, NaN]` — w obu przypadkach warunek pętli `index < to` jest
fałszywy natychmiast (`NaN < 0` i `0 < NaN` to zawsze `false` w JS), więc żadna iteracja się nie
wykonuje i `walk` spada do `return false` na końcu funkcji — dokładnie ten sam wynik, jaki dawał
usunięty strażnik. Usunięcie nie wprowadza więc nowej klasy awarii nawet w scenariuszu, którego
niezmiennik miał zapobiegać.

To jest ta sama klasa poprawki, co ustalenie F11 z lokalnego przeglądu adwersaryjnego wcześniej
na tej gałęzi (`const start = list.length > 0 ? … : 0`) — usunięcie martwego strażnika i zapisanie
niezmiennika komentarzem zamiast kodem obronnym, który nigdy się nie wykona.

**Wniosek: F1 rozliczone poprawnie, bez regresji.** Zero nowych ustaleń w tym przebiegu.

## Co przegląd potwierdził jako poprawne (bez zastrzeżeń)

- **Guardrail ±10% nadal ma dwie niezależne bramki** (sprawdzenie końcowe w `walk()` i przycinanie
  obustronne, `:320-330` i `:356-364`) — niezmienione tym commitem.
- **Dyscyplina zakresu bez zastrzeżeń** — diff to jedna ukierunkowana poprawka w module fazy 2 plus
  konwencyjny wpis do Dziennika i rozliczenie ustalenia w pliku przeglądu. Zero repozytorium, tras,
  ekranów, migracji.
- **Zero regresji względem wcześniejszych ustaleń (F1–F11 lokalnego przeglądu i F1 poprzedniego
  przebiegu CI)** — wszystkie odpowiadające im fragmenty kodu nadal obecne i niezmienione poza
  samą poprawką F1.
- **Pokrycie testami niezmienione i wystarczające**: 136/136 przed i po tym commicie — spójne
  z tym, że usunięta gałąź była martwa i żadne zachowanie się nie zmieniło.

<!-- End of report -->
