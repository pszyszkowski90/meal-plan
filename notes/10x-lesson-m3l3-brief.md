# Brief: Moduł 3, Lekcja 3 — Hooki i wyzwalacze: agent, który sam reaguje na błędy

> **Hooks and Triggers: An Agent That Reacts to Errors on Its Own**
> Brief pisany po zbudowaniu trzech warstw bramek w tym repo (13.09.2026), nie ze streszczenia.

## Co lekcja wprowadza

Zamienia bramki jakości z lekcji 1 i testy z lekcji 2 w **automatyczne, deterministyczne**
sprawdzenia odpalane w trakcie pracy agenta. Rdzeniem jest uniwersalny cykl hooka —
**wyzwalacz → matcher → handler → sygnał** — i to, że hook `PostToolUse` oddaje swój wynik
**z powrotem do kontekstu agenta**: kod wyjścia 0 / 2 / inny, `stdout` przez `additionalContext`.
Agent poprawia własną literówkę w następnej iteracji, zamiast dowiadywać się o niej z czerwonego
buildu kilkanaście minut później.

Model lokalnej jakości budowany jest warstwami: hooki po edycji (lint, format, testy zawężone do
ruszonego pliku), bramka `pre-commit` nad indeksem, `pre-push` na cięższe sprawdzenia. Każda warstwa
łapie to, co przepuściła poprzednia, i **wszystkie stoją przed CI, nie zamiast niego**. Zamknięcie
to przenośność: ten sam wzorzec działa w Cursorze, Codeksie, Windsurfie i Copilocie, a różnicuje
je wstrzykiwanie kontekstu — Windsurf potrafi zablokować, ale nie potrafi powiedzieć agentowi
dlaczego.

## Co z tego dotyczy MealPlana

Zbudowane i zweryfikowane w repo:

| Warstwa | Kiedy | Co robi | Zmierzony koszt |
| --- | --- | --- | --- |
| 1 | po każdej edycji pliku | reguły repo na tym jednym pliku | 0,15 s |
| 2 | `git commit` | reguły repo + `eslint --max-warnings=0` na indeksie, `npm test` gdy ruszony `src/lib/`, `check-lock` gdy ruszone zależności | ~10 s |
| 3 | `git push` | reguły repo, `tsc --noEmit`, `npm test`, `check-lock` | ~12 s |

Cztery miejsca, w których to repo **odeszło od lekcji** — każde z powodu, nie z gustu:

**1. W warstwie 1 nie ma lintu ani typów.** Lekcja radzi lintować po każdej edycji. Zmierzone tutaj:
jedno wywołanie `eslint` na pojedynczym pliku to **7,9 s**, `tsc --noEmit` — **9,3 s**. Hook blokuje
agenta na czas działania, więc ten koszt zszedł do warstw 2 i 3. W warstwie 1 stanął
[`check-conventions.js`](../scripts/check-conventions.js) — 39 plików w **0,135 s**.

**2. Najcenniejsze sprawdzenia nie są regułami języka.** `eslint` i `tsc` nie wiedzą, że SQL wolno
pisać tylko w [`src/server/repository/`](../src/server/repository/), że `globalThis` ma jedno
miejsce w repo, że zakładka dodana w `app-tabs.tsx` musi mieć parę w `app-tabs.web.tsx` i że każda
migracja potrzebuje pary w `migrations/down/`. To są zdania z `CLAUDE.md` — czyli reguły, które
dotąd żyły wyłącznie jako prośba do czytającego. Osiem reguł na plik i trzy na repozytorium jest
dziś **wykonywalnych**.

**3. Bez Lefthooka i Husky'ego.** Obie paczki wymagają `npm install`, a to w tym repo psuje
`package-lock.json` w sposób niewidoczny lokalnie. Hooki to więc `git config core.hooksPath hooks`
i dwie linijki `sh` wołające [`git-gate.mjs`](../scripts/hooks/git-gate.mjs) — zero nowych
zależności. Cena: aktywacja jest jawna i per klon (`npm run hooks:install`), bo `core.hooksPath`
nie przenosi się z repozytorium.

