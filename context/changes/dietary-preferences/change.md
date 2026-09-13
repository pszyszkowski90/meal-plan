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
- **Badanie przeprowadzone 13.09.2026** — [research.md](research.md), warstwa wewnętrzna
  (baza kodu) i zewnętrzna (dokumentacja Expo, publikacje o modelach wykluczeń, USDA/FoodOn)
  oznaczone osobno. Plan poprawiony w czterech miejscach.
- **Wymaganie wstępne spełnione:** F-01 faza 1 weszła (commit `c848474`), migracja `0003`
  zastosowana `--local` i `--remote`. Tabele `ingredient`, `dish`, `dish_ingredient` istnieją,
  ale są puste — pula powstaje w fazach 2–4 F-01.
- ~~**Nowa blokada, zgłoszona badaniem:** warstwa grup wykluczeniowych wymaga decyzji
  właściciela.~~ **ZDJĘTA 13.09.2026 — decyzja D21.** Wchodzi wariant z osobną tabelą grup
  (`kind='group'` + `exclusion_group` + `ingredient_group`); D14 zostaje **rozszerzone, nie
  cofnięte** — nadal jedna tabela `exclusion` i jeden mechanizm zasilany z FR-004 i FR-011.
  Odrzucone rozwinięcie przy seedowaniu: przecieka przy rosnącej puli.
  **Faza 1 jest gotowa do implementacji.**
- **Przeramowanie 13.09.2026** — [frame.md](frame.md). Kontrola krzyżowa (niezależny przebieg bez
  podanej hipotezy) obaliła pierwotne nazwanie problemu: guardrail PRD jest zdefiniowany względem
  **zapisanej listy**, a FR-004 mówi o „potrawach i składnikach", nie o pojęciach — więc to
  **luka wymagań**, nie defekt. Kolejność: **PRD (Otwarte pytanie 4) → schemat → ekran**.
  Waga niższa, niż wyglądała: `prd.md:203-205` wyklucza alergie kliniczne, więc stawką jest
  zaufanie, nie bezpieczeństwo.
- **Naniesione niezależnie od decyzji właściciela:** kryterium 1.7 przeredagowane. W poprzednim
  brzmieniu żądało wykluczenia „grzyby", czego model tego planu nie potrafi wyrazić, więc
  przechodziło na zielono, dowodząc jedynie, że `JOIN` łączy.
