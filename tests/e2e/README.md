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
MEALPLAN_E2E_EMAIL=<konto A instancji development Clerka>
MEALPLAN_E2E_PASSWORD=<hasło konta A>
MEALPLAN_E2E_CODE=<stały kod weryfikacyjny kont +clerk_test>
MEALPLAN_E2E_EMAIL_B=<konto B — istnieje wyłącznie dla dowodu izolacji>
MEALPLAN_E2E_PASSWORD_B=<hasło konta B>
```

`MEALPLAN_E2E_CODE` jest **wspólny dla obu kont**: oba używają adresu `+clerk_test`, który
w instancji development przyjmuje ten sam stały kod. Druga zmienna byłaby kopią tej samej
wartości i jeszcze jednym miejscem do rozjazdu.

### Jak założyć konto B

**Nie przez sterowaną przeglądarkę.** Ekran `/sign-up` montuje Smart CAPTCHA Clerka
(Cloudflare Turnstile), a ta w Chromium sterowanym przez Playwrighta **nigdy się nie kończy** —
żądanie rejestracji nie wychodzi w ogóle, bez błędu na ekranie i bez wpisu w konsoli. Sprawdzone
14.09.2026 zarówno headless, jak i z oknem.

Droga, która działa: **rejestracja z klienta natywnego** (emulator Androida, Expo Go), gdzie
Clerk pomija krok CAPTCHA. Adres z `+clerk_test` weryfikuje się stałym kodem, bez skrzynki
pocztowej. Poświadczenia wpisz do `.env` harnessu — **nigdy do repozytorium**.

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
| `profile-api.spec.ts` | #4, #6 | Kontrakt profilu po HTTP z pominięciem UI — kryteria fazy 2: 2.6, 2.7, 2.8 |
| `profile-screen.spec.ts` | #4, #6, #3 | Formularz profilu w przeglądarce — kryteria fazy 3: 3.7–3.11, 3.13 |
| `account-isolation.spec.ts` | #1 | **Dwa konta naraz**: B nie widzi wykluczeń A ani ich nie nadpisuje — przez ekran i z pominięciem UI (kryterium 1.6 S-03, 2.9 S-02) |
| `preferences-api.spec.ts` | #1, #6 | Kontrakt preferencji po HTTP — kryteria fazy 1: 1.4, 1.5 |
| `preferences-screen.spec.ts` | #3 | Ekran preferencji w przeglądarce — kryteria fazy 2: 2.5–2.8 |
| `auth.setup.ts` | — | Infrastruktura: loguje się raz i zapisuje sesję poza repo |

**Czego NIE pokrywa:** ~~izolacji między dwoma kontami~~ — pokryte od 14.09.2026 przez
`account-isolation.spec.ts`; stanu „konto bez zapisanego profilu" (2.5 — konto A profil ma,
a konto B jest zajęte dowodzeniem izolacji); **warstwy natywnej** (3.12 — Expo Go, klawiatury
liczbowe, ikona zakładki), którą sprawdza się ręcznie na emulatorze; oraz **wąskich szerokości** —
projekt `chromium` jedzie na `Desktop Chrome` 1280 px, więc żaden test nie patrzy na układ przy
400 px. To nie jest teoretyczna luka: dokładnie tam siedział defekt obcinania treści, znaleziony
dopiero ręcznym zrzutem przy kryterium 2.10.

## Dlaczego jeden worker

`workers: 1` i `fullyParallel: false` są **celowe**. Wiersz profilu i wiersz preferencji konta A
są zasobem współdzielonym przez cały zestaw: `profile-api` i `profile-screen` piszą do tego samego
rekordu, `preferences-api` i `preferences-screen` do drugiego. Przy przebiegu równoległym zestaw
sypał się losowo mniej więcej raz na dwa uruchomienia, zawsze w innym miejscu. `retries` zamiotłyby
ten wyścig pod dywan — a wyścig jest prawdziwy.

**Drugie konto tego nie zmienia** — i to jest pułapka warta zapisania. Konto B powstało 14.09.2026,
ale istnieje po to, żeby udowodnić izolację, a nie żeby rozłożyć na dwa konta testy, które i tak
piszą do konta A. Równoległość wymagałaby konta **na plik**, a nie jednego zapasowego.

## Pułapka: oba ekrany zakładek są zamontowane naraz

Nawigacja na Home **nie odmontowuje** ekranu profilu. Ta sama liczba stoi więc jednocześnie
w karcie celu („2759 kcal") i w podglądzie profilu („= 2759 kcal dziennie"), a luźne dopasowanie
tekstem trafia w oba i daje naruszenie trybu ścisłego Playwrighta — co wygląda jak brak elementu,
a jest kolizją lokatora. Asercje dotyczące karty celują więc w dokładną formę albo w link karty.

## Pułapka: początkowe pobranie nadpisuje wpisane wartości

Ekran profilu robi jedno `GET /api/profile` przy wejściu i wypełnia pola tym, co wróci. Jeśli
pisanie zacznie się przed odpowiedzią, **odpowiedź nadpisuje wpisane znaki**. W testach rozwiązuje
to `openProfile()` z `support/profile-form.ts`, które czeka na odpowiedź przed wpisywaniem.
W aplikacji zachowanie zostaje — na wolnym łączu użytkownik może stracić pierwsze znaki.

## Lokatory — dlaczego nie `getByRole`

Ekran logowania renderuje React Native Web. Pola `input` nie mają `id`, `name`, `placeholder`
ani `aria-label` — jedynym stabilnym rozróżnikiem jest `autocomplete`. Przyciski to `div`-y
z `tabindex`, bez `role="button"`. Nagłówków nie ma wcale. `getByRole('button', { name })`
nie znajduje więc niczego.

To jest **luka dostępności w aplikacji**, nie cecha testów: czytnik ekranu przeczyta ten formularz
jako dwa nienazwane pola i cztery nieklikalne napisy. Do czasu jej naprawy wszystkie obejścia
siedzą w jednym pliku — `support/sign-in.ts`. Gdy komponenty dostaną role i nazwy, to jedyne
miejsce do zmiany.
