# Co lekcje m1l1–m1l3, m1l5, m2l1 i m2l2 zostawiły w tym projekcie

> **Brief odtworzony z artefaktów, nie z treści lekcji. Treść tych lekcji nie jest dostępna
> lokalnie** — `10x-cli` pobrał wyłącznie materiał od m2l3 wzwyż, a odtworzenie go przez
> `10x get` jest w tym repo zakazane, bo synchronizuje `.claude/skills/` do manifestu żądanej
> lekcji i kasuje resztę.
>
> Dlatego ten dokument **nie opisuje, co lekcja wprowadza**. Opisuje, co po niej w tym projekcie
> zostało i co z tego obowiązuje do dziś.

## Dlaczego to jeden plik, a nie sześć

Kolejka dopuszczała trzy wyniki: sześć briefów, jeden wspólny albo świadome pominięcie. Wybrałem
środkowy i podaję powód, żeby dało się go podważyć.

**Za jednym plikiem przemawiają dwie rzeczy:**

1. **Granic między lekcjami nie da się ustalić z repozytorium.** `.claude/.10x-cli-manifest.json`
   wymienia skille, ale **nie mapuje ich na lekcje**. Jedyne wiarygodne źródło to zachowany blok
   lekcji m1l4 w [10x-lesson-m1l4-brief.md](10x-lesson-m1l4-brief.md), który mówi tyle:
   łańcuch PRD → tech-stack → bootstrap pochodzi z **Lekcji 1–3** (jako grupy), projekt powstał
   w **Lekcji 3**, a Lekcja 5 rozszerza łańcuch o etap infrastruktury i wdrożenia. Gdzie dokładnie
   kończy się m1l1, a zaczyna m1l2 — tego repo nie wie. To samo dla m2l1 kontra m2l2.
   Sześć plików wymagałoby **wymyślenia tych granic**, czyli dokładnie tego, przed czym ostrzega
   kolejka: dokumentu, który udaje wiedzę.
2. **Artefakty są większe i lepsze niż brief o nich.** `roadmap.md` ma 384 linie,
   `infrastructure.md` 414, `prd.md` 233, `shape-notes.md` 269. Plik mówiący „lekcja m1l2
   zostawiła `prd.md`" nie dodaje nic, czego czytelnik nie dostanie, otwierając `prd.md`.

**Czego ten wybór kosztuje:** rejestr lekcji nie będzie miał sześciu osobnych pozycji, więc ktoś
liczący pliki zobaczy lukę. Dlatego ta lista jest tutaj, jawnie.

## Co po tych lekcjach zostało — artefakt po artefakcie

### `shape-notes.md` (269 linii) — rozmowa odkrywcza

Wejście do całego łańcucha. Zapisane wymagania, których nie dało się wywnioskować z kodu, w tym
**równorzędna powierzchnia webowa** — to ono później uzasadniło wybór Expo, a nie samego
React Native.

**Obowiązuje:** jako materiał źródłowy PRD. Nie jest już edytowane.

### `prd.md` (233 linie) — wymagania z wyzwaniami sokratejskimi

Najbardziej nośny artefakt całego łańcucha i **jedyny z nich, który wciąż aktywnie rozstrzyga
spory**. Każde FR ma dopisane kontrargumenty i sposób ich rozstrzygnięcia. Dwa przykłady, które
wróciły do mnie jeszcze dzisiaj:

- **FR-004** — wyzwanie „wykluczenia składnikowe i daniowe to dwa różne poziomy; mylenie ich
  sprawi, że guardrail będzie łamany". To zdanie, napisane na etapie wymagań, jest dziś jedynym
  powodem, dla którego model wykluczeń w ogóle ma pole `kind`.
- **FR-011** — wyzwanie „to to samo co FR-004". Rozstrzygnięcie: **jedna** lista wykluczeń
  zasilana z dwóch miejsc, nie dwa mechanizmy. Ta reguła stoi dziś w `CLAUDE.md`.

**Obowiązuje w całości.** Cztery twarde ograniczenia produktu z `CLAUDE.md` to przepisane PRD.

### `tech-stack.md` (38 linii) — wybór startera

Najkrótszy artefakt i najgęstszy. Frontmatter z `starter_id: expo`, `package_manager: npm`,
`ci_provider: cloudflare-workers-builds` plus akapit uzasadnienia.

Dwie rzeczy w nim postarzały się ciekawie:
- **`has_ai: false`** zapisane **świadomie**, z uzasadnieniem, że generowanie przepisów przez model
  to nierozstrzygnięta opcja Open Question 1, a nie zatwierdzony zakres. Decyzja D14 z 13.09
  rozstrzygnęła OQ1 na hybrydę, w której model autoryzuje przepisy **raz, poza runtime**.
  Czyli `has_ai: false` **nadal jest prawdą** — Worker nigdy nie woła modelu.
