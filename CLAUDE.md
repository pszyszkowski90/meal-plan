# Repository Guidelines

MealPlan — aplikacja do planowania posiłków na Expo SDK 57 / React Native 0.86 / React 19.2:
TypeScript, Expo Router, jedna baza kodu na iOS, Androida i statyczny web. Backendu jeszcze nie ma —
patrz [tech-stack.md](context/foundation/tech-stack.md).

Ten plik jest jedynym źródłem reguł projektu; [AGENTS.md](AGENTS.md) tylko na niego wskazuje.
Nie przenoś treści do AGENTS.md: ta instalacja Claude Code nie wczytuje `AGENTS.md` i nie rozwija
importu `@AGENTS.md` — sprawdzone, reguły muszą fizycznie leżeć tutaj.

## Produkt: twarde ograniczenia

Pełny zakres jest w [prd.md](context/foundation/prd.md). Cztery rzeczy są **ograniczeniami, nie
preferencjami** — złamanie któregokolwiek to błąd, nie kompromis:

- Suma kalorii dnia mieści się w ±10% wyliczonego celu. Dotyczy też pojedynczej podmiany dania.
- Żaden posiłek nie zawiera pozycji z listy wykluczeń użytkownika.
- Żaden posiłek nie przekracza zadeklarowanego maksymalnego czasu przygotowania.
- Gdy planu nie da się ułożyć w tych granicach — zwróć błąd nazywający, którego z trzech ograniczeń
  nie da się spełnić, i nie zwracaj żadnego planu ani planu częściowego.

Wykluczenia z preferencji (FR-004) i oznaczenia dań z planu (FR-011) zasilają **jedną** listę
wykluczeń, nie dwa mechanizmy.

Poza zakresem MVP: dziennik jedzenia, śledzenie wagi, plan miesięczny, preferencje pozytywne
(FR-005), eksport listy zakupów (FR-015). Nie dokładaj ich „przy okazji".

**Blokada:** źródło przepisów i makr jest nierozstrzygnięte (Open Question 1 w PRD). Generator planu
i guardrail ±10% stoją na tej decyzji — nie implementuj generatora, zanim nie zapadnie.

## Twarde reguły

- **Expo się zmieniło.** Zanim napiszesz kod Expo, sprawdź wersjonowaną dokumentację
  <https://docs.expo.dev/versions/v57.0.0/> zamiast polegać na pamięci o starszych SDK.
- **Router mieszka w `src/app/`, nie w `app/`.** Nowy ekran = nowy plik w [src/app/](src/app/),
  np. `src/app/profile.tsx` → trasa `/profile`.
- **Nie dodawaj `useMemo` / `useCallback` / `React.memo`** — `reactCompiler` jest włączony
  ([app.json](app.json) → `experiments`) i memoizuje sam. `typedRoutes` też jest włączony:
  nieistniejąca ścieżka w `<Link href>` to błąd typu, nie runtime.
- **Dodanie zakładki znaczy edycję obu plików** — [app-tabs.tsx](src/components/app-tabs.tsx)
  (natywny) i [app-tabs.web.tsx](src/components/app-tabs.web.tsx) (web). Inaczej trasa istnieje,
  ale jest nieosiągalna na jednej z platform.
- **Nigdy nie uruchamiaj** `npm run reset-project` (przenosi kod startera do `app-example/`
  i zostawia puste `src/app/`) ani `npm audit fix --force` (cofa `expo` o kilka wersji major).
- **Nie commituj `/ios` ani `/android`** — to workflow zarządzany, konfiguracja natywna idzie przez
  [app.json](app.json) i pluginy. Nie zmieniaj w nim `slug` ani `scheme`.
- **Wdrożenie idzie wyłącznie przez `expo-server/adapter/workerd` + `assets.directory`.** `[site]`,
  Workers Sites, Cloudflare Pages oraz paczki `expo-adapter-workers` i `expo-workers` są **zakazane**
  w tym repo — uczą `[site] bucket`, zdeprecjonowanego w wrangler v4. Nie kopiuj konfiguracji
  z poradników o Pages.
