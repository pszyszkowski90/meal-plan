# Brief: Moduł 5, Lekcja 3 — bramka jakości w CI

> Brief pisany po zbudowaniu i **uruchomieniu** bramki na prawdziwym pushu, 13.09.2026.
>
> **Sprostowanie z tego samego dnia — ważniejsze niż przy m3l5.** Pierwsza wersja twierdziła, że
> treści lekcji nie ma lokalnie. Nieprawda: materiał leżał w katalogu tymczasowym **poprzedniej**
> sesji (`scratchpad/lessons/m5l3.json`). Po przeczytaniu okazało się, że **lekcja jest o czymś
> węższym, niż zakładała kolejka i niż zbudowałem** — patrz sekcja „Czego ten brief NIE domyka".
> Zostawiam opis tego, co faktycznie zrobiłem, bo ma wartość sam w sobie, ale **nie nazywam już
> tej lekcji domkniętą**.

## Co lekcja wprowadza — z rzeczywistej treści

Lekcja nie jest o bramce `tsc` / lint / testy. Jest o **przeniesieniu agenta recenzującego
z Modułu 5 Lekcji 2 z localhosta na ścieżkę do produkcji**, przez GitHub Actions:

- **podstawy GHA** (workflow, wyzwalacz, job, krok, akcja, runner) i minimalny `review.yml`
  na każdym PR;
- wyodrębnienie agenta do **Composite Action**, żeby jeden agent pilnował wielu repozytoriów —
  **przypiętej do SHA, nie do ruchomego tagu**;
- podłączenie trzech realnych wejść (tytuł PR, opis, `git diff`) z ładunku wyzwalacza do `inputs`
  akcji;
- zamiana miękkiego wyniku w **twarde Definition of Done**: bramka scalania plus etykiety
  `ai-cr:passed` / `ai-cr:failed`;
- zestawienie ścieżki „zbuduj sam" z **Claude Code Action** Anthropica (gotowy recenzent sterowany
  promptem);
- **promptfoo** do ewaluacji zmian promptu i modelu na stałym zbiorze przypadków
  (asercje `is-json`, `llm-rubric`, `javascript`) zamiast oceniania „na oko" jednego PR-a;
- **drabina sprawczości** — od jednorazowego oceniacza po prawdziwą pętlę narzędziową;
- Deep Dive: skill **`10x-impl-review-ci`**, uruchamiany na runnerze GHA.

Wątek, który faktycznie zbudowałem — bramka jakości jako warstwa, **której nie da się pominąć** —
jest w lekcji **fundamentem**, nie tematem. Lokalne hooki da się obejść (`--no-verify`, świeży klon
bez `npm run hooks:install`, push z innej maszyny), a CI widzi każdy commit niezależnie od tego,
co było zainstalowane na maszynie autora. To prawda i to działa, ale to punkt wyjścia lekcji,
a nie jej sedno.

## Co powstało w MealPlanie

[`.github/workflows/quality-gate.yml`](../.github/workflows/quality-gate.yml) — push i PR do
`main`, sześć kroków: `npm ci`, `tsc --noEmit`, `expo lint`, `npm test`, `check-conventions`,
`check-lock`. Czas przebiegu: **1 min 10 s**.

Po tej zmianie repo ma cztery warstwy bramek. Trzy pierwsze są lokalne (hook po edycji,
`pre-commit`, `pre-push`), czwarta jest zdalna.

## Trzy rozstrzygnięcia, o które prosiła lekcja

### 1. Bramka nie wdraża

Wdrożeniem zajmuje się Cloudflare Workers Builds, podpięty osobno do `main`. Dwa niezależne
wdrożenia tego samego commita to wyścig o to, które nadpisze drugie, i dwa miejsca, w których
trzeba trzymać sekrety. **To są dwie różne rzeczy podpięte do tej samej gałęzi:** bramka nie
wdraża, a Workers Builds nie uruchamia lintu ani testów. Wcześniej to drugie znaczyło, że
na produkcję szedł kod, którego nikt automatycznie nie sprawdził.

