# Harness E2E — jak go uruchomić

Testy leżą tutaj i są wersjonowane. **Playwright i poświadczenia leżą poza repozytorium.**
To nie jest wygoda, tylko konsekwencja dwóch twardych ograniczeń projektu.

## Dlaczego Playwright jest poza `package.json`

`npm install` w tym repo psuje `package-lock.json` na Windowsie: zapisuje wpisy pakietów
`*-wasm32*` bez ich zależności `@emnapi/*`, bo `cpu: ["wasm32"]` nie pasuje do hosta. `npm ci`
na Linuksie przerywa wtedy z EUSAGE i build w Workers Builds nie dochodzi nawet do `expo export`.
Dodanie Playwrighta do zależności projektu wywróciłoby więc wdrożenie. Konfiguracja i
`node_modules` harnessu mieszkają w osobnym katalogu, a `testDir` wskazuje z powrotem tutaj.

Skutek uboczny: `tests/` jest wyłączone z `tsconfig.json` (pole `exclude`). Bez tego
`npx tsc --noEmit` — główna bramka jakości repo — świeciłby na czerwono dwudziestoma błędami
„Cannot find module `@playwright/test`", bo tego pakietu w `node_modules` projektu nie ma i być
nie może. Typy specyfikacji sprawdza więc dopiero uruchomienie Playwrighta, nie typecheck repo.

## Dlaczego poświadczenia są poza repo

Przegląd fazy 1 odnotował jako ustalenie **krytyczne**, że hasło w postaci jawnej i 19 artefaktów
narzędzia E2E trafiły do commitu. Hasła, którego nie ma w drzewie repozytorium, nie da się
zacommitować — dlatego `.env` harnessu i katalog `test-results/` leżą poza repo, a specyfikacje
czytają wyłącznie zmienne środowiskowe i **krzyczą czytelnym błędem**, gdy ich brakuje.
Nie dopisuj poświadczeń do żadnego pliku w tym katalogu.

## Konfiguracja jednorazowa

```sh
mkdir "$HOME/.mealplan-e2e" && cd "$HOME/.mealplan-e2e"
npm init -y
npm i -D @playwright/test dotenv
npx playwright install chromium
```

Do `playwright.config.ts` w tym katalogu wstaw konfigurację wskazującą `testDir` na
`<repo>/tests/e2e` (wzorzec: patrz sekcja „Co konfiguracja musi ustawić" niżej), a obok niej
załóż plik `.env`:

```
MEALPLAN_E2E_EMAIL=<konto testowe instancji development Clerka>
MEALPLAN_E2E_PASSWORD=<hasło>
MEALPLAN_E2E_CODE=<stały kod weryfikacyjny konta +clerk_test>
```

## Uruchomienie

```sh
# 1. Zbuduj i podnieś aplikację w docelowym runtime (w katalogu repo):
npx expo export -p web
npx wrangler dev --port 8787

# 2. Uruchom testy (w katalogu harnessu):
NODE_PATH="$HOME/.mealplan-e2e/node_modules" npx playwright test
```

`NODE_PATH` jest **wymagany**: specyfikacje leżą w repo, więc Node szukałby `@playwright/test`
w `node_modules` projektu i go nie znalazł.

Konfiguracja ma `reuseExistingServer: true`, więc podniesiony ręcznie `wrangler dev` zostanie
użyty; bez niego Playwright podniesie własny.

## Co konfiguracja musi ustawić — dwie pułapki

1. **`baseURL` to `http://localhost:8787`, nigdy `http://127.0.0.1:8787`.**
   `src/server/auth.ts` porównuje roszczenie `azp` tokenu z listą `AUTHORIZED_PARTIES` jako
   **łańcuch znaków**, a lista zawiera `http://localhost:8787`. Przeglądarka pod `127.0.0.1`
   wysyła `azp: "http://127.0.0.1:8787"`, które do listy nie pasuje — i **każde uwierzytelnione
   żądanie dostaje 401 bez żadnej wskazówki**. Objaw: logowanie przechodzi, bramka wpuszcza,
   a ekran pokazuje „Serwer odrzucił żądanie (401)". `CLAUDE.md` ostrzega przed dokładnie tym.

2. **`wrangler dev` trzyma otwarte `dist/client`.** `npx expo export -p web` przerwie wtedy
   z `EBUSY: resource busy or locked`. Zatrzymaj serwer przed przebudową — inaczej testy pojadą
   przeciw **staremu** buildowi i wynik nic nie znaczy. To realnie zdarzyło się przy budowie
   tego harnessu: próba celowego zepsucia „przeszła na zielono", bo zepsucie nigdy nie trafiło
   na serwer.

## Co jest pokryte

Numery ryzyk odsyłają do `context/foundation/test-plan.md` §2.

| Plik | Ryzyko | Czego pilnuje |
|---|---|---|
| `seed.spec.ts` | #7 | Wzorzec dla kolejnych testów + kontrakt wdrożeniowy: HTML, `d1:true`, 404 dla nieznanej ścieżki |
| `session-gate.spec.ts` | #2 | Niezalogowany nie wchodzi; sesja przeżywa przeładowanie strony; wylogowanie odsyła na logowanie |
| `data-boundary.spec.ts` | #1 | Trasy danych odmawiają bez tożsamości i przy podrobionym tokenie, i nic nie oddają |
| `auth.setup.ts` | — | Infrastruktura: loguje się raz i zapisuje sesję poza repo |

**Czego NIE pokrywa:** pełnego dowodu izolacji między dwoma kontami (potrzebne drugie konto —
faza 3 wdrożenia z planu testów) oraz całej ścieżki profilu, która nie jest jeszcze zbudowana.

## Lokatory — dlaczego nie `getByRole`

Ekran logowania renderuje React Native Web. Pola `input` nie mają `id`, `name`, `placeholder`
ani `aria-label` — jedynym stabilnym rozróżnikiem jest `autocomplete`. Przyciski to `div`-y
z `tabindex`, bez `role="button"`. Nagłówków nie ma wcale. `getByRole('button', { name })`
nie znajduje więc niczego.

To jest **luka dostępności w aplikacji**, nie cecha testów: czytnik ekranu przeczyta ten formularz
jako dwa nienazwane pola i cztery nieklikalne napisy. Do czasu jej naprawy wszystkie obejścia
siedzą w jednym pliku — `support/sign-in.ts`. Gdy komponenty dostaną role i nazwy, to jedyne
miejsce do zmiany.