- **Nie uruchamiaj `npm install` w tym repo — używaj `npm ci`.** `npm install` na Windowsie psuje
  `package-lock.json` w sposób niewidoczny lokalnie: zapisuje wpisy pakietów `*-wasm32*`
  (`@img/sharp-wasm32`, `@unrs/resolver-binding-wasm32-wasi`) bez ich zależności `@emnapi/*`, bo
  `cpu: ["wasm32"]` nie pasuje do hosta. `npm ci` na Linuksie przerywa wtedy z EUSAGE i build
  w Workers Builds nie dochodzi nawet do `expo export`. Po każdej zmianie zależności uruchom
  `npm run check-lock` — instrukcja naprawy jest w [check-lockfile.js](scripts/check-lockfile.js).
- **Nie ruszaj `rules` w [wrangler.jsonc](wrangler.jsonc) bez przeczytania komentarzy w pliku.**
  Każda z czterech reguł zapobiega konkretnej awarii: `CommonJS` (Metro emituje trasy API jako
  CommonJS — ESModule daje 500), `Text` (manifest i HTML), a `Data` / `CompiledWasm` istnieją **tylko**
  po to, by usunąć reguły domyślne, które inaczej zamiatają `node_modules` do bundla (8.9 MB, ponad
  limit planu darmowego). Usunięcie którejkolwiek psuje deploy.
- **Bindingi nie są w `process.env`.** Adapter workerd nie przekazuje `env` do tras API, więc D1
  i sekrety biorą się z [`getWorkerEnv()`](src/server/env.ts) — jedynego miejsca w repo, które dotyka
  `globalThis`. Nie powielaj tego wzorca w trasach.

## Struktura i konwencje

- [src/app/](src/app/) trasy, [src/components/](src/components/) komponenty
  (+ [ui/](src/components/ui/) prymitywy), [src/hooks/](src/hooks/) hooki,
  [src/constants/theme.ts](src/constants/theme.ts) motyw; `assets/` leży **poza** `src/`.
- Nazwy plików kebab-case (`themed-text.tsx`), nazwy eksportów PascalCase / camelCase.
- Importy przez aliasy: `@/*` → `src/*`, `@/assets/*` → `assets/*`. Względne `./` tylko dla
  rodzeństwa wewnątrz `src/components/` — tak robi cały starter (8 wystąpień, zero `../`).
  `../` w imporcie to błąd.
- **Zero surowych kolorów i odstępów w `StyleSheet`.** Kolor bierz z `useTheme()`, odstęp i promień
  z `Spacing` ([theme.ts](src/constants/theme.ts)) — to skala nazwana słownie (`half`=2, `one`=4 …
  `six`=64), nie liczby.
- **Tekst i tło przez `ThemedText` / `ThemedView`**, nie `Text` / `View`. Wariant wybiera prop
  `type` (`title`, `subtitle`, `small`, `code`, `link`… / `background`, `backgroundElement`,
  `backgroundSelected`), a nie własny styl inline.
- **`useColorScheme` bierz z [`@/hooks/use-color-scheme`](src/hooks/use-color-scheme.ts), nie
  z `react-native`.** Web renderuje się statycznie (`app.json` → `web.output: "static"`), więc
  wariant webowy odracza odczyt schematu do hydracji; hook z `react-native` daje niezgodność
  SSR/klient. Starter (`_layout.tsx`, `app-tabs.tsx`) importuje jeszcze wprost — nie powielaj tego.
- **Przewijalne ekrany same rezerwują `BottomTabInset + Spacing.*`** w `paddingBottom` /
  `contentInset`; dolny pasek nawigacji nie jest w layoucie flexbox. Bez tego ostatni element
  chowa się pod zakładkami.
- **Wariant platformowy = osobny plik `foo.web.tsx`**, gdy zmienia drzewo komponentów albo
  importowane API (jak `app-tabs`: `NativeTabs` vs `expo-router/ui`). Metro rozwiązuje `foo.web.tsx`
  przed `foo.tsx`. `Platform.OS` / `Platform.select` zostaw dla pojedynczej wartości — liczby,
  stringa, jednego stylu.

