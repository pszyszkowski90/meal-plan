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

### D22 — `ast-grep` w `check-conventions.js`: NIE, i to jest rekomendacja przeciw

**Co:** Nie przepisuję reguł `check-conventions.js` z wyrażeń regularnych na `ast-grep`.
Zostaje obecne podejście: regexy po tekście z ręcznym usuwaniem komentarzy (`:36-103`).

**Powód:** Argument za był realny — `ast-grep` nie widzi komentarzy, bo komentarze nie są kodem,
więc obecne ręczne ich usuwanie stałoby się zbędne. Ale koszt przeważa i jest specyficzny dla
tego repo:

1. **`check-conventions.js` nie ma dziś ŻADNEJ zależności.** To nie jest przypadek: dzięki temu
   działa jako hook `PostToolUse` w ~0,15 s po każdej edycji pliku, przechodzi w `pre-commit`
   i `pre-push`, a w bramce CI nie potrzebuje niczego poza `npm ci`. Ta sama własność sprawia, że
   `npm test` działa w świeżym `git worktree` bez `node_modules`.
2. **Nowa zależność to ryzyko dla lockfile'a** — a to jest reguła, przed którą całe repo ucieka
   (`npm install` na Windowsie psuje `package-lock.json` niewidocznie, Playwright mieszka **poza**
   `package.json` właśnie dlatego).
3. **Problem, który miałby rozwiązać, jest już rozwiązany** — brzydko, ale skutecznie i z testem
   w postaci czystego przebiegu na 43 plikach. Wymiana działającego obejścia na zależność to zły
   handel przy tej skali.

**Kiedy zmienić zdanie:** gdy ręczne usuwanie komentarzy zacznie dawać fałszywe wyniki (dziś nie
daje) albo gdy reguł przybędzie na tyle, że regexy staną się nieczytelne. Wtedy `ast-grep` wraca
jako kandydat — z tym samym rachunkiem kosztów.

**Jak cofnąć:** nic nie zrobione, decyzja żyje w tym akapicie.

### D23 — Domknięcie m5l3 przez `10x-impl-review-ci` zablokowane na sekrecie

**Co:** NIE dodaję workflow uruchamiającego `10x-impl-review-ci` na PR, mimo że skill jest
zainstalowany i nie wymaga nowych zależności.

**Powód — zmierzony, nie założony:** skill działa przez **`claude-code-action`**, a ta wymaga
sekretu `ANTHROPIC_API_KEY` (albo `CLAUDE_CODE_OAUTH_TOKEN`) w repozytorium. `gh secret list`
zwraca **pustą listę** — repo nie ma żadnego sekretu. Workflow dodany teraz **padałby na każdym
pull requeście**.

To byłoby gorsze niż brak workflow: czerwona bramka, która zawsze jest czerwona, uczy ludzi
ignorować czerwone bramki — a warstwa 4 (`quality-gate.yml`) dopiero co powstała i jej wiarygodność
jest jej jedyną wartością.

**Co musi się wydarzyć, żeby to odblokować:** człowiek ustawia sekret w ustawieniach repozytorium
(`gh secret set ANTHROPIC_API_KEY`). Wtedy workflow to kilkanaście linii i jeden przebieg na PR
do sprawdzenia.

**Uwaga o zakresie:** nawet po odblokowaniu zostaje pytanie **czy warto** — przegląd jest tu robiony
przez jedną osobę, jedenaście razy w historii projektu. Wartość agenta recenzującego rośnie
z liczbą przeglądów i liczbą recenzentów, a nie sama z siebie.

**Jak cofnąć:** nic nie zrobione.


### D20 — Sito Atwatera dostaje próg BEZWZGLĘDNY obok względnego (12 kcal/100 g)

**Co:** `atwaterWithinTolerance(macros, 10%, 12 kcal)` w `src/lib/dish-macros.ts`, użyte w obu sitach
`dish-validation.ts` (na składniku i na daniu). Warunek: `|zadeklarowane − Atwater| ≤ max(10% ×
zadeklarowane, 12 kcal)`. **Zero kilokalorii zostaje przypadkiem ostrym** — produkt zadeklarowany
jako bezkaloryczny z niezerowymi makrami jest zawsze odrzucany, próg bezwzględny tam nie działa.

