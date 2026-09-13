# Decyzje podjęte samodzielnie — kolejka lekcji

Sesja autonomiczna ma mandat na rozstrzyganie. Każdy wpis ma **powód** i **jak cofnąć**.
Nic tutaj nie jest nieodwracalne bez wyraźnego zaznaczenia.

Punkt przywracania przed startem: **`aea480d`**.

**Audyt stanu kursu (13.09.2026):** 25 lekcji — 6 domkniętych (narzędzie + brief), 7 przerobionych
bez briefu (cały łańcuch M1 i M2), 2 częściowo, 10 nietkniętych. Pełna tabela w sekcji 0
[lesson-queue.md](lesson-queue.md). Wcześniejsza liczba „4 z 18" krążąca w rozmowie była błędna —
liczyła briefy napisane w nocnej sesji, a nie lekcje przerobione na projekcie.

Format: `### D<n> — <tytuł>` + Co / Powód / Jak cofnąć / Status.

---

## Kontekst zastany — to nie są decyzje tej sesji, ale wiążą

Decyzje z nocy 12/13.09.2026 leżą w [night-decisions.md](night-decisions.md) (D1–D16).
Cztery, o które najłatwiej się potknąć:

- **D14** — źródło przepisów: model autoryzuje raz **poza runtime**, makra liczy skrypt z USDA,
  Worker nigdy nie woła modelu. Zatwierdzone przez właściciela 13.09.
- **D16** — cel kaloryczny przycinany do 1000–6000 kcal, `computedKcal` zostaje surowym wynikiem
  wzoru. **Granice nie były dobierane medycznie** — dziedziczą po ograniczeniu nadpisania.
- **D10** — Playwright i poświadczenia **poza repozytorium**; `tests/` wyłączone z `tsconfig.json`.
- **D6** — harness budowany skillami kursu, nie ręcznie.

Cztery ustalenia przeglądu fazy 3 zostały świadomie **jako PENDING** i czekają na decyzję:
F4 (nieliczbowy „Własny cel" znika bez komunikatu), F5 (błędne nadpisanie gasi cały podgląd),
F6 (brak nazw dostępnościowych w polach), F7 (osierocone ikony `explore*.png`).
Pełny raport: `context/archive/2026-09-12-profile-and-calorie-target/reviews/impl-review-phase-3.md`.

---

<!-- KOLEJNE DECYZJE PONIŻEJ -->