## Architektura

**Warstwa nawigacji jest rozdwojona.** [_layout.tsx](src/app/_layout.tsx) montuje jeden komponent
`AppTabs`, ale Metro podstawia inny plik na każdą platformę: natywnie `NativeTabs`
z `expo-router/unstable-native-tabs`, gdzie `NativeTabs.Trigger name` **musi** odpowiadać nazwie
pliku trasy; na webie headless `Tabs` / `TabList` / `TabTrigger` z `expo-router/ui`, gdzie `name`
jest dowolne, a wiąże `href`. Dlatego zakładka „Home" nazywa się tam `home`, a natywnie `index`.

**Motyw** jest jednokierunkowy: `Colors` (light/dark) → `useTheme()` → `ThemedText` / `ThemedView` →
ekrany. [theme.ts](src/constants/theme.ts) importuje [global.css](src/global.css) efektem ubocznym —
to stamtąd web bierze zmienne `--font-*`, na które wskazuje `Fonts`. Nie usuwaj tego importu przy
porządkach.

**Animacje** to Reanimated 4 z `Keyframe`, nie Animated API. Powrót z worklet do JS idzie przez
`scheduleOnRN` z `react-native-worklets` ([animated-icon.tsx](src/components/animated-icon.tsx)).
Splash: `SplashScreen.preventAutoHideAsync()` w layoucie, a `hideAsync()` woła dopiero `onLayout`
nakładki — kolejność jest celowa, przestawienie daje mignięcie.

**Backend stoi, ale jest pusty.** `web.output: "server"` produkuje `dist/client` (assets) i
`dist/server` (prerenderowany HTML + trasy API); `worker.ts` oddaje żądania adapterowi workerd,
a wszystko wisi na Cloudflare Workers z bazą D1 `mealplan` w bindingu `DB`. Jedyna trasa API to
[health+api.ts](src/app/api/health+api.ts) — smoke test wdrożenia, nie funkcja produktowa. **D1 nie ma
schematu.**

**Auth jest rozstrzygnięty, ale niezaimplementowany.** Tożsamość prowadzi **Clerk** — decyzja
z 1.09.2026 wraz z listą odrzuconych opcji leży w
[change.md](context/changes/account-and-login/change.md), a jej skutki dla infrastruktury
w aneksie [infrastructure.md](context/foundation/infrastructure.md). Konsekwencje, które obowiązują
od pierwszej linii kodu auth: hasła, sesje, maile i limit prób są po stronie Clerka; Worker
**wyłącznie weryfikuje podpis JWT** kluczem publicznym PEM (`CLERK_JWT_KEY`) i wyciąga `userId`;
klient wysyła token nagłówkiem `Authorization: Bearer` na obu platformach, więc trasy API nigdy nie
czytają ciasteczek; **D1 nie przechowuje danych tożsamościowych** — e-mail i hash hasła nie są tu
duplikowane. Nie dodawaj własnego hashowania ani tabel sesji. Gdy schemat wejdzie: cały dostęp do
danych użytkownika przez jedną warstwę repozytorium przyjmującą `userId` jako pierwszy argument, bo
D1 nie ma RLS, a repo nie ma testów.

## Komendy i weryfikacja

Skrypty (`start`, `android`, `ios`, `web`, `lint`) są w [package.json](package.json); lint to
`expo lint` z flat configiem w [eslint.config.js](eslint.config.js).

- `npx tsc --noEmit` — jedyne realne sprawdzenie poprawności w tym repo. Nie jest skryptem npm.
- `npm run check-lock` — przed każdym pushem, jeśli ruszałeś zależności. Odtwarza sprawdzenie
  spójności robione przez `npm ci`, więc łapie zepsuty lock lokalnie, zamiast na czerwonym buildzie.
- Nie ma runnera testów. „Przetestowane" znaczy: `npx tsc --noEmit` przechodzi i ekran został
  otwarty na realnej platformie.
- Tematy commitów: tryb rozkazujący, zdaniowa wielkość liter, bez prefiksu.

Wdrożenie ma własną, obowiązkową kolejność — `wrangler deploy` **nie buduje**:

