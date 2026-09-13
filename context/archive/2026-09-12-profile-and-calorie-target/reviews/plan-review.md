<!-- PLAN-REVIEW-REPORT -->
# Przegląd planu: Profil użytkownika i wyliczone zapotrzebowanie kaloryczne (v1)

- **Plan**: `context/changes/profile-and-calorie-target/plan.md`
- **Tryb**: Głęboki
- **Data**: 2026-09-12
- **Werdykt**: DO POPRAWY → SOLIDNY (po zastosowaniu wszystkich pięciu poprawek, plan v1.1)
- **Ustalenia**: 1 krytyczne, 2 ostrzeżenia, 2 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność ze stanem końcowym | ZALICZONY |
| Oszczędne wykonanie | ZALICZONY |
| Dopasowanie architektoniczne | ZALICZONY (po poprawce F3) |
| Martwe punkty | ZALICZONY (po poprawkach F2, F5) |
| Kompletność planu | ZALICZONY (po poprawkach F1, F4) |

## Ugruntowanie

17/17 ścieżek ✓, 7/7 symboli ✓, brief↔plan ✓, roadmap S-02 / PRD FR-002, FR-003, OQ5 ↔ plan ✓.
Progress↔Faza: jeden `## Progress` na dole po `## Referencje`, 4 bloki faz, 38 kryteriów ↔ 38
pozycji `- [ ]`, zero pól wyboru poza Progress — **ale** nagłówki w treści to `## Faza N:`, a nie
`## Phase N:` (→ F1).

Sprawdzone ścieżki: `src/server/auth.ts`, `src/server/env.ts`, `src/server/repository/app-users.ts`,
`src/app/api/account+api.ts`, `src/hooks/use-authed-fetch.ts`, `src/lib/api.ts`,
`src/app/(app)/index.tsx`, `src/app/(app)/explore.tsx`, `src/app/(app)/_layout.tsx`,
`src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx`, `src/components/hint-row.tsx`,
`src/components/external-link.tsx`, `src/components/ui/text-field.tsx`,
`src/components/ui/action-button.tsx`, `migrations/0001_app_user.sql`, `tsconfig.json`.

Sprawdzone twierdzenia: `useFocusEffect` i `useIsFocused` eksportowane z `expo-router`
(`build/exports.d.ts:19-20`); `NativeTabs.Trigger.Icon` ma `sf` (iOS) i `drawable` (Android)
(`elements.d.ts:84,141`); `expo/tsconfig.base` ma `noEmit: true`, więc `allowImportingTsExtensions`
przejdzie; `@types/node` 26.4.0 obecne tranzytywnie; `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON`
działa na Node 25.1; tabela testów sprawdzona w JS: 1290 × 1.55 = 1999.5 → 2000, 1780 × 1.375 = 2447.5
→ 2448, 1780 × 1.725 = 3070.5 → 3071, surowe BMR 1289.5 / 1320.25 zgodne z planem. Ryzyko
„`allowImportingTsExtensions` a lint" jest puste: `eslint-config-expo` ustawia `import/extensions`
tylko w `settings`, nie w `rules`. Promień rażenia usunięć: `hint-row` importuje tylko `index.tsx`,
`external-link` tylko `explore.tsx` i `app-tabs.web.tsx`, `collapsible` tylko `explore.tsx` — zgodnie
z planem.

## Ustalenia

### F1 — Nagłówki faz `## Faza N:` zamiast `## Phase N:`

