# MealPlan

Aplikacja do planowania posiłków: na podstawie danych sylwetkowych i celu wylicza dzienne
zapotrzebowanie kaloryczne, a następnie układa z niego plan posiłków, który mieści się
w wykluczeniach żywieniowych i w zadeklarowanym czasie gotowania.

Jedna baza kodu na trzy platformy — iOS, Android i web renderowany po stronie serwera:
**Expo SDK 57 / React Native 0.86 / React 19.2**, TypeScript, Expo Router. Backend to
**Cloudflare Worker** z bazą **D1**, tożsamość prowadzi **Clerk**.

Produkcja: <https://meal-plan.kurs-ai-szysza.workers.dev>

## Twarde ograniczenia produktowe

Cztery reguły są **ograniczeniami, nie preferencjami** — złamanie którejkolwiek to błąd, nie
kompromis. Pełny zakres w [context/foundation/prd.md](context/foundation/prd.md).

1. **Suma kalorii dnia mieści się w ±10% wyliczonego celu.** Dotyczy też pojedynczej podmiany dania.
2. **Żaden posiłek nie zawiera pozycji z listy wykluczeń użytkownika.** Wykluczenia z preferencji
   i oznaczenia dań z planu zasilają **jedną** listę, nie dwa mechanizmy.
3. **Żaden posiłek nie przekracza zadeklarowanego maksymalnego czasu przygotowania.**
4. **Gdy planu nie da się ułożyć w tych granicach** — aplikacja zwraca błąd nazywający, którego
   z trzech ograniczeń nie da się spełnić, i **nie zwraca planu ani planu częściowego**.

## Co działa dziś

| Obszar | Stan |
| --- | --- |
| Rejestracja, logowanie, Google SSO, reset hasła | Clerk; bramki sesji w `src/app/(app)` i `src/app/(auth)` |
| Profil sylwetkowy (odczyt i zapis) | ekran `/profile` + `GET`/`PUT` `/api/profile` |
| Cel kaloryczny | liczony przy odczycie w [src/lib/calorie-target.ts](src/lib/calorie-target.ts), **nie utrwalany** — ten sam moduł wykorzysta generator planu |
| Walidacja dań i makra | [dish-macros.ts](src/lib/dish-macros.ts), [dish-validation.ts](src/lib/dish-validation.ts) (sito Atwatera) |
| Pula dań, generator planu | w toku — patrz [context/changes/](context/changes/) |

## Uruchomienie lokalne

**Zależności instaluj wyłącznie przez `npm ci`.** `npm install` psuje tu `package-lock.json`
na Windowsie w sposób niewidoczny lokalnie, a wywraca build na Linuksie — szczegóły
i sprawdzenie w [scripts/check-lockfile.js](scripts/check-lockfile.js).

```sh
npm ci
npm run hooks:install     # bramki jakości na commit i push (per klon, jawnie)
npm start                 # Expo — web, iOS, Android
```

Dwa pliki z sekretami, oba w `.gitignore`:

