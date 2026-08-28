# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Zanim napiszesz kod Expo

Expo SDK 57 / React Native 0.86 / React 19.2 wprowadziły zmiany łamiące wsteczną zgodność.
Sprawdź wersjonowaną dokumentację <https://docs.expo.dev/versions/v57.0.0/> zamiast polegać na
pamięci o starszych SDK. To samo mówi @AGENTS.md.

Trzy rzeczy, które najczęściej łamie kod pisany „z pamięci":

- **Router mieszka w `src/app/`, nie w `app/`.** Domyślny układ Expo Routera jest tu przesunięty
  pod `src/`. Nowy ekran = nowy plik w [src/app/](src/app/), np. `src/app/profile.tsx` → trasa `/profile`.
- **`typedRoutes` i `reactCompiler` są włączone** ([app.json](app.json) → `experiments`). Trasy są
  typowane — nieistniejąca ścieżka w `<Link href>` to błąd typu, nie runtime. React Compiler sam
  memoizuje: nie dodawaj `useMemo`/`useCallback`/`React.memo` „na wszelki wypadek".
- **Warianty platformowe przez sufiks pliku**, nie przez `if (Platform.OS)` w jednym pliku, gdy
  różnica jest strukturalna. Metro rozwiązuje `foo.web.tsx` przed `foo.tsx`. Tak zrobione są
  [app-tabs](src/components/app-tabs.tsx), [animated-icon](src/components/animated-icon.tsx) i
  [use-color-scheme](src/hooks/use-color-scheme.ts). `Platform.OS`/`Platform.select` zostaw do
  drobnych różnic w obrębie jednego komponentu.

## Komendy

```bash
npm start              # Metro + wybór platformy (a / i / w w terminalu)
npm run android        # expo start --android
npm run ios            # expo start --ios
npm run web            # expo start --web
npx tsc --noEmit       # jedyne realne sprawdzenie poprawności w tym repo
npm run lint           # expo lint — flat config w eslint.config.js, preset eslint-config-expo
```

Nie ma runnera testów (brak jest/vitest w `package.json`). Dopóki ktoś go nie doda, „przetestowane"
znaczy: `npx tsc --noEmit` przechodzi i ekran został otwarty na realnej platformie.

`npx tsc --noEmit` na świeżym klonie zgłasza dwa fałszywe błędy o `.css` (`animated-icon.module.css`,
`@/global.css`). Deklaracje tych modułów siedzą w `expo-env.d.ts` i `.expo/types/`, które są
generowane przy pierwszym `npm start` i są w `.gitignore`. Uruchom Metro raz, zanim uznasz typecheck
za czerwony.

`npm run reset-project` jest **destrukcyjny** — przenosi kod startera do `app-example/` i zostawia
puste `src/app/`. Nie uruchamiaj go w ramach porządków.

## Konwencje kodu

- **Nazwy plików kebab-case** (`themed-text.tsx`, `use-color-scheme.ts`), nazwy eksportów PascalCase /
  camelCase. Komponenty w [src/components/](src/components/), prymitywy UI w [src/components/ui/](src/components/ui/),
  hooki w [src/hooks/](src/hooks/).
- **Importy przez aliasy**: `@/*` → `src/*`, `@/assets/*` → `assets/*` (assets **nie** leżą pod `src/`).
  Wyjątek, który utrzymuje starter: rodzeństwo w tym samym katalogu bywa importowane względnie
  (`./themed-text`) — trzymaj się tego, co robią sąsiedzi pliku.
- **Zero surowych kolorów i odstępów w `StyleSheet`.** Kolor bierz z `useTheme()`, odstęp/promień
  z `Spacing` ([src/constants/theme.ts](src/constants/theme.ts)). `Spacing` to skala nazwana słownie
  (`half`=2, `one`=4 … `six`=64), nie liczby.
- **Tekst i tło przez `ThemedText` / `ThemedView`**, nie przez `Text` / `View`. Wariant wybiera prop
  `type` (`title`, `subtitle`, `small`, `code`, `link`… / `background`, `backgroundElement`,
  `backgroundSelected`), a nie własny styl inline.
- **`useColorScheme` bierz z [`@/hooks/use-color-scheme`](src/hooks/use-color-scheme.ts), nie z `react-native`.**
  Web renderuje się statycznie (`app.json` → `web.output: "static"`), więc wariant webowy odracza
  odczyt schematu do hydracji — użycie hooka z `react-native` daje niezgodność SSR/klient. Kilka
  plików startera (`_layout.tsx`, `app-tabs.tsx`) importuje jeszcze wprost z `react-native`; nie
  powielaj tego w nowym kodzie.
- **Dolny pasek nawigacji nie jest w layoucie flexbox** — ekrany same rezerwują miejsce przez
  `BottomTabInset + Spacing.*` w `paddingBottom` / `contentInset`. Nowy przewijalny ekran, który
  tego nie zrobi, chowa ostatni element pod zakładkami.

## Architektura

**Warstwa nawigacji jest rozdwojona.** [_layout.tsx](src/app/_layout.tsx) montuje jeden komponent
`AppTabs`, ale Metro podstawia inny plik na każdą platformę:

