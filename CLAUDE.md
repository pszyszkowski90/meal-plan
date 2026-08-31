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
schematu.** Auth (FR-001) i izolacja danych profilu to nadal pierwsza otwarta decyzja
architektoniczna — patrz [infrastructure.md](context/foundation/infrastructure.md) i
[deploy-plan.md](context/deployment/deploy-plan.md). Gdy schemat wejdzie: cały dostęp do danych
użytkownika przez jedną warstwę repozytorium przyjmującą `userId` jako pierwszy argument, bo D1 nie
ma RLS, a repo nie ma testów.

## Komendy i weryfikacja

Skrypty (`start`, `android`, `ios`, `web`, `lint`) są w [package.json](package.json); lint to
`expo lint` z flat configiem w [eslint.config.js](eslint.config.js).

- `npx tsc --noEmit` — jedyne realne sprawdzenie poprawności w tym repo. Nie jest skryptem npm.
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

## 10xDevs AI Toolkit — Moduł 1, Lekcja 5

Wybierz platformę wdrożeniową i wdróż do produkcji za pomocą **łańcucha infrastruktury**:

```
(/10x-init  →  /10x-shape  →  /10x-prd  →  /10x-tech-stack-selector  →  /10x-bootstrapper  →  /10x-agents-md  →  /10x-rule-review  →  /10x-lesson)  →  /10x-infra-research  →  Plan Mode deploy
```

Pełny łańcuch Modułu 1 obejmuje Lekcje 1–4 (ponownie włączone, aby można było naprawić wcześniejsze kontrakty w trakcie lotu). `/10x-infra-research` to główny temat lekcji; sam krok wdrożenia wykorzystuje wbudowany w hosta **Plan Mode**, a nie dedykowaną umiejętność — artefakt (`context/deployment/deploy-plan.md`) jest tym, co jest przekazywane dalej.

### Router zadań — Od czego zacząć

| Umiejętność | Kiedy jej używać |
| --- | --- |
| **Infrastruktura (główny temat lekcji)** | |
| `/10x-infra-research [path-to-tech-stack-or-prd]` | Masz `context/foundation/tech-stack.md` (i idealnie `prd.md`) i musisz wybrać platformę wdrożeniową MVP. Umiejętność ładuje stos jako twarde ograniczenie, przeprowadza 5-pytaniowy wywiad z deweloperem (trwałe połączenia, wrażliwość na koszty, istniejąca znajomość, globalny zasięg, preferencje kolokacji), uruchamia równoległe badania subagentów na sześciu platformach kandydujących, ocenia je Pass/Partial/Fail według pięciu kryteriów przyjaznych agentom z `references/agent-friendly-criteria.md`, tworzy krótką listę trzech najlepszych i przeprowadza trójwymiarową kontrolę anty-uprzedzeniową lidera (adwokat diabła, pre-mortem, nieznane niewiadome) przed zapisaniem `context/foundation/infrastructure.md`. Użyj PO `/10x-tech-stack-selector`, PRZED `/10x-implement`. |
| **Wdrożenie (wbudowane w hosta, nie umiejętność)** | |
| Plan Mode deploy | Masz `infrastructure.md` + `tech-stack.md` i chcesz, aby plan tylko do odczytu został przejrzany przed wprowadzeniem jakichkolwiek zmian na platformie. Aktywuj tryb planowania hosta (Claude Code: `Shift+Tab` przełącza domyślny → auto-akceptacja → plan; IDE: dedykowany przycisk) z komunikatem "Wykonajmy pierwsze wdrożenie w oparciu o `@infrastructure.md`, zgodnie ze stackiem z `@tech-stack.md`". Przeczytaj plan, zażądaj poprawek, zatwierdź, a następnie pozwól agentowi wykonać. Zatwierdzony plan pozostaje w `context/deployment/deploy-plan.md`, dzięki czemu planowanie kamieni milowych w następnej lekcji może odwoływać się do tego, co zostało już wdrożone i jakie sekrety są już podłączone. |
| **Ponowne uruchomienie upstream w razie potrzeby** | |
| `/10x-init` / `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` / `/10x-bootstrapper` / `/10x-agents-md` / `/10x-rule-review` / `/10x-lesson` / `/10x-stack-assess` / `/10x-health-check` | Zestawione, aby można było załatać wcześniejsze kontrakty w trakcie lotu. Jeśli kontrola anty-uprzedzeniowa wymusi zmianę platformy, która wpływa na decyzję dotyczącą stosu (np. "ta baza danych nie pasuje do żadnej platformy, którą byśmy zaakceptowali"), uruchom ponownie `/10x-tech-stack-selector`, aby utrzymać zgodność `tech-stack.md` i `infrastructure.md`. |