```sh
npx expo export -p web                                # dist/client + dist/server
npx wrangler deploy --dry-run --outdir .wrangler-dry  # 6 modułów, nic z node_modules
npx wrangler dev                                      # bramka: workerd lokalnie
npx wrangler deploy                                   # produkcja
```

- **`npx expo start --web` nie jest testem wdrożenia** — uruchamia trasy API w Node. Wierność
  runtime'u daje tylko `npx wrangler dev` na zbudowanym `dist/`. To bramka przed każdym deployem.
- Smoke test po wdrożeniu: `/` zwraca HTML, nieznana ścieżka zwraca 404, a `/api/health` zwraca
  `{"ok":true,"d1":true}`. Jeśli HTML działa, a trasa API daje 500 — patrz `rules` wyżej.
- Logi na żywo: `npx wrangler tail`. Rollback: `npx wrangler rollback` — cofa **kod, nie schemat D1**.
- **Hash bundla webowego może się zmienić bez żadnej zmiany w źródłach** (sporadyczna
  niedeterministyczność Metro — cztery buildy tego samego drzewa dały trzy hashe). Nazwę zasobu do
  sprawdzenia bierz więc z wdrożonego HTML-a, nie z lokalnego `dist/`, inaczej dostaniesz 404, które
  wygląda jak zepsute wdrożenie. Uboczny skutek: część deployów unieważnia stare adresy assetów,
  więc otwarta u kogoś strona z przed deployu może stracić swój bundel do odświeżenia.
- CI to Cloudflare Workers Builds na gałęzi `main` (nie GitHub Actions). Typecheck i lint nadal
  uruchamiasz sam przed pushem.

## Dokumenty projektu

Repo pracuje w łańcuchu 10x (`.claude/skills/10x-*`). Konwencje katalogów opisują README
w [context/foundation/](context/foundation/README.md), [context/changes/](context/changes/README.md)
i [context/archive/](context/archive/README.md) — ten ostatni jest **niezmienny**, żaden skill tam
nie pisze. Kontekst kursowy: [notes/10x-lesson-m1l4-brief.md](notes/10x-lesson-m1l4-brief.md).

## Pułapki

- `npx tsc --noEmit` na świeżym klonie zgłasza dwa fałszywe błędy o `.css`
  (`animated-icon.module.css`, `@/global.css`). Deklaracje tych modułów siedzą w `expo-env.d.ts`
  i `.expo/types/`, które są generowane przy pierwszym `npm start` i są w `.gitignore`. Uruchom
  Metro raz, zanim uznasz typecheck za czerwony.
- `app.json` → `slug: "meal-plan"` i `scheme: "mealplan"` to tożsamość projektu w EAS. Zmiana
  któregokolwiek psuje buildy; zostały już raz poprawione po scaffoldzie
  ([verification.md](context/changes/bootstrap-verification/verification.md)).
- `npm audit` zgłasza 11 MODERATE z jednego advisory `uuid` wewnątrz łańcucha zależności Expo.
  Poprawka przyjdzie z aktualizacją Expo — nie próbuj tego „naprawiać" samodzielnie.
- Preset `eslint-config-expo` włącza reguły React Compilera, w tym `react-hooks/set-state-in-effect`.
  `setState` w ciele efektu jest **błędem lintu**, nie ostrzeżeniem. Jedyne odstępstwo w repo to
  hydracja w [use-color-scheme.web.ts](src/hooks/use-color-scheme.web.ts) — wyciszona punktowo
  z uzasadnieniem. Nowy `setState` w efekcie prawie zawsze znaczy, że efekt jest niepotrzebny.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Moduł 2, Lekcja 2

Przekształć jeden element planu działania w pierwszy cykl implementacji za pomocą **łańcucha planowania zmian**:

```
/10x-roadmap -> /10x-new -> /10x-plan -> /10x-plan-review -> /10x-implement
```

`/10x-new`, `/10x-plan`, `/10x-plan-review` i `/10x-implement` to główne tematy lekcji. `/10x-frame` i `/10x-research` nie są tutaj wymaganymi rytuałami; są to ścieżki eskalacji wprowadzone w następnej lekcji.