| Plik | Klucz | Po co |
| --- | --- | --- |
| `.env.local` | `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | klient Clerka (web i natywny) |
| `.env.local` | `EXPO_PUBLIC_API_URL` | **tylko klient natywny w dev** — adres `wrangler dev` w LAN-ie; bez niego aplikacja rzuca czytelny błąd zamiast cicho pisać do produkcyjnej bazy |
| `.dev.vars` | `CLERK_JWT_KEY` | klucz publiczny PEM, którym Worker weryfikuje podpis tokenu (w produkcji: `wrangler secret`) |

Lokalna baza D1 (katalog `.wrangler/state`, używa jej `wrangler dev`):

```sh
npx wrangler d1 migrations apply mealplan --local
```

`npx expo start --web` uruchamia trasy API w Node, **nie** w workerd — wierność środowiska
produkcyjnego daje wyłącznie `npx wrangler dev` na zbudowanym `dist/`.

## Testy i bramki jakości

```sh
npx tsc --noEmit          # typy
npm test                  # 81 testów jednostkowych (node --test, zero zależności)
npm run check-conventions # reguły repo, których nie łapie eslint ani tsc
npm run check-lock        # spójność package-lock.json — po każdej zmianie zależności
npm run lint              # expo lint
```

`npm test` obejmuje **czyste moduły** z [src/lib/](src/lib/) — logikę celu kalorycznego, makr
i walidacji dań.

Testy przeglądarkowe (Playwright) leżą w [tests/e2e/](tests/e2e/), ale **Playwright nie jest
zależnością tego repozytorium** — mieszka poza nim, bo `npm install` psuje tu lockfile.
Instrukcja uruchomienia, poświadczenia i pułapki lokatorów:
[tests/e2e/README.md](tests/e2e/README.md).

Bramki lokalne (`hooks/pre-commit`, `hooks/pre-push`) uruchamiają ten sam zestaw przed commitem
i pushem; na pull requeście powtarza go
[quality-gate.yml](.github/workflows/quality-gate.yml) na Linuksie.

## Struktura

| Katalog | Co w nim jest |
| --- | --- |
| [src/app/](src/app/) | trasy Expo Routera: `(app)/` produktowe za bramką sesji, `(auth)/` logowanie, `api/` trasy serwerowe |
| [src/components/](src/components/) | komponenty, w tym prymitywy `ui/` oraz `ThemedText` / `ThemedView` |
| [src/lib/](src/lib/) | czysta logika domenowa i klient API — jedyne moduły z testami jednostkowymi |
| [src/server/](src/server/) | kod wyłącznie serwerowy: bindingi, weryfikacja tokenu, [repository/](src/server/repository/) — jedyne miejsce z SQL-em |
| [src/constants/](src/constants/) | motyw (kolory, odstępy, typografia) i adres API |
| [migrations/](migrations/) | numerowane migracje D1; `down/` to migracje wstecz uruchamiane ręcznie |
| [context/](context/) | dokumentacja projektu — patrz niżej |

Dostęp do danych użytkownika idzie **wyłącznie** przez `src/server/repository/`: każda funkcja
przyjmuje `userId` pierwszym argumentem i filtruje po nim w SQL-u. D1 nie ma RLS, więc to jedyna
izolacja między kontami — pilnuje jej `tests/e2e/data-boundary.spec.ts`.

## Deployment

Live at <https://meal-plan.kurs-ai-szysza.workers.dev> on Cloudflare Workers: static assets from
`dist/client`, pre-rendered HTML and API routes from `dist/server` via
`expo-server/adapter/workerd`, and a D1 database bound as `DB`.

`wrangler deploy` does **not** build, so the order matters:

```sh
npx expo export -p web                                # dist/client + dist/server
npx wrangler deploy --dry-run --outdir .wrangler-dry  # expect 6 modules, nothing from node_modules
npx wrangler dev                                      # workerd locally - the only faithful test
npx wrangler deploy                                   # production
```

`npx expo start --web` runs API routes in Node, not workerd, so it is not a deployment test.
Smoke check: `/` returns HTML, an unknown path returns 404, and `/api/health` returns
`{"ok":true,"d1":true}`.

Full record in [context/deployment/deploy-plan.md](context/deployment/deploy-plan.md); the platform
decision and its risk register are in
[context/foundation/infrastructure.md](context/foundation/infrastructure.md).

## Dokumentacja projektu

| Dokument | Co zawiera |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | reguły pracy w repozytorium — jedyne źródło konwencji, komend i pułapek |
| [context/foundation/prd.md](context/foundation/prd.md) | wymagania funkcjonalne i zakres MVP |
| [context/foundation/roadmap.md](context/foundation/roadmap.md) | kamienie milowe i pionowe wycinki |
| [context/foundation/tech-stack.md](context/foundation/tech-stack.md) | wybór stosu z uzasadnieniem |
| [context/foundation/infrastructure.md](context/foundation/infrastructure.md) | wybór platformy wdrożenia i rejestr ryzyk |
| [context/foundation/test-plan.md](context/foundation/test-plan.md) | mapa ryzyk i bramki jakości |
| [context/foundation/lessons.md](context/foundation/lessons.md) | reguły wyprowadzone z realnych awarii |
| [context/changes/](context/changes/) | zmiany w toku: kontekst, plan, przegląd |
| [context/archive/](context/archive/) | zmiany ukończone — katalog niezmienny |