### Jak łańcuch przekazuje dane

- `/10x-infra-research` odczytuje `context/foundation/tech-stack.md` (język, framework, środowisko uruchomieniowe, baza danych) jako **twarde ograniczenia** — platformy, które nie mogą uruchomić stosu, są odrzucane przed oceną. Odczytuje również `context/foundation/prd.md` (skala, opóźnienia, oczekiwania dotyczące czasu pracy) jako **miękkie wagi** podczas oceny. Oba wejścia są opcjonalne, ale zdecydowanie zalecane; bez nich umiejętność działa, ale ostrzega.
- Umiejętność zapisuje `context/foundation/infrastructure.md` jako trzeci kontrakt podstawowy: frontmatter (`project`, `researched_at`, `recommended_platform`, `runner_up`, `context_type`, `tech_stack`) plus treść obejmującą rekomendację, pełne porównanie platform z macierzą punktacji, wyniki anty-uprzedzeniowe, historię operacyjną (podgląd / sekrety / wycofywanie / zatwierdzanie / logi) oraz rejestr ryzyka, wiążący każdy wpis z soczewką, która go ujawniła. W przypadku kolizji umiejętność pyta: nadpisać, zapisać jako `infrastructure-v2.md` lub przerwać.
- Plan Mode odczytuje `infrastructure.md` i `tech-stack.md` razem. Agent emituje plan krok po kroku, obejmujący zautomatyzowane kroki, które wykonuje, ręczne bramki konfiguracji (tworzenie konta, konfiguracja sekretów), dokładne polecenia wdrożenia (polecenia Pages vs Workers NIE są zamienne na Cloudflare — plan musi to określać) oraz kroki weryfikacji. Plan jest odrzucany/edytowany, dopóki nie będzie poprawny; dopiero wtedy Plan Mode kończy działanie i rozpoczyna się wykonanie. Zatwierdzony plan trafia do `context/deployment/deploy-plan.md` i jest wykorzystywany przez umiejętności planowania kamieni milowych jako źródło prawdy o tym, "co zostało już wdrożone".

### Co umiejętności lekcji obejmują (a czego NIE)

- **`/10x-infra-research` obejmuje**: krótką listę platform ocenionych według pięciu kryteriów przyjaznych agentom (jakość CLI, stopień zarządzania/serverless, dokumentacja czytelna dla agenta, stabilne/skryptowalne API wdrożeniowe, MCP lub integracja agenta pierwszej klasy), trzy wyniki anty-uprzedzeniowe dotyczące lidera (numerowane słabości, 150–200-słowowa narracja o awarii, 3–5 nieznanych niewiadomych), historię operacyjną z jedną konkretną odpowiedzią na każdą oś (nie kategorie) oraz rejestr ryzyka, w którym każdy wiersz nazywa swoją soczewkę źródłową (`Devil's advocate` / `Pre-mortem` / `Unknown unknowns` / `Research finding`). Status każdej funkcji niebędącej w GA jest rejestrowany w tekście (`beta` / `preview` / `region-limited` / `deprecated`) z datą sprawdzenia statusu.
- **`/10x-infra-research` NIE** tworzy obrazów Docker ani nie pisze Dockerfile'ów, nie konfiguruje potoków CI/CD ani nie planuje poza zakresem MVP (HA w wielu regionach jest wyraźnie poza zakresem). NIE decyduje za Ciebie — użytkownik akceptuje, zamienia na drugiego w kolejności lub przerywa po kontroli krzyżowej, a ta decyzja jest rejestrowana w wynikach.
- **Plan Mode** obejmuje: wyraźną ludzką bramkę między "agent ma plan" a "agent zmienia produkcję". Artefakt (`deploy-plan.md`) jest ścieżką audytu dla "co miało się wydarzyć", gdy uruchomienie na żywo pójdzie nie tak. Plan Mode NIE zastępuje `/10x-infra-research` (decyzja o platformie musi być już podjęta — Plan Mode planuje wdrożenie, nie wybiera miejsca wdrożenia).

### Pięć kryteriów przyjaznych agentom (i dlaczego są one kluczowe)