- natywnie — [app-tabs.tsx](src/components/app-tabs.tsx), `NativeTabs` z `expo-router/unstable-native-tabs`
  (natywny pasek systemowy; `NativeTabs.Trigger name` **musi** odpowiadać nazwie pliku trasy);
- web — [app-tabs.web.tsx](src/components/app-tabs.web.tsx), headless `Tabs`/`TabList`/`TabTrigger`
  z `expo-router/ui`, gdzie `name` jest dowolne, a wiąże `href`. Dlatego zakładka „Home" nazywa się
  tam `home`, a natywnie `index`.

Dodając zakładkę musisz ruszyć **oba** pliki — inaczej trasa istnieje, ale jest nieosiągalna na
jednej z platform.

**Motyw** jest jednokierunkowy: `Colors` (light/dark) → `useTheme()` → `ThemedText`/`ThemedView` →
ekrany. `constants/theme.ts` importuje [src/global.css](src/global.css) efektem ubocznym — to stamtąd
web bierze zmienne `--font-*`, na które wskazuje `Fonts`. Nie usuwaj tego importu przy porządkach.

**Animacje** to Reanimated 4 z `Keyframe`, nie Animated API. Powrót z worklet do JS idzie przez
`scheduleOnRN` z `react-native-worklets` ([animated-icon.tsx](src/components/animated-icon.tsx)).
Splash: `SplashScreen.preventAutoHideAsync()` w layoucie, a `hideAsync()` woła dopiero `onLayout`
nakładki — kolejność jest celowa, przestawienie daje mignięcie.

**Backendu nie ma.** Karta Expo nie wnosi warstwy danych, a FR-001 (konto e-mail + hasło) i izolacja
danych profilu jej wymagają. Wybór bazy/auth to pierwsza otwarta decyzja architektoniczna — patrz
[tech-stack.md](context/foundation/tech-stack.md).

## Produkt: twarde ograniczenia

Pełny zakres jest w [context/foundation/prd.md](context/foundation/prd.md). Cztery rzeczy, które są
**ograniczeniami, nie preferencjami** — złamanie któregokolwiek to błąd, nie kompromis:

- Suma kalorii dnia mieści się w ±10% wyliczonego celu. Dotyczy też pojedynczej podmiany dania.
- Żaden posiłek nie zawiera pozycji z listy wykluczeń użytkownika.
- Żaden posiłek nie przekracza zadeklarowanego maksymalnego czasu przygotowania.
- Gdy planu nie da się ułożyć w tych granicach — jawny komunikat, nigdy plan łamiący regułę.

Wykluczenia z preferencji (FR-004) i oznaczenia dań z planu (FR-011) zasilają **jedną** listę
wykluczeń, nie dwa mechanizmy.

Poza zakresem MVP: dziennik jedzenia, śledzenie wagi, plan miesięczny, preferencje pozytywne
(FR-005), eksport listy zakupów (FR-015). Nie dokładaj ich „przy okazji".

**Blokada:** źródło przepisów i makr jest nierozstrzygnięte (Open Question 1 w PRD). Generator planu
i guardrail ±10% stoją na tej decyzji — nie implementuj generatora, zanim nie zapadnie.

## Katalog `context/`

Repo pracuje w łańcuchu 10x (`.claude/skills/10x-*`): `context/foundation/` trzyma dokumenty
przekrojowe (PRD, tech-stack, shape-notes) edytowane w miejscu; `context/changes/<change-id>/` —
artefakty pojedynczej zmiany; `context/archive/` — **niezmienne**, żaden skill tam nie pisze.
Konwencje opisują README w każdym z tych katalogów. Kontekst kursowy: [notes/10x-lesson-m1l4-brief.md](notes/10x-lesson-m1l4-brief.md).

## Pułapki

- `app.json` → `slug: "meal-plan"` i `scheme: "mealplan"` to tożsamość projektu w EAS. Zmiana
  któregokolwiek psuje buildy; zostały już raz poprawione po scaffoldzie
  ([verification.md](context/changes/bootstrap-verification/verification.md)).
- `/ios` i `/android` są w `.gitignore` — to workflow zarządzany. Nie commituj katalogów natywnych
  i nie edytuj ich ręcznie; konfiguracja natywna idzie przez `app.json` i pluginy.
- `npm audit` zgłasza 11 MODERATE z jednego advisory `uuid` wewnątrz łańcucha zależności Expo.
  `npm audit fix --force` **cofnąłby `expo` o kilka wersji major** — nie uruchamiaj go. Poprawka
  przyjdzie z aktualizacją Expo.
- Preset `eslint-config-expo` włącza reguły React Compilera, w tym `react-hooks/set-state-in-effect`.
  `setState` w ciele efektu jest błędem lintu, nie ostrzeżeniem. Jedyne odstępstwo w repo to
  hydracja w [use-color-scheme.web.ts](src/hooks/use-color-scheme.web.ts) — wyciszona punktowo
  z uzasadnieniem. Nowy `setState` w efekcie prawie zawsze znaczy, że efekt jest niepotrzebny.
