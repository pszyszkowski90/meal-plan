---
change_id: dish-source-and-seed-pool
title: Wybór źródła przepisów z makrami i zseedowanie minimalnej puli dań
status: impl_reviewed
created: 2026-09-08
updated: 2026-09-14
archived_at: null
---

## Notes

- **Faza 4 (skalowanie puli, 20 → 56 dań) przejrzana (CI) 14.09.2026** (PR #27) —
  [reviews/impl-review.md](reviews/impl-review.md). Werdykt WYMAGA UWAGI: 0 krytycznych,
  1 ostrzeżenie, 2 obserwacje. Ustalenie: `seed/REVIEW.md` nigdy nie powstał, choć plan wymienia
  go wprost w Fazie 3 i 4 — substancja (narracja przeglądu gramatur) jest w praktyce pokryta
  Dziennikiem w `notes/pool-queue.md`, ale plik jako taki wciąż nie istnieje. Dwie obserwacje:
  jeden nowy składnik (`oliwki czarne, z puszki`) nie jest użyty w żadnym daniu — najpewniej
  ślad po dwóch daniach odrzuconych sitem `modelKcalHint`; i ograniczenie samego przebiegu —
  bez zgody na `npm`/`npx`/`node -e` w Bashu, kryteria 4.1–4.5 zweryfikowane statycznie
  (przeliczenie liczby dań per pora, sprawdzenie `reviewedBy`, istnienia składników i
  niezmiennika Atwatera dla 16 nowych wierszy USDA), nie wykonaniem — ten sam rodzaj
  ograniczenia co w przeglądach PR #24 i #25 poniżej. **To zamyka plan F-01 w całości**:
  wszystkie cztery fazy mają teraz `[x]` na każdym kryterium, więc status zmienia się na
  `impl_reviewed` (poprzednie rundy zostawały przy `implementing`, bo dotyczyły fragmentu planu).
- **Faza 3 (pilot 20 dań) przejrzana (CI) 14.09.2026** (PR #25, commit `928a056`) —
  [reviews/impl-review.md](reviews/impl-review.md). Werdykt APPROVED: 0 krytycznych, 0 ostrzeżeń,
  2 obserwacje (komentarz SQL nieodporny na znak nowej linii w nazwie dania; wpis `check:pool`
  w `package.json` nienazwany wprost w planie, ale operacjonalizuje zaplanowany artefakt —
  klasyfikacja EXTRA, łagodne). Wszystkie kryteria 3.1–3.11 zweryfikowane: dryf planu zerowy
  (agent dryfu: same MATCH), SQL-escaping i idempotencja seeda sprawdzone statycznie jako poprawne,
  bramka jakości GitHub Actions zielona (tsc/test/lint/check-conventions/check-lock). Twierdzenia
  o sprawdzeniach na żywo wobec D1 (walidator, idempotencja, bramka `--remote`) nie dały się
  odtworzyć w tym sandboxie CI (brak `wrangler`, brak zgody na `node`/`npx` w Bashu) — potwierdzone
  wyłącznie statycznym czytaniem kodu, nie wykonaniem; PR-body i Dziennik w `notes/pool-queue.md`
  twierdzą, że wykonano je na żywo przed tym commitem.
  **Status pozostaje `implementing`, nie `impl_reviewed`** — ten sam powód co po fazie 1 i backfillu:
  Faza 4 (4.1–4.8) jest wciąż w całości `[ ]` i poza zakresem tego PR-a.
- **Backfill makr USDA — druga runda przeglądu (CI) 14.09.2026** (PR #24, commit `768984b`) —
  [reviews/impl-review.md](reviews/impl-review.md). Werdykt APPROVED: 0 krytycznych, 0 ostrzeżeń,
  2 obserwacje. Cztery z pięciu ustaleń pierwszej rundy zweryfikowane jako naprawione czytaniem
  kodu (nie tylko diffu) — sprawdzenie nagłówka kolumn CSV, osłona odczytów, domyślne `details`;
  piąte (fixture testu sita) świadomie odłożone do P5. Jedno nowe ustalenie: **F6 (OCZEKUJE)** —
  brak pisemnego potwierdzenia, że pełny, poprawny zbiór USDA przeszedł przez nowy guard nagłówka
  (możliwy, niesprawdzony w tym środowisku problem z BOM-em; `.usda/` gitignorowane, nieobecne
  w CI). Ten przebieg nie miał zgody na `node`/`npm` w Bashu, więc `tsc`/`test`/`lint`/
  `check-conventions` nie zostały odtworzone niezależnie — patrz „Ograniczenie tego przebiegu"
  w raporcie.
- **Backfill makr USDA przejrzany 14.09.2026** (PR #24, pierwsza runda) —
  poprzednia treść raportu zastąpiona powyższym (ten sam plik, git history ma poprzednią wersję).
  Zakres to tylko wiersze 3.0a–3.0d fazy 3 (osiem błędnych makr z pamięci modelu zastąpionych
  wierszami USDA); 3.1–3.11 nadal `[ ]`.
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
