# Przegląd reguł: `CLAUDE.md`

- **Data**: 2026-09-13 (nocna sesja, zadanie T8)
- **Zakres**: plik `CLAUDE.md` jako artefakt reguł — jego kondycja, nie jakość projektu
- **Tryb**: raport. Zmiany kolejności i usunięcia **nie zostały wykonane** — zgodnie z zasadą
  zadania T8 („bez samodzielnej edycji reguł"). Wyjątek opisany na końcu.

## Karta wyników

| Sprawdzenie | Werdykt | Uzasadnienie |
|---|---|---|
| 1. Długość | **WARN** | 272 linie niepuste (próg OK ≤ 200); 34 z nich to blok generowany przez `10x-cli` |
| 2. Osadzony kod i konfiguracja | **OK** | Wklejone wyłącznie sekwencje poleceń, których agent nie zgadnie; zero treści plików konfiguracyjnych |
| 3. Precyzja języka | **OK** | Reguły autorskie są binarne i prawie każda kończy się nazwaniem konkretnej awarii |
| 4. Redundancja z wiedzą publiczną | **WARN** | Blok `10x-cli` powiela listing skilli; dwa zdania to dokumentacja Metro i expo-router |
| 5. Kolejność reguł | **WARN** | Trzy reguły o najwyższym koszcie złamania leżą poniżej linii 200 |
| Aktualność | **WARN** | Plik zaktualizowany po zmianach nocnych, ale **sekcja weryfikacji sama sobie przeczy** |

## Co jest zrobione dobrze

Warto to zapisać, żeby kolejny przegląd nie „poprawiał" tego z rozpędu:

- **Zero wklejonej konfiguracji.** Linia o `wrangler.jsonc` odsyła do komentarzy w pliku, zamiast
  je kopiować. Oba bloki `sh` (migracje D1, kolejność wdrożenia) to sekwencje z obowiązkową
  kolejnością — dokładnie ten rodzaj treści, który ma być wklejony.
- **Reguły są sprawdzalne.** Ani jednego „pisz czysty kod" czy „uważaj na wydajność". Prawie każda
  reguła mówi, **co się stanie** przy złamaniu („zabija Google SSO, a `tsc` tego nie złapie"),
  więc agent wie nie tylko czy złamał, ale czym to grozi.
- **Gęstość informacji jest wysoka.** Plik jest długi, bo repo ma dużo nietrywialnych ograniczeń,
  a nie dlatego, że jest rozwodniony.

## Sprawdzenie 1 — Długość (WARN)

272 linie niepuste: treść autorska ≈ 238, blok `<!-- BEGIN @przeprogramowani/10x-cli -->` = 34
(**12,5% pliku**). Usunięcie samego bloku nie zejdzie poniżej 200, ale to jedyny fragment, który
nic nie kosztuje przy usunięciu. Uwaga: blok jest **zarządzany przez `10x-cli`**, więc ręczne
skasowanie wróci przy następnym `10x get`.

## Sprawdzenie 2 — Osadzony kod (OK)

Dwa drobiazgi, które będą dryfować od źródła:

- Wartości skali `Spacing` (`half=2, one=4 … six=64`) powtarzają `src/constants/theme.ts`.
  Reguła jest sprawdzalna bez liczb — nazwy tokenów wystarczą.
- Pełna lista wariantów `ThemedText` / `ThemedView` rośnie wraz z komponentem i nikt jej tu
  nie upilnuje.

## Sprawdzenie 3 — Precyzja języka (OK)

Trzy zdania miękkie, wszystkie drugorzędne: „Zero dryfu między ekranem a generatorem" (hasło,
nie reguła — sprawdzalna treść jest zdanie wyżej), „prawie zawsze znaczy, że efekt jest
niepotrzebny" (komentarz po twardej regule lintu), oraz dwa zdania o triażu w bloku `10x-cli`.

## Sprawdzenie 4 — Redundancja (WARN)

Oblewają test włączenia („czy agent mógłby to wiedzieć bez tego pliku?"):

- **Cały blok `10x-cli`** — tabela „Router zadań" opisuje skille, których opisy agent i tak
  dostaje w listingu przy starcie sesji; „Dyscyplina triażu" to ogólna metodologia przeglądu.
  Jedyna lokalna informacja w bloku to ścieżki `context/changes/<id>/reviews/`
  i `context/foundation/lessons.md` — i one należą do sekcji „Dokumenty projektu".
- **„Metro rozwiązuje `foo.web.tsx` przed `foo.tsx`"** — dokumentacja Metro. Lokalne jest
  *kryterium* wyboru wariantu platformowego, nie mechanizm.
- **„`NativeTabs.Trigger name` musi odpowiadać nazwie pliku trasy"** — dokumentacja expo-router.
  Lokalna jest tylko konsekwencja: zakładka to `home` na webie, `index` natywnie.

Świadomie **nie** zgłoszone jako redundancja: przypomnienie o wersjonowanej dokumentacji v57
(celowo walczy z pamięcią treningową), fakt włączenia `reactCompiler` w tym repo, kebab-case.

## Sprawdzenie 5 — Kolejność (WARN)

Szkielet jest dobry (produkt → twarde reguły → struktura → architektura → komendy → pułapki),
ale trzy reguły o najwyższym koszcie złamania leżą poniżej linii 200:

| Reguła | Koszt złamania |
|---|---|
| „Warunek produkcyjny wchodzi **przed** commitem fazy, która go potrzebuje" | Push na `main` wdraża natychmiast → produkcja zwraca 500 |
| „`npx expo start --web` nie jest testem wdrożenia" | Zielony test lokalny, martwe wdrożenie |
| „`10x get <ref>` kasuje skille i **przepisuje ten plik**" | Utrata `.claude/` i `CLAUDE.md` — **jedyna reguła, której złamanie niszczy same reguły** |

**Propozycja (niewykonana):** podnieść te trzy do „Twardych reguł" jako pozycje 1–3, zostawiając
w miejscu obecnym samo rozwinięcie. `10x get` zasługuje na pierwsze miejsce w całej sekcji — to
jedyna operacja w repo, po której nie da się przeczytać, co się zepsuło.

## Aktualność — pięć miejsc opisujących stan sprzed zmian

Zweryfikowane jako **aktualne** po nocy: „Trzy trasy API", kontrakt `{ profile, target }`,
nieutrwalany cel kaloryczny, `npm test`, `tests/e2e/` z wyłączeniem `tests` z `tsconfig.json`,
zakładka `profile` w obu plikach `app-tabs`, lista importerów `useColorScheme`, 30 skilli.

Nieaktualne:

1. **„`npx tsc --noEmit` — jedyne realne sprawdzenie poprawności w tym repo"** — nieprawda od
   tej nocy i **sprzeczna z innym zdaniem w tym samym akapicie** („`tsc` **i** `npm test`
   przechodzą"). Agent czytający listę od góry zatrzyma się na pierwszym i nie uruchomi testów.
2. **„bo D1 nie ma RLS, a repo nie ma testów — to jedyna izolacja między kontami"** — repo ma
   32 testy i `tests/e2e/data-boundary.spec.ts`, który testuje dokładnie tę granicę. Zdanie jest
   prawdziwe wyłącznie o `src/server/repository/`.
3. **Lista skryptów `package.json`** pomija `test` i `check-lock`, opisane dziesięć linii niżej.
4. **„Dokumenty projektu" nie wymieniają `lessons.md` ani `test-plan.md`.** `lessons.md` pada
   w pliku **wyłącznie** w bloku `10x-cli` — czyli w części, którą skasuje pierwsze `10x get`.
   Reguła tracąca wtedy wskaźnik do rejestru reguł to najgorszy tryb awarii tego pliku.
   Odsyłacz do briefów wskazuje jeden plik, a `notes/` ma ich teraz pięć.
5. **Licznik importów względnych** („5 wystąpień, zero `../`") — piątka w `src/components/` się
   zgadza, ale nocna zmiana dodała szóste **poza** tym katalogiem:
   `src/lib/calorie-target.test.ts` importuje `./calorie-target.ts`. Reguła w obecnym brzmieniu
   czyni własny plik testowy repo naruszeniem.

## Co zostało poprawione od razu, a co nie

**Poprawione** (pozycje 1–5 z „Aktualności"): to są zdania opisujące stan sprzed zmiany, czyli
dokładnie zakres kryterium **4.6** fazy 4, które odhaczyłem tej nocy — przegląd pokazał, że
zrobiłem je niekompletnie. Sprzeczność o weryfikacji i zdanie „repo nie ma testów" zmieniają
zachowanie agenta (pominie testy, uzna izolację kont za nietestowaną i zacznie budować ją od nowa),
więc zostawienie ich do rana byłoby zostawieniem pułapki.

**Niewykonane, do decyzji właściciela:** zmiana kolejności reguł (Sprawdzenie 5), usunięcie bloku
`10x-cli` i dwóch zdań dokumentacyjnych (Sprawdzenie 4), odchudzenie duplikatów `Spacing`
i wariantów `ThemedText` (Sprawdzenie 2). To są zmiany **projektu reguł**, nie faktów — a zadanie
T8 wprost zabrania samodzielnej edycji reguł.

---

# Przegląd reguł nr 2: `CLAUDE.md` — po wykonaniu propozycji

- **Data**: 2026-09-13, zadanie B2 kolejki lekcji (m4l1)
- **Zakres**: ten sam plik, ten sam zestaw pięciu sprawdzeń
- **Tryb**: raport **plus wykonanie** trzech propozycji, które przegląd nr 1 zostawił właścicielowi
- **Po co drugi przegląd**: karta wyników porównana z poprzednią jest **dowodem**, że zmiana coś
  dała. Deklaracja „poprawiłem" dowodem nie jest.

## Karta wyników — porównanie

| # | Sprawdzenie | Przegląd 1 | Przegląd 2 | Zmiana |
|---|---|---|---|---|
| 1 | Długość | **WARN** (272) | **WARN** (332) | ↔ próg nadal przekroczony; patrz niżej |
| 2 | Osadzony kod | **OK** | **OK** | ↔ nadal dwa bloki `sh`, oba to sekwencje poleceń |
| 3 | Precyzja języka | **OK** (3 miękkie) | **OK** (2 miękkie) | ↗ dwa zniknęły z blokiem `10x-cli` |
| 4 | Redundancja | **WARN** | **OK** | ↗ **naprawione** |
| 5 | Kolejność | **WARN** | **WARN** | ↗ poprawione, nie domknięte |
| — | Aktualność (dodatkowe) | **WARN** | **OK** | ↗ naprawione |

**Dwa sprawdzenia poprawione z WARN na OK, jedno poprawione bez domknięcia, jedno bez zmian.**

## Co zostało wykonane

Wszystkie trzy propozycje przeglądu nr 1, plus jedna poprawka aktualności, którą **sam wprowadziłem
wcześniej tego dnia**:

1. **Blok `10x-cli` usunięty** — 44 linie (30 niepustych). Pułapka z przeglądu nr 1 była już
   rozbrojona: wskaźnik do `lessons.md` przeniesiono do „Dokumentów projektu" w nocy, więc
   usunięcie bloku niczego nie urwało. Blok jest **generowany**, więc wróci przy następnym
   `10x get` — a ta operacja jest w tej sesji zakazana i teraz stoi jako reguła numer jeden.
2. **Trzy reguły najbardziej niszczące podniesione na czoło „Twardych reguł"**, uszeregowane
   kosztem złamania: `10x get` (niszczy same reguły), warunek produkcyjny przed commitem
   (produkcja zwraca 500), `expo start --web` nie jest testem wdrożenia. Rozwinięcia zostały
   w miejscu; w dwóch przypadkach oryginał skrócono do tego, czego nagłówek nie niesie,
   żeby podniesienie nie było duplikatem.
3. **Duplikaty wartości usunięte** — liczby skali `Spacing` (`half=2 … six=64` → `half … six`)
   i pełna lista wariantów `ThemedText` zastąpiona odnośnikiem do komponentu. Oba dryfowały
   od źródła przy każdej zmianie motywu.
4. **Dwa zdania z dokumentacji frameworka usunięte** — „Metro rozwiązuje `foo.web.tsx` przed
   `foo.tsx`" i mechanizm `NativeTabs.Trigger name`. Zostało to, co lokalne: **konsekwencja**
   (ta sama zakładka nazywa się `index` natywnie i `home` na webie).
5. **Poprawka aktualności, której przegląd nr 1 nie mógł znać:** reguła o importach względnych
   mówiła „tylko rodzeństwo w `src/components/` (5 wystąpień) oraz **plik testu** w `src/lib/`".
   Faza 2 F-01 dołożyła import w module **nietestowym** (`dish-validation.ts` → `./dish-macros.ts`),
   więc reguła czyniła naruszeniem własny kod repo. Przepisana na „wszędzie w `src/lib/`,
   z jawnym rozszerzeniem", z powodem: `node --test` nie zna aliasu `@/`.

## Sprawdzenie 1 — Długość (WARN, 332)

Liczby, żeby nie było złudzeń: **272 → 370 → 332**.

Środkowa liczba jest istotna. Między przeglądami plik **urósł o 98 linii** z powodu dwóch zadań
tej samej sesji, które dołożyły reguły oparte na realnych awariach: sekcja o pracy równoległej
i worktree (A3) oraz czwarta warstwa bramek i ograniczenie `typedRoutes` w CI (B1). B2 zdjął
**38 linii** — więcej, niż przewidywała propozycja (30 z bloku `10x-cli`), bo doszło skrócenie
sekcji o worktree i usunięcie duplikatów.

Uczciwy wniosek: **samo usunięcie bloku `10x-cli` nigdy nie miało szans zejść poniżej 200**
— przegląd nr 1 pisał to wprost. Plik jest długi, bo repo ma dużo nietrywialnych ograniczeń,
a każde z nich pochodzi z nazwanej awarii. Realne zejście poniżej progu wymaga **podziału na pliki
zagnieżdżone** (np. reguły serwerowe bliżej `src/server/`), a nie dalszego skracania zdań.

## Sprawdzenie 5 — Kolejność (WARN, poprawione bez domknięcia)

Trzy najbardziej niszczące reguły są teraz w liniach 41–50, czyli w pierwszym ekranie po sekcji
produktowej. Zostały **dwie reguły krytyczne bez kotwicy na górze**, obie w sekcji o pracy
równoległej:

| Reguła | Linia | Koszt złamania |
|---|---|---|
| „Stage'uj po ścieżkach, nigdy `git add -A`" | 341 | 13.09 wciągnęło na `main` cudzy niedokończony plik |
| „Odepnij złącze, ZANIM usuniesz worktree" | 337 | skasowanie `node_modules` drzewa głównego |

**Świadomie ich nie podnoszę w tym samym przebiegu.** Krok 5e tej umiejętności mówi wprost: zmiany
strukturalne stosuje się pojedynczo, bo inaczej nie da się przypisać zmiany zachowania agenta do
konkretnej edycji. W jednym zadaniu wykonałem już przeniesienie trzech reguł, usunięcie bloku
i dwie zmiany treści — czwarta zmiana kolejności zaciemniłaby wynik. Zostaje jako pierwsza pozycja
listy działań.

## 3 najważniejsze działania

1. **Podnieś regułę o `git add -A` do „Twardych reguł"** — to jedyna pozostała reguła krytyczna
   bez kotwicy na górze, a jej złamanie już raz kosztowało cudzy plik na `main`. Jedna linia,
   osobny commit, w kolejnej sesji.
2. **Rozważ podział pliku, nie dalsze skracanie.** Przy 332 liniach i rosnącym repo zdania są już
   gęste; próg 200 osiągnie się wyłącznie przez wydzielenie reguł serwerowych i testowych do
   plików bliżej kodu.
3. **Uważaj na powrót bloku `10x-cli`.** Pierwsze `10x get` przywróci 30 linii i może nadpisać
   ten plik. Reguła numer jeden już o tym mówi — ale po każdym takim uruchomieniu sprawdź
   `git diff CLAUDE.md`, zanim cokolwiek zacommitujesz.

> **Przypomnienie o atomowej zmianie.** Zmiana kolejności pliku reguł to zmiana kształtu kontekstu;
> jej wpływ widać dopiero przy następnym realnym zadaniu agenta. Kolejne poprawki (podniesienie
> `git add -A`, podział pliku) stosuj pojedynczo i obserwuj zachowanie między nimi.