- **Waga**: ❌ KRYTYCZNE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: nagłówki faz (linie 168, 270, 370, 510) ↔ `## Progress`
- **Szczegóły**: `/10x-implement` liczy fazy z nagłówków `## Phase N:` (SKILL.md, krok „Policz
  całkowitą liczbę faz") i dopasowuje je do `### Phase N:` w Progress. Plan ma w treści `## Faza 1–4`,
  a w Progress `### Phase 1–4` — nazwy faz są identyczne, ale prefiks nie. Zarchiwizowany plan S-01
  używa `## Phase N:` w treści. Bez poprawki implementacja zobaczy zero faz w treści albo nie dopasuje
  bloku Progress.
- **Poprawka**: zamienić cztery nagłówki `## Faza N:` na `## Phase N:` (nazwy bez zmian).
- **Decyzja**: NAPRAWIONE (Popraw w planie)

### F2 — Karta na Home: `useFocusEffect` bez stabilnej tożsamości callbacku

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, żeby to przemyśleć
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Krytyczne szczegóły → „Odświeżanie karty na Home"; Faza 3 → krok 6
- **Szczegóły**: `useFocusEffect` w `expo-router` to `React.useEffect(..., [effect, navigation,
  optionalNavigation])`, a gdy ekran jest w fokusie, `callback()` wykonuje się **synchronicznie przy
  każdej zmianie tożsamości `effect`** (`build/useFocusEffect.js`). Plan przekazuje inline closure bez
  `useCallback`, licząc na React Compiler. Jeśli kompilator zmemoizuje — działa; jeśli nie (bailout
  na komponencie, a memoizacja kompilatora jest optymalizacją, nie kontraktem semantycznym) — każdy
  render wywołuje `fetch`, odpowiedź robi `setState`, render tworzy nowy `effect`, i tak w kółko.
  Plan sam cytuje `index.tsx:87-88` („Ref, nie tablica zależności, decyduje o «raz»: tożsamość
  `authedFetch` nie jest kontraktem") jako wzorzec, a potem porzuca tę obronę w nowej karcie.
  Flaga `cancelled` w cleanupie chroni przed nadpisaniem starszą odpowiedzią, nie przed pętlą żądań.
- **Poprawka A ⭐ Rekomendowana**: `useIsFocused()` z `expo-router` + `useEffect` z refem
  „pobrano w tym fokusie", który uzbraja się przy `isFocused === true` i resetuje przy `false`.
  - Siła: deterministyczne niezależnie od memoizacji; ten sam mechanizm fokusu co `useFocusEffect`,
    więc ryzyko webowe nie rośnie; `setState` tylko w callbackach obietnicy — lint czysty.
  - Kompromis: kilka linii więcej niż `useFocusEffect`; ref do utrzymania.
  - Pewność: WYSOKA — to dokładnie wzorzec z `index.tsx` rozszerzony o sygnał fokusu.
  - Martwy punkt: zachowanie `useIsFocused` na webie z headless `Tabs` — to samo otwarte ryzyko,
    które plan już nazywa.
- **Poprawka B**: zostawić `useFocusEffect`, a callback owinąć w `useCallback` jako **jedyne,
  punktowo uzasadnione** odstępstwo od reguły „nie dodawaj `useCallback`" (jak wyciszenie
  `set-state-in-effect` w `use-color-scheme.web.ts`).
  - Siła: zgodne z dokumentacją hooka, mniej kodu.
  - Kompromis: precedens wyjątku od twardej reguły `CLAUDE.md`; wymaga wpisu w regułach w fazie 4.
  - Pewność: ŚREDNIA — działa, ale kompilator może zgłosić redundantną memoizację jako ostrzeżenie.
  - Martwy punkt: jak w A.
- **Decyzja**: NAPRAWIONE (Poprawka A)

### F3 — Ikona zakładki Profil przez `drawable` nie zadziała w Expo Go na Androidzie

- **Waga**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dopasowanie architektoniczne
- **Lokalizacja**: Kluczowe odkrycia (`sf` / `drawable`); Faza 3 → krok 3; Otwarte ryzyka
- **Szczegóły**: `drawable` to nazwa **natywnego zasobu Androida** skompilowanego w aplikację
  (`elements.d.ts`: „The name of the drawable resource"). Expo Go nie zawiera własnych drawable'i
  projektu, więc ikona nie pojawi się na platformie, na której repo jest testowane (emulator
  Androida z Expo Go). Do tego plan wprowadza drugi mechanizm ikon obok istniejącego
  `src={require('…/home.png')} renderingMode="template"` — Home dalej na PNG, Profil na symbolach.
  Plan zna ścieżkę odwrotu (kopiowanie PNG), ale jako fallback po nieudanej próbie.
- **Poprawka**: użyć istniejącego wzorca — `assets/images/tabIcons/profile.png` (na start kopia
  `explore.png`, docelowo własna ikona) z `renderingMode="template"`; usunąć `sf` / `drawable`
  z Kluczowych odkryć, kroku 3 fazy 3, wzmianki w `CLAUDE.md` (faza 4) i z Otwartych ryzyk.
- **Decyzja**: NAPRAWIONE (Popraw w planie)

### F4 — Kontrakt `validateProfile` dla wejścia z formularza jest niedomówiony

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kompletność planu
- **Lokalizacja**: Faza 1 → krok 3 (`validateProfile`, `parseNumberInput`); Faza 3 → krok 2
- **Szczegóły**: Formularz trzyma liczby jako tekst, a plan mówi „`validateProfile` na bieżących
  wartościach". Nie jest zapisane, że to formularz woła `parseNumberInput` per pole, ani co
  `validateProfile` robi z `null` / `undefined` / `NaN` w polach liczbowych i z brakiem klucza
  `targetKcalOverride` w ciele `PUT` — dwóch wywołujących (ekran, trasa) może to rozstrzygnąć różnie.
  Osobno: Node w trybie strip-only **nie** obsługuje `enum`, `namespace` ani parameter properties —
  naturalna pokusa `enum ActivityLevel` wywali `npm test`, a `tsc` tego nie złapie.
- **Poprawka**: dopisać do umowy modułu: pola liczbowe przyjmują wyłącznie skończony `number`,
  `null` / `undefined` / `NaN` → błąd „Podaj …"; formularz parsuje `parseNumberInput` przed
  walidacją; `targetKcalOverride` `undefined` traktowane jak `null`; w module zero `enum` /
  `namespace` (ograniczenie strip-only Node).
- **Decyzja**: NAPRAWIONE (Popraw w planie)

### F5 — Po fazie 3 wiersz `app_user` powstaje dopiero przy zapisie profilu

- **Waga**: 💡 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Martwe punkty
- **Lokalizacja**: Faza 3 → krok 6 (usunięcie `/api/account` z Home); Faza 4 → `CLAUDE.md`
- **Szczegóły**: Home przestaje wołać `/api/account`, a `GET /api/profile` nie woła `touchAppUser`.
  Od tej pory `app_user` powstaje tylko przy pierwszym `PUT /api/profile`, a `last_seen_at`
  zmienia się wyłącznie przy zapisach. Zdanie z `CLAUDE.md` „Wiersz powstaje leniwie przy pierwszym
  uwierzytelnionym żądaniu" staje się nieprawdziwe, a plan fazy 4 tego zdania nie dotyka.
- **Poprawka**: w umowie `CLAUDE.md` (faza 4, „Architektura › Backend") przeredagować: wiersz
  `app_user` powstaje przy pierwszym **zapisie** (`PUT /api/profile`, przez `touchAppUser`) albo
  przy wejściu na trasę odniesienia `/api/account`; `last_seen_at` nie jest wskaźnikiem aktywności.
- **Decyzja**: NAPRAWIONE (Popraw w planie)