**Powód:** Właściciel wybrał wariant „luźniejszy próg dla niskokalorycznych". **Moja pierwotna
propozycja (25% poniżej 60 kcal/100 g) była błędna** — zmierzyłem ją na prawdziwych wierszach USDA
i nie wystarcza: szpinak ma 28,1% odchylenia, pieczarka 29,4%. Próg procentowy musiałby sięgnąć
~35%, a wtedy przestaje cokolwiek łapać.

Przyczyna jest matematyczna, nie dziedzinowa: **tolerancja względna załamuje się blisko zera**.
Przy 23 kcal nadwyżka 6,5 kcal to 28%, choć w kilokaloriach jest to nic. Próg bezwzględny naprawia
dokładnie ten efekt, nie dotykając produktów wysokokalorycznych.

**Zmierzone (pełna tabela w scratchpadzie sesji, wartości z USDA):**

| Produkt | kcal | Atwater | odchylenie | różnica |
|---|---:|---:|---:|---:|
| brokuł surowy | 34 | 41,2 | 21,1% | 7,2 |
| szpinak surowy | 23 | 29,5 | 28,1% | 6,5 |
| pieczarka surowa | 22 | 28,5 | 29,4% | 6,5 |
| ogórek surowy | 15 | 18,1 | 20,7% | 3,1 |
| **BŁĄD:** ryż ugotowany pod nazwą suchego | 130 | 354,3 | 172,5% | **224,3** |
| **BŁĄD:** niskokaloryczny zawyżony ×10 | 20 | 186,0 | 830,0% | **166,0** |

Skala błędu, którego szukamy, jest o rząd wielkości większa niż nadwyżka błonnikowa — dlatego próg
bezwzględny rozdziela te dwa przypadki czysto. Sprawdzone dla progów 8, 10 i 12 kcal: **zero
błędnych werdyktów w każdym**. Wybrano 12 — najgorszy uczciwy przypadek to 7,2 kcal, więc zapas
jest 66-procentowy, a koszt przeoczenia ograniczony z góry: 12 kcal/100 g przy 300 g warzyw to
36 kcal, poniżej 2% dziennego budżetu i wewnątrz guardraila ±10%.

**Weryfikacja:** blok testowy „ZNANE OGRANICZENIE" **zastąpiony** testami, w których cztery warzywa
z prawdziwymi liczbami USDA **przechodzą**, a trzy klasy błędów nadal są odrzucane. Celowe
zepsucie (próg = 0, czyli stan sprzed decyzji) zaczerwieniło **dokładnie cztery testy warzywne**
i żadnego innego. `npm test` 77/77 (było 66).

**Jak cofnąć:** `atwaterFloorKcal: 0` w `DishBounds` przywraca poprzednie zachowanie; testy warzywne
wtedy czerwienią się i trzeba je usunąć.

**Status:** wdrożone. **F-01 faza 3 odblokowana.**

### D21 — Wykluczenia dostają osobną tabelę grup (wariant a); D14 rozszerzone

**Co:** Model wykluczeń z decyzji D14 zostaje rozszerzony o **trzeci rodzaj wpisu** `kind='group'`
oraz dwie tabele: `exclusion_group` (słownik grup po polsku — grzyby, orzechy, nabiał, ryby, owoce
morza, strączki, gluten, wieprzowina…) i `ingredient_group` (przypisanie składnika do grupy,
wiele do wielu). Wykluczenie grupowe obejmuje **każdy** składnik należący do grupy, także dodany
do puli później.