### Router zadań — Od czego zacząć

| Umiejętność | Użyj, gdy |
| --- | --- |
| **Konfiguracja zmiany (główny temat lekcji)** | |
| `/10x-new <change-id>` | Wybrałeś element planu działania i potrzebujesz stabilnego folderu zmian. Tworzy `context/changes/<change-id>/change.md`, dzięki czemu planowanie, implementacja, postęp, commity i późniejsza recenzja mają jedną tożsamość. Użyj PO wyborze planu działania, PRZED `/10x-plan`. |
| **Planowanie (główny temat lekcji)** | |
| `/10x-plan <change-id>` | Masz folder zmian i potrzebujesz planu implementacji do recenzji. Odczytuje kontekst planu działania, dokumenty podstawowe, dowody z bazy kodu i wszelkie istniejące notatki o zmianach; zapisuje `plan.md` i `plan-brief.md` z fazami, kontraktami plików, kryteriami sukcesu i `## Progress`. |
| **Gotowość planu (główny temat lekcji)** | |
| `/10x-plan-review <change-id>` | Masz `plan.md` i potrzebujesz lekkiej kontroli gotowości przed kodowaniem. Użyj jej, aby wychwycić brakujący stan końcowy, słabe kontrakty, źle sformułowany postęp, dryf zakresu lub martwe punkty, zanim rozpoczną się zmiany w kodzie. |
| **Implementacja (główny temat lekcji)** | |
| `/10x-implement <change-id> phase <n>` | Masz zatwierdzony plan i chcesz wykonać jedną fazę z weryfikacją, ręczną bramką, rytuałem commitowania i zapisem SHA do `## Progress`. |
| **Zamknięcie cyklu życia** | |
| `/10x-archive <change-id>` | Zmiana została scalona lub celowo zamknięta. Przenieś ją z aktywnego `context/changes/` do stanu archiwum. |

### Jak działa przekazywanie w łańcuchu

- `/10x-new` tworzy trwałą tożsamość zmiany.
- `/10x-plan` przekształca tę tożsamość w kontrakt implementacyjny.
- `/10x-plan-review` sprawdza plan, zanim agent zmodyfikuje kod.
- `/10x-implement` wykonuje jedną zaplanowaną fazę, weryfikuje, prosi o ręczne potwierdzenie w razie potrzeby, commituje i rejestruje postęp.

### Granice lekcji

- Plan jest domyślnym routerem po wyborze planu działania. Zacznij od `/10x-plan`, chyba że problem jest niejasny lub blokują go zewnętrzne dowody.
- Nie uruchamiaj `/10x-frame + /10x-research` jako ceremonii dla każdej zmiany.
- Nie przekształcaj tej lekcji w pełną, kompleksową budowę produktu. Punkt kontrolny z zaplanowanym i częściowo lub w pełni zaimplementowanym strumieniem jest ważny.
- Przegląd kodu zaimplementowanej różnicy należy do Lekcji 3 za pośrednictwem `/10x-impl-review`.
- Zamknięcie cyklu życia za pomocą `/10x-archive` po scaleniu zmiany lub jej celowym zamknięciu.

### Ścieżki używane w tej lekcji

- `context/foundation/roadmap.md` - plan działania upstream
- `context/changes/<change-id>/change.md` - tożsamość zmiany
- `context/changes/<change-id>/plan.md` - kontrakt implementacyjny
- `context/changes/<change-id>/plan-brief.md` - skompresowane przekazanie
- `context/foundation/lessons.md` - powtarzające się zasady i pułapki
- `docs/reference/contract-surfaces.md` - rejestr nazw nośnych

Umiejętności nie mogą zapisywać do `context/archive/`. Zarchiwizowane zmiany są niezmienne; jeśli rozwiązana ścieżka docelowa zaczyna się od `context/archive/`, przerwij z komunikatem: "Ta zmiana jest zarchiwizowana. Zamiast tego otwórz nową zmianę za pomocą `/10x-new`."

<!-- END @przeprogramowani/10x-cli -->