Kryteria, które tworzą macierz punktacji `/10x-infra-research`, nie są ogólnymi osiami "dobrej platformy" — są to specyficzne cechy, które określają, czy agent może obsługiwać tę platformę z sesji bez Twojej pomocy:

1. **CLI-first** — każda rutynowa operacja ma udokumentowane polecenie; agent nie musi klikać w panelu.
2. **Managed / serverless** — mniej ruchomych części oznacza mniej sposobów, w jakie agent (lub Ty) może coś zepsuć, co platforma miała obsłużyć.
3. **Agent-readable docs** — dokumentacja w formacie markdown / `llms.txt` / hostowana na GitHubie, którą agent może pobrać i przeanalizować, a nie strony marketingowe renderowane w JS.
4. **Stable, scriptable deploy API** — przewidywalne kody wyjścia, ustrukturyzowane dane wyjściowe, brak interaktywnych monitów w trakcie wdrożenia.
5. **MCP server or first-class agent integration** — bonus, nie wymagane. Samo CLI wystarczy dla MVP; MCP sprawdza się, gdy agent wykonuje dziesiątki ustrukturyzowanych zapytań do stanu na żywo.

Twarde filtry stosuje się przed punktacją (wymóg trwałego połączenia odrzuca Netlify/Vercel tylko serverless; niezgodność środowiska uruchomieniowego stosu technologicznego całkowicie odrzuca platformę). Odpowiedzi na wywiad ponownie ważą kryteria później — wrażliwość na koszty karze drogie podstawowe poziomy, znajomość rozstrzyga remisy, preferencja globalnego zasięgu faworyzuje platformy edge-native, preferencja kolokacji faworyzuje zintegrowane bazy danych.

### Anty-uprzedzenia jako dyscyplina decyzyjna (nie teatr)

Każda rozmowa badawcza z LLM ma wbudowane skłonności do tego, co użytkownik już zasygnalizował. `/10x-infra-research` uruchamia trzy ustrukturyzowane soczewki przeciwko liderowi ZANIM plik zostanie zapisany, a nie po:

- **Devil's advocate** — *znajdź słabości, ukryte koszty i tryby awarii specyficzne dla wdrożenia `<tego stosu>` na `<tej platformie>`*. Wynikiem jest numerowana lista 3–5 konkretów, a nie kategorii.
- **Pre-mortem** — *sześć miesięcy później ta decyzja okazała się kompletną katastrofą; przeanalizuj założenia i niedoszacowane ryzyka, które do tego doprowadziły*. Wynikiem jest narracja o długości 150–200 słów; narracje ujawniają konkretne kształty awarii, które abstrakcyjne listy ryzyka ukrywają.
- **Unknown unknowns** — *co jest prawdą o tej kombinacji, czego strona marketingowa i dokumentacja nie ujawniają w oczywisty sposób?* Wynikiem jest 3–5 nieoczywistych ryzyk.

Po kontroli krzyżowej użytkownik ma trzy realne opcje: **kontynuować z liderem i włączyć ryzyka do rejestru**, **zamienić na drugiego w kolejności** (i ponownie uruchomić kontrolę krzyżową na nowym liderze) lub **zamienić na trzecie miejsce**. Trzecia opcja jest rzadka; jeśli nigdy nie występuje w wielu uruchomieniach, kontrola krzyżowa zdegradowała się do rytuału i powinna zostać przepisana.