### 2. `npm ci` na Linuksie jest najlepszym możliwym testem lockfile'a

To jest teza lekcji, która w tym repo ma twarde poparcie. `npm install` uruchomiony na Windowsie
psuje `package-lock.json` w sposób **niewidoczny lokalnie**: zapisuje wpisy pakietów `*-wasm32*`
bez ich zależności `@emnapi/*`, bo `cpu: ["wasm32"]` nie pasuje do hosta. `npm ci` na Linuksie
przerywa wtedy z `EUSAGE`.

Przed tą zmianą taki błąd wychodził dopiero w Workers Builds — czyli **po** wypchnięciu na `main`,
gdy wdrożenie już trwało. Teraz wychodzi na pull requeście. Krok `check-lock` został mimo
nadmiarowości (padłby już `npm ci`), bo jego komunikat mówi **który** pakiet jest zepsuty i jak to
naprawić, a `npm ci` rzuca samo `EUSAGE`.

### 3. E2E nie wchodzi — świadome ograniczenie

Playwright mieszka poza `package.json`, bo `npm install` psuje tu lockfile. Wciągnięcie go do
zależności tylko po to, żeby CI miało testy przeglądarkowe, złamałoby **dokładnie tę regułę,
której ta bramka pilnuje**. Testy E2E zostają uruchamiane z ręki, a bramka tego nie udaje.

## Czego bramka nauczyła mnie w pierwszej minucie działania

**Pierwszy przebieg padł** — na kroku `Typy`, z dwoma błędami o `.css`
(`animated-icon.module.css`, `@/global.css`).

To nie był błąd konfiguracji CI. To był **realny problem repozytorium, którego trzy lokalne
warstwy nie mogły wykryć z zasady**: deklaracje modułów `.css` przychodziły wyłącznie
z `expo-env.d.ts`, który jest w `.gitignore` i powstaje przy pierwszym `npm start`. Każda maszyna
deweloperska ma go od dawna, więc lokalnie typecheck zawsze był zielony. Runner startuje
ze świeżego klonu i go nie ma.

Ten sam błąd widziałem godzinę wcześniej w świeżym `git worktree` i potraktowałem jako lokalną
niedogodność do obejścia (skopiowałem pliki). **Dopiero CI pokazało, że to nie niedogodność,
tylko dziura w reprodukowalności projektu.** Naprawa: [`expo-types.d.ts`](../expo-types.d.ts) —
jedna linijka `reference` do `expo/types`, trzymana w repozytorium. Typecheck przechodzi teraz
wszędzie: świeży klon, worktree, runner.

To jest najcenniejsza rzecz z tej lekcji i nie da się jej zaplanować: **bramka na czystej
maszynie natychmiast znajduje wszystko, co po cichu zależy od stanu lokalnego.**

## Znane ograniczenie: `tsc` w CI jest słabszy niż lokalnie

Zmierzone, nie założone. `.expo/types/router.d.ts` z typami tras też jest w `.gitignore`
i powstaje **wyłącznie** przy uruchomieniu Metro — `expo export` go nie tworzy (sprawdziłem,
usuwając plik i uruchamiając eksport). Bez niego `Href` degraduje się do typu ogólnego
i **nieistniejąca ścieżka w `<Link href>` przestaje być błędem typu**.

Sonda: plik z `href="/nie-ma-takiej-trasy-zupelnie"` daje lokalnie `TS2322`, a po usunięciu
`.expo/types` przechodzi na zielono. Czyli `typedRoutes` — reklamowany w `CLAUDE.md` jako
zabezpieczenie typem — na runnerze **milczy**.

Nie obchodzę tego. Jedyne wyjścia to podnoszenie Metro na runnerze (wolne i kruche) albo
commitowanie wygenerowanego pliku, który rozjedzie się z trasami i zacznie kłamać w drugą stronę.
Tej klasy błędu pilnuje więc warstwa 3 — `pre-push` na maszynie, gdzie Metro już chodziło.
Ograniczenie jest zapisane w komentarzu workflow i w `CLAUDE.md`, żeby nikt nie liczył na ochronę,
której nie ma.