- **„karta Expo nie wnosi backendu, dlatego konto e-mail+hasło wymaga dobrania warstwy danych
  osobno — to pierwsza decyzja po scaffoldowaniu"**. I dokładnie tak się stało: `infrastructure.md`
  plus aneks o Clerku.

**Obowiązuje:** jako zapis *dlaczego* Expo. Pola `deployment_target: appstore-via-eas` nikt jeszcze
nie zweryfikował — buildów EAS w tym repo nie było.

### `bootstrap-verification/verification.md` — scaffold i jego poprawki

Log weryfikacji po uruchomieniu startera. Stąd pochodzi zapisana w `CLAUDE.md` pułapka
o `slug: "meal-plan"` i `scheme: "mealplan"` — **oba zostały poprawione po scaffoldzie**, bo
starter wygenerował co innego, a zmiana któregokolwiek psuje buildy EAS.

**Obowiązuje:** jako jedyny zapis tego, co w konfiguracji natywnej jest wynikiem decyzji,
a co artefaktem startera.

### `infrastructure.md` (414 linii) — wybór platformy, z aneksem

Najdłuższy dokument w `context/foundation/`. Porównanie platform z rejestrem ryzyk, plus
**aneks z 1.09.2026**: dostawcą tożsamości jest **Clerk** (plan Hobby), a nie własna warstwa auth
na D1.

Ten aneks jest najbardziej wpływową decyzją całego modułu 1: to z niego wynika, że Worker
**wyłącznie weryfikuje podpis JWT** kluczem publicznym, że `CLERK_SECRET_KEY` nie wchodzi do
projektu, i że D1 nie trzyma haseł ani sesji.

**Obowiązuje w całości**, wraz z zastrzeżeniem, że produkcja na `workers.dev` chodzi na instancji
**Development** Clerka (`pk_test`).

### `roadmap.md` (384 linie) — kamień milowy i dekompozycja

Jeden otwarty kamień M-01 („Pierwszy pełny przepływ") rozłożony na pionowe plastry F-NN i S-NN,
każdy z wynikiem, odnośnikami PRD, zależnościami i ryzykiem.

**Obowiązuje jako plan pracy do dziś** — i jako jedyny artefakt, który sam siebie koryguje:
wpis S-03 nosi datowaną adnotację „Korekta zależności (13.09.2026)", bo po decyzji D14 wykluczenia
składnikowe wskazują na tabelę z F-01, więc S-03 przestało być równoległe do F-01.

### `context/archive/2026-08-31-account-and-login/` — pierwsza zmiana pełnym łańcuchem

Pierwsza zmiana przeprowadzona całym łańcuchem `new → plan → plan-review → implement →
impl-review → archive`: cztery `impl-review` plus `plan-review`, wszystkie z ustaleniami, wszystkie
posortowane.

**Obowiązuje jako wzorzec odniesienia.** Kształt trasy `+api.ts`, warstwa repozytorium filtrująca
po `userId`, `requireUserId` zwracające `Response` zamiast rzucać — wszystko to powstało tutaj
i jest dziś kopiowane przy każdej nowej trasie.

## Czego z tego łańcucha NIE da się dziś sprawdzić

Uczciwie, bo brief bez tej sekcji byłby autoreklamą:

- **Nie wiem, która lekcja wprowadziła który skill.** Patrz wyżej — repo tego nie zapisuje.
- **Nie wiem, jak wyglądał proces.** Artefakt pokazuje wynik rozmowy odkrywczej, nie rozmowę.
  Czy `/10x-shape` zadawał dobre pytania, czy użytkownik i tak wiedział, co chce — tego z `prd.md`
  nie odczytam.
- **Nie wiem, co zostało odrzucone po drodze**, poza tym, co ktoś świadomie zapisał
  (`infrastructure.md` ma rejestr odrzuconych platform; `shape-notes.md` nie ma rejestru
  odrzuconych wymagań).

## Co z tego zabieram

1. **Wyzwanie sokratejskie przy wymaganiu jest najtańszą rzeczą w całym łańcuchu i najdłużej
   pracuje.** Jedno zdanie dopisane do FR-004 na etapie wymagań rozstrzygnęło dziś kształt tabeli
   w bazie — dwa tygodnie i trzy zmiany później.
2. **Artefakt, który sam siebie datuje i koryguje, jest wart więcej niż artefakt „aktualny".**
   `roadmap.md` z adnotacją „Korekta zależności (13.09.2026)" mówi więcej niż cicho poprawiony
   wpis, bo widać, **co** się zmieniło i **dlaczego**.
3. **Decyzja zapisana z odrzuconymi opcjami przeżywa swojego autora.** `infrastructure.md` wyjaśnia,
   dlaczego nie ma własnej warstwy auth — i dzięki temu nikt nie zacznie jej budować „bo brakuje".
4. **Rejestr kompletny nie znaczy rejestr prawdziwy.** Sześć briefów o lekcjach, których nie
   widziałem, wyglądałoby lepiej w spisie treści i byłoby warte mniej niż ten jeden plik.