**Powód:** Wybór właściciela po badaniu S-03. Wariant „rozwinięcie przy seedowaniu" zachowywał
dwuwartościowe `kind` zgodnie z D14, ale **przecieka przy rosnącej puli**: zbiór identyfikatorów
jest migawką, a faza 4 F-01 celuje w ≥ 12 śniadań, ≥ 18 obiadów, ≥ 18 kolacji i ≥ 12 przekąsek —
składnik dodany po rozwinięciu nie zostałby objęty i **nikt by się o tym nie dowiedział**.
Wariant „świadoma dziura w PRD" był uczciwy, ale zostawiał FR-004 działające tylko dla części
przypadków.

**Dlaczego nie `ingredient.category`:** to jedenaście **kategorii sklepowych** (grzyby → `warzywa`,
orzechy → `suche`). Wykluczenie po kategorii wycięłoby wszystkie warzywa albo wszystkie produkty
suche. Kategorie USDA zawodzą identycznie. Szczegóły: `research.md` §4.1.

**Dlaczego nie FoodOn:** hierarchia 9 600 klas do MVP z pulą rzędu stu dań jest nieproporcjonalna.

**Koszt zmiany D14 jest dziś niski na mocy samej D14** („decyzja żyje w dokumentach, zero kodu")
— a `ingredient` jest **pusta**, więc to migracja, nie backfill przez człowieka. Po zaseedowaniu
i ręcznym przejrzeniu gramatur ta sama zmiana kosztowałaby ręczne przypisanie każdego składnika.

**Jak cofnąć:** zero kodu napisane — decyzja żyje w `plan.md` S-03, `research.md` i tutaj.
Powrót do dwuwartościowego `kind` to cofnięcie tych akapitów.

**Status:** rozstrzygnięte. **S-03 faza 1 odblokowana**, kontrakt migracji `0004` do uzupełnienia
o dwie tabele. Nie implementowane — to zadanie dla `/10x-implement`.


### D19 — Bramka jakości w GitHub Actions jako czwarta warstwa, bez wdrażania i bez E2E

**Co:** `.github/workflows/quality-gate.yml` na pushu i PR do `main`: `npm ci`, `tsc --noEmit`,
`expo lint`, `npm test`, `check-conventions`, `check-lock`. Trzy rozstrzygnięcia wbudowane
w workflow i opisane w jego komentarzu:

1. **Bramka nie wdraża.** Wdrożeniem zajmuje się Workers Builds, podpięty osobno do `main`.
   Dwa niezależne wdrożenia tego samego commita to wyścig o to, które nadpisze drugie, i dwa
   miejsca na sekrety.
2. **`npm ci` jest bramką sam w sobie.** To dokładnie ten przebieg, który psuje `npm install`
   na Windowsie: wpisy `*-wasm32*` bez zależności `@emnapi/*`, EUSAGE na Linuksie. Wcześniej
   wychodziło to dopiero w Workers Builds — czyli **po** wypchnięciu na `main`. Teraz wychodzi
   na pull requeście.
3. **E2E nie wchodzi.** Playwright stoi poza `package.json`, bo `npm install` psuje tu lockfile.
   Wciągnięcie go do zależności po to, żeby CI miało E2E, złamałoby dokładnie tę regułę, której
   ta bramka pilnuje. Świadome ograniczenie: testy przeglądarkowe zostają uruchamiane z ręki.

**Powód:** Warstwy 1–3 są lokalne, więc da się je pominąć (`--no-verify`, świeży klon bez
`hooks:install`, push z innej maszyny). Warstwa 4 pominąć się nie da i jako jedyna widzi każdy
commit na `main`.

**Sprawdzone, nie założone:** `tsc` i `expo lint` przechodzą **bez** `.env.local` (zmierzone przez
tymczasowe odsunięcie pliku), więc bramka nie potrzebuje żadnych sekretów.
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` czytany jest dopiero w runtime.

**Jak cofnąć:** usuń `.github/workflows/quality-gate.yml` i cofnij dwa akapity w `CLAUDE.md`
(tabela warstw, sekcja o CI). Zero wpływu na kod produktu i na wdrożenie.

**Status:** workflow w repo; wynik pierwszego przebiegu — patrz Dziennik, wpis B1.


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

