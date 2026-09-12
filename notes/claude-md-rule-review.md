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