**4. Naiwny `grep` kłamie w obie strony i to nie jest teoria.** Pierwsza wersja reguł działała na
surowym tekście. Wynik: `profile+api.ts` zapalał się na komentarzu „Zero `prepare(`", a **wszystkie
trzy** wystąpienia `useCallback` w tym repo to komentarze tłumaczące, czemu go nie ma. Bramka
czerwona na czystym drzewie jest szumem, nie bramką — stąd skaner usuwający komentarze,
**zostawiający stringi** (reguła o surowych kolorach czyta właśnie stringi) i rozpoznający
literały wyrażeń regularnych, bo `/^Bearer (.+)$/` w `auth.ts` inaczej rozjeżdża parser.

## Najmocniejsza rzecz, jakiej ta lekcja tu nauczyła

**Bramka, która się nie uruchomiła, wygląda dokładnie jak bramka, która nic nie znalazła.**

Pierwszy przebieg `pre-commit` wypisał `FAIL eslint (0.0s)`. Wyglądało na złapany błąd. Naprawdę
`spawnSync` dostał `EINVAL`: Node 25 na Windowsie **odmawia** uruchomienia plików `.cmd` bez
`shell: true` (skutek poprawki CVE-2024-27980), a `npm` i `npx` są tam właśnie `.cmd`-ami. Krok
nie sprawdził niczego. Gdyby trafił w przeciwną stronę — na `exit 0` — bramka meldowałaby zieleń
przez tygodnie.

Dlatego `gate()` rozróżnia dziś dwa rodzaje porażki: **kod ≠ 0** („narzędzie znalazło problem")
od **`result.error`** („narzędzie się nie uruchomiło"), i wypisuje je inaczej. To jest ten sam
problem, co opisany w [lessons.md](../context/foundation/lessons.md) EBUSY — zielony wynik testu,
który nigdy nie dotarł do serwera. Dwa różne narzędzia, jeden tryb awarii: **dowód, którego nie
było, wygląda jak dowód pozytywny**.

Konsekwencja dla dyscypliny: każda z jedenastu reguł i każda z trzech warstw została sprawdzona
**celowym zepsuciem** — plik z `../`, z `globalThis`, z `.prepare(`, zakładka usunięta tylko
z wersji webowej, schowana migracja wstecz, plik z ostrzeżeniem lintu. Dopiero po zobaczeniu
czerwieni uznałem je za działające. To jest testowanie mutacyjne z lekcji 2, zastosowane do samych
bramek.

Drugi wniosek tej samej klasy: `eslint` domyślnie **kończy się zerem mimo ostrzeżeń**. Bramka,
która widzi problem i przepuszcza commit, jest gorsza niż jej brak — stąd `--max-warnings=0`,
możliwe dlatego, że całe `src/` przechodzi dziś bez ani jednego ostrzeżenia.

## Co warto zastosować dalej

- **Warunek przyjęcia nowej reguły:** całe obecne drzewo musi ją przechodzić. Inaczej reguła rodzi
  się z długiem, a bramka uczy się ignorowania. Dwa wyjątki, które musiałem wpisać (`#3c87f7`
  w `themed-text.tsx`, gradient splashu w `animated-icon.tsx`), są kodem ze scaffoldu Expo
  i **są w kodzie nazwane jako taki dług**, a nie schowane.
- **Reguła architektoniczna, której nikt nie sprawdza, jest prośbą, nie regułą.** Kandydaci
  na kolejne wpisy w `check-conventions.js`: `ThemedText`/`ThemedView` zamiast `Text`/`View`,
  `BottomTabInset` w ekranach przewijalnych, importy `Spacing` zamiast liczb.
- Warstwa 1 **nie działa w sesji, która ją utworzyła** — Claude Code czyta hooki przy starcie.
  Pierwszy realny przebieg nastąpi w następnej sesji; dziś zweryfikowany został sam handler,
  podaniem mu na `stdin` takiego JSON-a, jaki dostaje od Claude Code (cztery przypadki: plik
  czysty, plik spoza `src/`, naruszenie → wyjście 2, zepsuty JSON → wyjście 0).

## Czego lekcja NIE robi

Nie zastępuje CI — Workers Builds na `main` zostaje ostatnią bramką, a te trzy warstwy tylko
sprawiają, że rzadko coś do niej dociera. Nie sprawdza semantyki: `check-conventions` mówi „ten
plik łamie regułę", nigdy „ten kod jest błędny" — od tego są testy z lekcji 2 i przegląd z m2l3.
I nie rozwiązuje problemu, którego dotknąłem po drodze: hook nie wie, że w tym samym drzewie
pracuje druga sesja. Bramka pilnuje treści, nie właścicielstwa.
