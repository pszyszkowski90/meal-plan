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

### D17 — Ryzyko wykluczeń przeniesione z fazy 2 do fazy 1 S-03 i przeramowane jako luka wymagań

**Co:** Badanie i przeramowanie S-03 (`context/changes/dietary-preferences/research.md`,
`frame.md`) ustaliły trzy rzeczy i naniosły je na plan. Po pierwsze: `ingredient.category`
**nie** nadaje się na oś wykluczeń — to jedenaście kategorii sklepowych, więc „grzyby" to
`warzywa`, a „orzechy" to `suche`. Po drugie: rozstrzygnięcie granulacji wykluczeń należy do
**fazy 1** (schemat), nie do fazy 2 (ekran), a faza 1 jest **zablokowana** do decyzji właściciela,
bo wybór wariantu modyfikuje kontrakt z D14. Po trzecie: problem nazywa się **luką wymagań**,
nie złamanym guardrailem — PRD definiuje guardrail względem zapisanej listy, a FR-004 mówi
o „potrawach i składnikach", nie o pojęciach.

**Powód:** Zbieżność pięciu niezależnych linii dowodu: enum kategorii w `0003`, identyczna porażka
kategorii USDA FoodData Central, cztery publikacje o filtrowaniu składnikowym (rodziny pokarmowe,
nie synonimy), wewnętrzna sprzeczność planu przy kryterium 1.7 oraz niezależna kontrola krzyżowa
uruchomiona **bez podania wiodącej hipotezy**. Ta ostatnia obaliła moje pierwotne nazwanie
problemu, więc przeramowanie przetrwało uczciwą próbę obalenia, a nie tylko potwierdzenie.
Argument terminowy: `ingredient` jest dziś pusta, więc warstwa grup kosztuje migrację;
po zaseedowaniu i ręcznym przeglądzie gramatur kosztuje backfill przez człowieka.

**Czego NIE rozstrzygnąłem:** który z trzech wariantów (osobna tabela grup / rozwinięcie przy
seedowaniu / świadoma dziura nazwana w PRD) wchodzi. To modyfikuje D14, więc należy do
właściciela. Dowody przechylają się ku wariantowi (a), bo (b) przecieka przy rosnącej puli.

**Jak cofnąć:** decyzja żyje wyłącznie w dokumentach, zero kodu.
`git checkout <sha>~1 -- context/changes/dietary-preferences/` przywraca plan sprzed poprawek;
`research.md` i `frame.md` można skasować. Nic nie zostało zaimplementowane ani zmigrowane.

**Status:** naniesione na plan; faza 1 S-03 zablokowana do decyzji właściciela.

### D18 — Kryterium 1.7 przeredagowane niezależnie od decyzji właściciela

**Co:** Kryterium żądało wykluczenia „grzyby" i sprawdzenia, że odsiane zostaje „risotto
z borowikami". W modelu tego samego planu (`kind='ingredient'` → `ingredient_id`) nie ma czego
wskazać — w `ingredient` są „pieczarki, świeże" i „borowiki, suszone". Kryterium przeredagowane
na wykluczenie po identyfikatorze; zdolność wyrażenia pojęcia szerokiego wydzielona jako osobne,
jeszcze nienapisane kryterium 1.8.

**Powód:** W poprzednim brzmieniu kryterium dało się zaliczyć wyłącznie wykluczając wprost
borowiki, co zakłada wiedzę, której kryterium miało dowieść. Przechodziłoby na zielono, dowodząc
jedynie, że `JOIN` łączy — a tabele są puste, więc fixture pisałby autor asercji. To ta sama klasa
fałszywej zieleni, co EBUSY przy `expo export` w `lessons.md`. Poprawka jest niezależna od tego,
który wariant warstwy grup wygra, więc nie czeka na właściciela.

**Jak cofnąć:** jedna sekcja w `plan.md` (kryteria fazy 1, Progress, kroki ręczne).

**Status:** naniesione.

