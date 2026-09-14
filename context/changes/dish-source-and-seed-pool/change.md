---
change_id: dish-source-and-seed-pool
title: Wybór źródła przepisów z makrami i zseedowanie minimalnej puli dań
status: implementing
created: 2026-09-08
updated: 2026-09-14
archived_at: null
---

## Notes

- **Backfill makr USDA przejrzany 14.09.2026** (PR #24) —
  [reviews/impl-review.md](reviews/impl-review.md). Werdykt APPROVED: 0 krytycznych, 1 ostrzeżenie,
  4 obserwacje. Zakres to tylko wiersze 3.0a–3.0d fazy 3 (osiem błędnych makr z pamięci modelu
  zastąpionych wierszami USDA); 3.1–3.11 nadal `[ ]`.
- **Faza 1 przejrzana 13.09.2026** — [reviews/impl-review-phase-1.md](reviews/impl-review-phase-1.md).
  Werdykt WYMAGA UWAGI: 0 krytycznych, 2 ostrzeżenia, 2 obserwacje. Weszła na produkcję **bez
  przeglądu** i to był jedyny taki przypadek w tym repo; przegląd nadrobiony po fakcie.
  Odstępstwo `prep_minutes` bez zakresu 5–120 w `CHECK` **podtrzymane** jako zgodne z precedensem,
  z nazwanymi dwoma warunkami, które czynią je bezpiecznym.
- **Status `implementing`, nie `impl_reviewed`** — świadomie, ten sam powód co po fazie 1.
  Umiejętność przeglądu każe stemplować `impl_reviewed`, ale ta zmiana ma cztery fazy i przejrzany
  jest znowu tylko fragment: faza 3 nie jest domknięta (3.1–3.11 czekają), fazy 4 nie ma.
  `impl_reviewed` na takiej zmianie kłamałby wobec `/10x-archive`.
- **Faza 2 wykonana 13.09.2026** w osobnym `git worktree` (gałąź `f01-phase2`, merge `78586d8`).

- Element mapy drogowej: **F-01** (`context/foundation/roadmap.md`), kamień milowy M-01 — fundament,
  nie fragment pionowy.
- Odnośniki PRD: FR-008, FR-009, FR-016; Open Questions 1 i 2.
- Odblokowuje: S-04 (`first-weekly-plan`), S-06 (`step-by-step-cooking`), S-07
  (`shopping-list-from-days`) — strumienie B, C i D w całości.
- Blokada z `CLAUDE.md`: generator planu i guardrail ±10% nie mogą powstać, zanim ta decyzja nie
  zapadnie. Właścicielem decyzji jest użytkownik; badanie ma dostarczyć dowody, nie zastąpić decyzji.