## Jak sprawdziłem, że bramka naprawdę się wykonuje

Reguła z `lessons.md`: nowej bramki nie uznaje się za działającą, zanim nie zobaczy się jej
**czerwonej po celowym zepsuciu**. Zielony przebieg na czystym drzewie niczego nie dowodzi.

Tu pojawił się problem, który sam w sobie jest ciekawy: **nie dało się wypchnąć zepsutej gałęzi
z tej maszyny.** Błąd lintu zatrzymuje `pre-commit`, błąd typu zatrzymuje `pre-push`,
a `--no-verify` jest w tym projekcie zakazany. Warstwy lokalne działają na tyle dobrze, że
uniemożliwiają przetestowanie warstwy zdalnej normalną drogą.

Rozwiązanie okazało się trafniejsze niż obejście hooków: commit powstał **przez API GitHuba**,
czyli dokładnie tak, jak wyglądałby push z maszyny bez zainstalowanych hooków — a więc
w scenariuszu, dla którego ta bramka w ogóle istnieje. Pull request #1, plik przypisujący string
do `number`.

Wynik: krok **Typy** na czerwono z `Type 'string' is not assignable to type 'number'`, kolejne
kroki nie ruszyły. PR zamknięty bez scalania, gałąź skasowana.

## Co zabieram

1. **Bramka na czystej maszynie jest testem reprodukowalności, nie tylko jakości kodu.** Pierwszy
   czerwony przebieg wskazał zależność od gitignorowanego artefaktu, której żadna lokalna warstwa
   nie mogła zobaczyć.
2. **Nazwij, czego bramka NIE sprawdza.** Bramka, o której się myśli, że pilnuje wszystkiego,
   jest gorsza niż żadna — tutaj nie pilnuje typów tras i nie uruchamia E2E, i jedno i drugie
   jest zapisane.
3. **Dobrze zrobione warstwy lokalne utrudniają testowanie warstwy zdalnej.** Droga wyjścia to
   odtworzyć warunki, dla których zdalna warstwa powstała — nie wyłączyć lokalne.

## Czego ten brief NIE domyka — dopisane po przeczytaniu treści lekcji

Uczciwie: **wykonałem fundament lekcji, nie jej temat.** Zbudowana bramka uruchamia `npm ci`,
`tsc`, `expo lint`, `npm test`, `check-conventions` i `check-lock` — czyli **deterministyczne
narzędzia**. Lekcja uczy wpięcia w to miejsce **agenta recenzującego** i wszystkiego, co z tego
wynika. Nie zrobione zostało:

| Element lekcji | Stan |
|---|---|
| Agent recenzujący w pipeline | **nie** — wymaga artefaktu z m5l2, świadomie pominiętego |
| Composite Action przypięta do SHA | **nie** — mam jeden workflow, nie akcję wielokrotnego użytku |
| Wejścia z ładunku PR (tytuł, opis, diff) | **nie** — bramka nie czyta diffa |
| DoD: bramka scalania + etykiety `ai-cr:*` | **częściowo** — bramka blokuje, ale bez etykiet i bez oceny |
| promptfoo na stałym zbiorze przypadków | **nie** — nie ma promptu do ewaluacji |
| Skill `10x-impl-review-ci` na runnerze | **nie** — skill jest zainstalowany i nieużyty |

**Skill `10x-impl-review-ci` leży w `.claude/skills/` i jest nieużyty.** To najtańsza droga
do domknięcia tej lekcji: uruchamia przegląd implementacji nieinteraktywnie na PR, zapisuje raport
do `context/changes/<id>/reviews/` i komentuje PR. W przeciwieństwie do agenta z m5l2 **nie
wymaga nowych zależności w `package.json`**, czyli nie łamie reguły lockfile'a, która wykluczyła m5l2.

**Zostaje jako rekomendacja, nie jako zrobione.** Warunek jest ten sam, co przy m5l2: przegląd musi
być realnym wąskim gardłem. Przy jednej osobie i jedenastu przeglądach w historii projektu nie jest.