Dwie dodatkowe techniki (nie wymagające umiejętności, surowe podpowiedzi) należą do tego samego zestawu narzędzi: zmuszanie modelu do porównania trzech alternatyw w tabeli markdown (struktura jest lepsza niż "ta sama odpowiedź innymi słowami) oraz rotacja ról (ta sama decyzja oczami programisty frontendowego, osoby odpowiedzialnej za bezpieczeństwo i właściciela kosztów — ujawnienie kosztów, które ponosi każda rola, i zaproponowanie alternatyw, jeśli którakolwiek z nich się wzdrygnie).

### CLI vs MCP dla operacyjności infrastruktury na żywo

Po wdrożeniu agent potrzebuje sposobu na komunikację z działającą platformą. Dwie ścieżki, uzupełniające się, a nie konkurujące:

- **CLI** (`wrangler`, `flyctl`, `vercel`, `gh`) — jawne i audytowalne, dane wyjściowe pozostają w terminalu, bezpieczniejsze domyślne ustawienia dla nieodwracalnych działań (np. `netlify deploy` jest domyślnie szkicem; należy przekazać `--prod`). Najlepsze dla MVP: minimalna konfiguracja, niski koszt kontekstu (brak wstępnie załadowanych schematów narzędzi), a agent musi znać polecenie (w czym pomaga umiejętność dla każdego narzędzia).
- **MCP** — dedykowany serwer udostępniający ustrukturyzowane narzędzia ze schematami (`pages_deployments_list` itp.). Każdy podłączony serwer MCP dodaje definicje narzędzi do okna kontekstu, więc koszt rośnie wraz z liczbą serwerów. Sprawdza się, gdy agent wykonuje wiele zapytań typu discovery do stanu na żywo (logi, różnice w wdrożeniach), a ustrukturyzowany JSON jest lepszy niż parsowanie danych wyjściowych CLI.

Rozsądne domyślne ustawienie: zacznij od CLI, dodaj MCP, gdy zauważysz powtarzający się wzorzec przechodzenia przez `--help`, który agent musi wykonać, aby odpowiedzieć na klasę pytań. Własne ramy Anthropic [building-agents-that-reach-production](https://claude.com/blog/building-agents-that-reach-production-systems-with-mcp) mówią, że "API, CLI i MCP to trzy uzupełniające się ścieżki" — wybieraj według zadania, a nie według szumu.

### Granica dostępu produkcyjnego (minimalne uprawnienia, człowiek przy nieodwracalnych operacjach)

Zarówno CLI, jak i MCP mogą zapewnić agentowi bezpośredni dostęp do produkcji. Lekcja ustala domyślną postawę:

- **Tokeny są ograniczone, a nie klucze główne.** Na Cloudflare: token API ograniczony do Pages lub Workers dla jednego projektu, bez DNS, bez Workers Secrets dla niepowiązanych projektów, bez rozliczeń. Odpowiednik AWS / GCP: ograniczona rola IAM z `console-only-user` lub tylko do odczytu na produkcji, pełny dostęp na środowisku staging.
- **Tokeny znajdują się w zmiennych środowiskowych, a nie w `.mcp.json` zatwierdzonym w repozytorium.** Agent pobiera je za pośrednictwem serwera MCP lub wykrywania środowiska CLI, a nie w postaci jawnego tekstu w rozmowie.
- **Destrukcyjne działania są tylko dla ludzi.** Usunięcie bazy danych, rotacja głównego sekretu, usunięcie projektu — to operacje wykonywane ręcznie w panelu, nawet jeśli agent je sugeruje. Ręczne kliknięcie kosztuje 30 sekund; sprzątanie po zautomatyzowanym błędzie kosztuje godziny.

To jest postawa MVP. W miarę dojrzewania projektu naturalną ewolucją jest pełny dostęp agenta do środowiska staging, a produkcja staje się tylko do odczytu — omówione w późniejszych modułach.

### Ścieżki podstawowe używane w tej lekcji

- `context/foundation/tech-stack.md` — wejście (przekazanie z Lekcji 2, twarde ograniczenia)
- `context/foundation/prd.md` — wejście (przekazanie z Lekcji 1, miękkie wagi)
- `context/foundation/infrastructure.md` — wyjście (trzeci kontrakt podstawowy)
- `context/deployment/deploy-plan.md` — wyjście z Plan Mode deploy (ścieżka audytu "co miało się wydarzyć")
- `context/foundation/lessons.md` — powtarzające się zasady i pułapki (użyj `/10x-lesson` z Lekcji 4, jeśli zauważysz klasę błędów agenta podczas badań lub wdrożenia)
- `docs/reference/contract-surfaces.md` — rejestr kluczowych nazw

### Uniwersalny język

Dostarczona umiejętność nie zawiera odniesień do 10xDevs / kohorty / certyfikacji. Lista platform kandydujących (Cloudflare, Vercel, Netlify, Fly.io, Railway, Render) jest początkową soczewką badawczą, a nie zestawem rekomendacji — kluczowe są potok punktacji + wywiad + kontrola krzyżowa, a platformę nieobecną na domyślnej liście można dodać, rozszerzając krok badawczy. Pięć kryteriów przyjaznych agentom to prawdziwy rdzeń artefaktu; `/10x-infra-research` ponownie odczytuje je z `references/agent-friendly-criteria.md`, aby ewoluowały wraz z platformami.

Umiejętności nie mogą zapisywać do `context/archive/`. Zarchiwizowane zmiany są niezmienne; jeśli rozwiązana ścieżka docelowa zaczyna się od `context/archive/`, przerwij z komunikatem: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
