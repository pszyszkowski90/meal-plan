<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Profil użytkownika i wyliczone zapotrzebowanie kaloryczne

- **Plan**: `context/changes/profile-and-calorie-target/plan.md`
- **Zakres**: Faza 3 z 4 (commit `42b6917`)
- **Data**: 2026-09-13
- **Werdykt**: WYMAGA UWAGI
- **Ustalenia**: 0 krytycznych, 2 ostrzeżenia, 6 obserwacji

> Przegląd prowadzony bez człowieka przy klawiaturze (praca nocna). Sortowanie interaktywne
> zastąpione decyzjami zapisanymi w polach `Decyzja` poniżej i w `notes/night-decisions.md`.

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS |
| Dyscyplina zakresu | PASS |
| Bezpieczeństwo i jakość | WARNING |
| Architektura | WARNING |
| Spójność wzorców | PASS |
| Kryteria sukcesu | WARNING |

**Zgodność z planem**: wszystkie sześć punktów „Wymagane zmiany" zweryfikowane jako MATCH.
**Bezpieczeństwo**: sprawdzone celowo i **nie znaleziono** wycieku danych osobowych do logów,
URL-i ani pamięci trwałej, braku uwierzytelnienia, XSS ani sekretów w kodzie. Trasa oddaje profil
z `Cache-Control: no-store` i loguje błędy bez `userId`. `OfflineError` i `NotSignedInError` są
rozłączne na wszystkich sześciu ścieżkach — **offline nie wylogowuje**.
**Kryteria sukcesu**: 3.1–3.6 automatyczne zielone; 3.7–3.11 i 3.13 pokryte harnessem;
**3.12 (Expo Go) niesprawdzone wcale** — stąd WARNING, nie PASS.

## Ustalenia

### F1 — Odpowiedź `GET` nadpisuje to, co użytkownik wpisał

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość (bezpieczeństwo danych)
- **Lokalizacja**: `src/app/(app)/profile.tsx:92-123`, `129-136`, `205-211`
- **Szczegóły**: Formularz renderuje się także w stanie `loading`, a efekt startowy po odpowiedzi
  woła bezwarunkowo `applyProfile`, robiąc sześć `setXText(...)`. Trzy realne przebiegi:
  (1) użytkownik na wolnym łączu traci wpisane znaki; (2) `GET` w locie + szybki `Zapisz` →
  `PUT` wraca pierwszy, potem `GET` przywraca **stary** profil — ekran pokazuje stare liczby pod
  komunikatem „Zapisano", czyli kłamie o stanie bazy; (3) edycja w trakcie zapisu ginie.
  Harness potwierdza to empirycznie: `openProfile()` istnieje wyłącznie po to, żeby obejść ten
  wyścig, który sypał zestaw mniej więcej raz na trzy przebiegi.
  Komentarz w `:90-91` deklaruje „`cancelled` z cleanupu" — ale tej flagi w tym pliku nie ma.
- **Poprawka**: ref `touched` ustawiany przy pierwszej zmianie pola + `cancelled` w cleanupie
  efektu; nie stosować odpowiedzi `GET`, gdy formularz jest brudny.
  - Siła: zamyka przebiegi 1 i 2, wzorzec `cancelled` już istnieje w `index.tsx:113,146-148`.
  - Kompromis: dwie dodatkowe referencje w komponencie.
  - Pewność: HIGH — objaw zmierzony, nie hipotetyczny.
- **Decyzja**: FIXED (noc, przed wdrożeniem — patrz D12)

### F2 — Karta celu na Home może zawisnąć na „Sprawdzam profil…" na zawsze

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔬 WYSOKI — stawka architektoniczna; pomyśl dokładnie przed podjęciem decyzji
- **Wymiar**: Architektura
- **Lokalizacja**: `src/app/(app)/index.tsx:103-149`
- **Szczegóły**: Efekt łączy **trwały** ref (`fetchedForFocus`) z flagą `cancelled` żyjącą
  w domknięciu jednego przebiegu. Różny czas życia = rozjazd przy zmianie tożsamości
  `authedFetch` (w zależnościach efektu): cleanup przebiegu #1 ustawia `cancelled = true`,
  przebieg #2 widzi `fetchedForFocus.current === true` i **nie startuje nowego żądania**,
  a odpowiedź #1 zostaje odrzucona. `target` zostaje `loading` bez końca; jedyne wyjście to
  przełączenie zakładki. Wersja sprzed fazy 3 miała sam ref i tego trybu awarii **nie miała** —
  wprowadziło go dołożenie `cancelled` bez ujednolicenia czasu życia.
  Dziś ratuje to memoizacja `reactCompiler`, ale komentarz w `:98-101` sam deklaruje niezależność
  od tego, co Compiler zmemoizuje — i druga połowa efektu tej niezależności nie ma.
- **Poprawka**: jeden identyfikator przebiegu zamiast ref + `cancelled`: `const run = ++runId.current`
  na wejściu, `if (run !== runId.current) return` przy każdej odpowiedzi.
  - Siła: jedna jednostka czasu życia; stara odpowiedź nadal nie nadpisze nowszej, a wznowienie
    po zmianie tożsamości `authedFetch` nie wymaga przełączania zakładki.
  - Kompromis: odchodzi od dosłownego brzmienia „Krytycznych szczegółów" planu (ref + `cancelled`).
  - Pewność: HIGH — przebieg rozpisany krok po kroku, potwierdzony lekturą obu wersji pliku.
- **Decyzja**: FIXED (noc, przed wdrożeniem — patrz D12)

