---
change_id: first-weekly-plan
title: Generator tygodniowego jadłospisu z guardrailem ±10% i widokiem przepisu
status: impl_reviewed
created: 2026-09-14
updated: 2026-09-14
archived_at: null
---

## Notes

Fragment **S-04** mapy drogowej (`context/foundation/roadmap.md`), kamień milowy M-01.
Odnośniki PRD: US-01, FR-008, FR-009. Zadanie **G3** z `notes/plan-queue.md` — sedno tej paczki.

Użytkownik prosi o jadłospis i widzi plan na siedem kolejnych dni, gdzie każdy dzień ma zadaną
liczbę posiłków, suma kalorii dnia mieści się w ±10% celu, żaden posiłek nie zawiera pozycji
z wykluczeń ani nie przekracza maksymalnego czasu przygotowania — a dla każdego dania może
otworzyć przepis ze składnikami, instrukcją i makrami.

**To pierwsza zmiana w tym repo, w której guardrail produktowy jest liczony, a nie tylko
deklarowany.** `CLAUDE.md` nazywa trzy ograniczenia twarde, a czwartą regułę — brak planu
częściowego — najłatwiej złamać po cichu, bo „prawie się zmieściło" jest kuszące i niewidoczne
dla użytkownika.

Wymagania wstępne są zamknięte: F-01 (pula 58 dań i 51 składników na produkcji), S-02 (profil
i cel kaloryczny), S-03 (wykluczenia, limit czasu, liczba posiłków) — wszystkie zarchiwizowane.
