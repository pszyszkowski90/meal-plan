---
change_id: dietary-preferences
title: Preferencje żywieniowe — wykluczenia, czas przygotowania, liczba posiłków
status: planned
created: 2026-09-13
updated: 2026-09-13
archived_at: null
---

## Notes

- Element mapy drogowej: **S-03** (`context/foundation/roadmap.md`), kamień M-01.
- Odnośniki PRD: FR-004, FR-006, FR-007; Open Question 4.
- Odblokowuje: S-04 (generator potrzebuje wykluczeń, limitu czasu i liczby posiłków),
  S-05 (oznaczanie dań z planu zasila **tę samą** listę wykluczeń).
- **Niewiadoma blokująca zdjęta 13.09.2026**: model wykluczeń rozstrzygnięty w decyzji D14
  (`notes/night-decisions.md`) i rozpisany w
  `context/changes/dish-source-and-seed-pool/options.md` §4 — jedna tabela z polem `kind`
  (`ingredient` / `dish`).
- **Zmiana zależności względem mapy drogowej:** roadmapa zakłada S-03 równolegle z F-01.
  Po decyzji D14 wykluczenia składnikowe wskazują na **identyfikatory z tabeli `ingredient`**
  (dopasowanie po nazwie łamie guardrail — „risotto z borowikami"), więc S-03 potrzebuje schematu
  z F-01. Kolejność: F-01 faza 1 → S-03.