### F3 — „kcal dziennie" rozbite na dwa elementy wbrew brzmieniu umowy

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: `src/app/(app)/index.tsx:67-70`
- **Szczegóły**: Plan zamawiał jeden ciąg „{effectiveKcal} kcal dziennie"; ekran renderuje
  „2759 kcal" (`subtitle`) i „dziennie" (`small`) osobno. Skutek realny: żaden pojedynczy element
  nie zawiera frazy „kcal dziennie", więc test granicy danych musiał zakotwiczyć się na linku karty.
- **Poprawka**: zostawić — to wybór prezentacyjny, a nie defekt; udokumentowane w `tests/e2e/README.md`.
- **Decyzja**: SKIPPED (do rozstrzygnięcia przez właściciela; nie blokuje wdrożenia)

### F4 — Nieliczbowy tekst w „Własny cel" znika bez komunikatu

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: `src/app/(app)/profile.tsx:146`
- **Szczegóły**: „abc" w polu nadpisania daje przez `parseNumberInput` `null`, czyli jest
  **milcząco** traktowane jak brak nadpisania; zapis wychodzi bez błędu pod polem. Plan opisuje
  tylko „puste → `null`", więc litera umowy nie jest złamana, ale użytkownik traci wpisaną wartość.
- **Poprawka**: rozróżnić „puste" od „niepoprawne" i w drugim przypadku pokazać błąd pod polem.
- **Decyzja**: PENDING (dla właściciela — zmiana zachowania walidacji, nie defekt wdrożeniowy)

### F5 — Błędne wyłącznie nadpisanie gasi cały podgląd i ukrywa wyjście z niego

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🔎 ŚREDNI
- **Wymiar**: Zgodność z planem (intencja)
- **Lokalizacja**: `src/app/(app)/profile.tsx:339-361`, `377-393`
- **Szczegóły**: Gdy niepoprawne jest tylko nadpisanie, znika całe rozbieżne wyjaśnienie
  („Uzupełnij pola…"), mimo że BMR i wyliczenie są policzalne — zgodne z literą umowy
  (`ok:false → komunikat`), sprzeczne z jej celem („wyjaśnienie ma być sprawdzalne"). Gorzej:
  wiersz „Wróć do wyliczenia" jest warunkowany na `target`, więc przy niepoprawnym **innym** polu
  jedyny przycisk kasujący nadpisanie **znika** — użytkownik z zapisanym nadpisaniem i pustym
  wiekiem nie ma jak wrócić do wyliczenia inaczej niż ręcznie czyszcząc pole.
- **Poprawka**: warunkować wiersz na `parseNumberInput(overrideText) !== null`, a liczbę wyliczoną
  pokazywać tylko gdy `target` istnieje.
- **Decyzja**: PENDING (dla właściciela — realna pułapka UX, ale zmiana zachowania produktu)

### F6 — Pola formularza bez nazw dostępnościowych; grupa wyboru bez nazwy

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🔎 ŚREDNI
- **Wymiar**: Spójność wzorców (dostępność)
- **Lokalizacja**: `src/components/ui/text-field.tsx:29-37`, `src/components/ui/choice-field.tsx:49`
- **Szczegóły**: Faza 3 **odziedziczyła** brak nazw w `TextField`, ale pogłębiła go: przed zmianą
  nienazwane pola były tylko w `(auth)`, gdzie `autoComplete` daje *jakąś* semantykę. Faza 3 dokłada
  cztery pola produktowe bez `autoComplete` — jedynym rozróżnikiem jest `inputMode`, przez co
  harness musi adresować je **pozycyjnie** (`nth(0..2)`), a czytnik ekranu czyta „pole edycji"
  cztery razy. `error` nie jest powiązany przez `aria-describedby`, brak `aria-invalid`.
  Osobno: `radiogroup` w `ChoiceField` nie ma nazwy — czytnik powie „grupa przycisków radio"
  bez „Płeć". **Sam `ChoiceField` poza tym jest zrobiony dobrze** (role, `checked`, `accessibilityLabel`).
- **Poprawka**: generowany `id` + `aria-labelledby` w `TextField` i na grupie w `ChoiceField` —
  jedna zmiana w dwóch prymitywach naprawia oba ekrany i pozwala skasować obejścia w harnessie.
- **Decyzja**: PENDING (dla właściciela — patrz D11; naprawa dotyka kodu fazy 2)

### F7 — Osierocone `assets/images/tabIcons/explore*.png`

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: `assets/images/tabIcons/explore.png`, `explore@2x.png`, `explore@3x.png`
- **Szczegóły**: Od tej fazy bez importera (potwierdzone `grep`). `profile*.png` to ich bajtowo
  identyczne kopie. Plan zwalnia ze sprzątania assetów startera, ale wymienia tam `tutorial-web.png`
  i `react-logo*`, nie ikony zakładki, które osierociła właśnie ta faza.
- **Poprawka**: usunąć przy domykaniu zmiany.
- **Decyzja**: PENDING (dla właściciela — nic nie kosztują, `dist/` ich nie zawiera)

### F8 — Dokumentacja rozjechana z repo w dwóch miejscach

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: `plan.md:123-124`, `CLAUDE.md` (sekcja o `useColorScheme`)
- **Szczegóły**: (1) „Czego NIE robimy" nadal zabrania „testów komponentów i testów tras API",
  a repo ma `tests/e2e/profile-api.spec.ts` i `profile-screen.spec.ts` robiące jedno i drugie —
  harness powstał z osobnej decyzji właściciela (D6), ale plan nie został o to poprawiony.
  (2) `CLAUDE.md` wymienia `app-tabs.web.tsx` wśród plików importujących `useColorScheme` wprost
  z `react-native`; po fazie 3 ten plik już go nie importuje.
- **Poprawka**: skorygować oba zdania przy domykaniu fazy 4 (kryterium 4.6 i tak tego dotyczy).
- **Decyzja**: PENDING (naturalnie domyka to faza 4)
