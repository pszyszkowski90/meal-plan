<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Konto e-mail + hasło i granica danych użytkownika

- **Plan**: context/changes/account-and-login/plan.md
- **Zakres**: Faza 1 z 4 (commit `0d1e449`)
- **Data**: 2026-09-08
- **Werdykt**: ODRZUCONY (do czasu naprawy F1 — potem WYMAGA UWAGI)
- **Ustalenia**: 1 krytyczne, 4 ostrzeżenia, 4 obserwacje

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS (9/9 kroków MATCH; F2 wskazuje wadę samego planu) |
| Dyscyplina zakresu | WARNING (F4, F5) |
| Bezpieczeństwo i jakość | WARNING (F3, F7) |
| Architektura | WARNING (F2) |
| Spójność wzorców | WARNING (F8) |
| Kryteria sukcesu | FAIL (F1 — 1.1 pada przy ponownym uruchomieniu) |

## Kryteria sukcesu — ponowne uruchomienie 2026-09-08

| Wiersz | Polecenie | Wynik |
|---|---|---|
| 1.1 | `npm run check-lock` | **FAIL** — 3 nierozwiązywalne zależności (`@emnapi/runtime`, `bufferutil`, `utf-8-validate`); dotyczy też locka **zacommitowanego** w `0d1e449` |
| 1.2 | `npx tsc --noEmit` | PASS |
| 1.3 | `npx expo lint` | PASS (exit 0) |
| 1.4 | `expo export -p web --clear` + `wrangler deploy --dry-run` | PASS — 9 modułów, nic z `node_modules`, 143.95 KiB |
| 1.5 | bramka bundlowania | historyczne, przeszło 2026-09-01 |
| 1.12 | `/sso-callback` w eksporcie | PASS — trasa w `dist/server`; 200 na `wrangler dev` (2026-09-08) |
| 1.16 | bramka `(auth)` | PASS — Playwright: `/sign-in` i `/sign-up` zalogowanego → `/` |

Wiersze ręczne 1.6–1.15: wszystkie `[x]`, potwierdzone przez użytkownika 2026-09-08. Dowód
w postaci artefaktów istnieje dla 1.6, 1.8, 1.10, 1.11 (web), 1.16 (przebiegi Playwright
z podglądem ruchu do Clerka). 1.7, 1.9, 1.13, 1.14, 1.15 to dashboard/telefon — z natury bez
śladu w diffie, przyjęte na słowo użytkownika.

## Ustalenia

### F1 — Zacommitowany lockfile niespójny; `clerk` CLI w `dependencies`

- **Ważność**: ❌ KRYTYCZNE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: package.json:8, package-lock.json
- **Szczegóły**: `"clerk": "^3.3.0"` to Clerk **CLI** (`bin: clerk`), nie biblioteka; nic w `src/` go nie importuje, `@clerk/expo` go nie wymaga. Trafił do `package.json` przez `npm install` na Windowsie ok. 20:40 (razem z `.agents/skills/clerk-*` i `skills-lock.json`), **po** ostatnim czystym `check-lock`, a **przed** commitem fazy — wiersz 1.1 został odhaczony na nieaktualnym dowodzie. `git show 0d1e449:package-lock.json` pada na `check-lock`. Push tego commita zatrzyma Workers Builds na `npm ci` (EUSAGE), zanim dojdzie do `expo export`.
- **Poprawka**: usuń `clerk` z `dependencies`; regeneruj lock Dockerem (procedura z `scripts/check-lockfile.js`, zasiana obecnym lockiem); `npm ci`; `npm run check-lock`; osobny commit `fix(account-and-login): usuń Clerk CLI z zależności i napraw lock` — **nie** `--amend`.
- **Decyzja**: FIXED — 2026-09-08: `clerk` usunięty z `package.json`, lock zregenerowany w Dockerze (1123 pakiety, 0 bez sumy, brak `node_modules/clerk` i `@clerk/cli-*`), `npm ci` + `check-lock` + `tsc` czyste; commit naprawczy `7624eb1`.

### F2 — Trzech właścicieli nawigacji po zalogowaniu; `decorateUrl` robi pełne przeładowanie

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Architektura
- **Lokalizacja**: src/app/(auth)/sign-in.tsx:33-43, src/app/(auth)/sign-up.tsx:50-60, src/components/ui/google-sign-in-button.tsx:39, src/app/(auth)/_layout.tsx:24-26
- **Szczegóły**: Po udanym logowaniu na `/` nawigują niezależnie: `<Redirect href="/">` z bramki `(auth)` (krok 12), callback `finalize({ navigate })` w obu ekranach (krok 10) i `router.replace('/')` w przycisku Google (krok 11). Bramka odpala się, gdy tylko `isSignedIn` przejdzie na `true`, więc guard `session.currentTask` w `navigate` jest martwy — layout przekieruje i tak. Do tego `decorateUrl('/')` (zweryfikowane w `clerk.browser.js`) zwraca albo `'/'` bez zmian, albo **absolutny URL** przez `buildTouchUrl` Clerka; Expo Router (`utils/url.js: shouldLinkExternally`) traktuje `href` z protokołem jako zewnętrzny i woła `Linking.openURL` — twarde przeładowanie strony zamiast nawigacji klienckiej. Rzutowanie `as Href` to ukryło. **To wada kontraktu planu (krok 10: „na webie używa `decorateUrl`"), nie tylko implementacji.**
- **Poprawka A ⭐ Zalecana**: jeden właściciel — `finalize()` bez `navigate` w obu ekranach, usunięcie `router.replace('/')` z przycisku Google; przekierowuje wyłącznie bramka `(auth)`; `currentTask` obsłużyć w `(app)/_layout.tsx`, gdy pojawi się realna potrzeba; aneks w planie do kroków 10–12.
  - Siła: usuwa wyścig i duplikację (blok `navigate` ×2), zgodne z modelem już opisanym przy wylogowaniu w `(app)/index.tsx:61-64` („layout sam odsyła"); bramka `(auth)` istnieje od kroku 12, więc to zerowy koszt.
  - Kompromis: zmiana kontraktu planu w trzech krokach; przy `currentTask` użytkownik trafi na `/` zamiast zostać — dziś Clerk nie ma tam żadnych zadań (MFA, organizacje wyłączone).
  - Pewność: HIGH — oba mechanizmy zweryfikowane w kodzie bibliotek, a przebiegi Playwright potwierdzają, że sama bramka wystarcza do wejścia.
  - Martwy punkt: nie mierzono, czy `Linking.openURL` faktycznie występuje na `pk_test_` w tej konfiguracji (może zwracać `'/'`); usunięcie gałęzi czyni pytanie bezprzedmiotowym.
- **Poprawka B**: zostawić `navigate`, ale wyrzucić gałąź `decorateUrl` — `router.replace('/')` na wszystkich platformach.
  - Siła: minimalna edycja (2 linie), plan zmienia się tylko w zdaniu o `decorateUrl`.
  - Kompromis: nadal dwa (trzy z Google) przełączniki na tę samą trasę i martwy guard `currentTask`.
  - Pewność: MED — usuwa objaw, nie przyczynę.
  - Martwy punkt: podwójny `replace` w tym samym ticku jest dziś niewidoczny; może się ujawnić przy animacjach Stacka natywnie.
- **Decyzja**: FIXED via Fix A — 2026-09-08: `finalize()` bez `navigate` w sign-in i sign-up, `router.replace` i `useRouter` usunięte z przycisku Google, importy `Href`/`Platform` wyczyszczone; plan → wersja 2.4 (kroki 9–12). Wchodzi z commitem fazy 2 (lub commitem zbiorczym poprawek z przeglądu).

### F3 — Wynik `sendEmailCode()` niesprawdzony; nagłówek „Wysłaliśmy kod" może kłamać

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/app/(auth)/sign-up.tsx:34
- **Szczegóły**: po udanym `password()` wywołanie `await signUp.verifications.sendEmailCode()` ignoruje `{ error }`. Przy błędzie (limit, sieć) `needsCode` i tak jest `true`, więc ekran ogłasza „Wysłaliśmy kod na …", choć nic nie poszło. `errors.global` renderuje błąd niżej, ale nagłówek pozostaje fałszywy. Link „wyślij ponownie" ratuje sytuację, ale nie powinien być jedyną drogą.
- **Poprawka**: `const { error } = await sendEmailCode(); setCodeSent(!error);` i nagłówek warunkowy: wysłano → „Wysłaliśmy kod na …", nie wysłano → „Nie udało się wysłać kodu — użyj linku poniżej". Ten sam stan może zastąpić `codeResent`.
- **Decyzja**: FIXED — 2026-09-08: stan `codeDelivery: 'pending' | 'sent' | 'resent' | 'failed'` zastąpił `codeResent`; oba wywołania `sendEmailCode()` sprawdzają `{ error }`; nagłówek ekranu kodu odzwierciedla stan (przy `failed` w kolorze `textDanger`), a po odświeżeniu (`pending`) nie twierdzi, że kod wysłano. `tsc` + `lint` czyste.

### F4 — `app.json` zmienione mimo „bez zmian w app.json" w planie

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: app.json:36-37
- **Szczegóły**: `npx expo install` dopisał pluginy `@clerk/expo` i `expo-secure-store`. Plugin Clerka (`app.plugin.js`) ustawia wyłącznie konfigurację natywną: iOS deployment target 17.0 i filtr intentów `clerk://<package>.hosted-callback` na Androidzie. W Expo Go i na webie nie ma efektu; będzie potrzebny przy pierwszym development buildzie. `slug`/`scheme` nietknięte. Odchylenie jest nieudokumentowane, nie szkodliwe.
- **Poprawka**: aneks w kroku 1 planu („`expo install` dopisuje pluginy do `app.json`; zostają, bo dev build ich wymaga"). Nie cofać.
- **Decyzja**: FIXED — 2026-09-08: aneks 2.4 w kroku 1 planu (pluginy zostają, uzasadnienie natywne), zdanie „bez zmian w `app.json`" w kroku 3 skorygowane. Kod bez zmian.

### F5 — `.agents/skills/clerk-*` i `skills-lock.json` w drzewie roboczym, z materiałem Backend API

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: .agents/ (20 folderów), skills-lock.json — nieśledzone, **nie** w `.gitignore`
- **Szczegóły**: pozostałość po Clerk CLI (`clerk init` / skills). 14 plików operuje `CLERK_SECRET_KEY` (m.in. `clerk-backend-api/scripts/execute-request.sh`) — plan wyklucza Backend API i sekret nie ma wchodzić do projektu. Nie jest w commicie `0d1e449`, ale bez decyzji pojedzie z najbliższym `chore` commitem.
- **Poprawka**: usuń `.agents/` i `skills-lock.json` (CLI nie jest używane — patrz F1). Jeśli skille Clerka mają zostać lokalnie: dopisz obie ścieżki do `.gitignore`.
- **Decyzja**: FIXED — 2026-09-08: `.agents/` (20 folderów `clerk-*`, nieśledzone) i `skills-lock.json` usunięte z drzewa roboczego; poza `node_modules` i tym folderem zmiany nie ma już żadnego wystąpienia `CLERK_SECRET_KEY`.

### F6 — `textDanger` w motywie nie występuje w planie

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/constants/theme.ts:17, :25
- **Szczegóły**: krok 8 wymaga komunikatu błędu przy „zero surowych kolorów", a paleta nie miała koloru błędu — zmiana jest konieczna, plan ją przemilczał.
- **Poprawka**: aneks do kroku 8 planu („paleta zyskuje `textDanger` w obu trybach").
- **Decyzja**: FIXED — 2026-09-08: krok 8 planu wymienia `src/constants/theme.ts` i opisuje `textDanger` (aneks 2.4). Kod bez zmian.

### F7 — Trzy ciche lub techniczne ścieżki błędu

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/app/(auth)/sign-in.tsx:29-31; src/components/ui/google-sign-in-button.tsx:41; src/app/(app)/index.tsx:66
- **Szczegóły**: (a) `if (signIn.status !== 'complete') return;` — przy włączeniu MFA w dashboardzie logowanie „nic nie robi" bez komunikatu; (b) przycisk Google pokazuje surowy `cause.message` — angielski, techniczny („Missing external verification redirect URL…") w polskim UI; (c) `onPress={() => signOut()}` bez obsługi odrzucenia — unhandled rejection bez feedbacku. Żadne nie wycieka sekretów.
- **Poprawka**: (a) linia `textDanger` „Logowanie wymaga dodatkowego kroku, którego aplikacja nie obsługuje"; (b) `isClerkAPIResponseError(cause) ? cause.errors[0]?.longMessage : stały polski komunikat`; (c) `.catch()` z komunikatem albo `void`.
- **Decyzja**: FIXED — 2026-09-08: (a) stan `unsupportedStep` + komunikat w sign-in; (b) `isClerkAPIResponseError` z `@clerk/expo` → `longMessage`/`message`, inaczej stały polski komunikat; (c) `handleSignOut` z `try/catch` i komunikatem `signOutError`. `tsc` + `lint` czyste.

### F8 — Style przycisku skopiowane czterokrotnie, ekran neutralny trzykrotnie

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: sign-in.tsx:116-127, sign-up.tsx:182-193, google-sign-in-button.tsx:72-83, (app)/index.tsx:106-117; (app)/_layout.tsx, (auth)/_layout.tsx, sso-callback.tsx
- **Szczegóły**: trójka `action`/`actionMuted`/`actionSurface` powtórzona w czterech plikach; pełnoekranowy neutralny `ThemedView` w trzech; blok `finalize({ navigate })` dosłownie w dwu. Cztery kopie to już wzór, nie przypadek. Faza 2 doda piąty przycisk.
- **Poprawka**: `src/components/ui/action-button.tsx` (`label`, `busy`, `onPress`, `type` powierzchni) wprowadzony w fazie 2 przy dotykaniu tych ekranów; blok `finalize` znika przy F2-A.
- **Decyzja**: FIXED — 2026-09-08 (od razu, nie w fazie 2): nowy `src/components/ui/action-button.tsx` (`label`, `busyLabel`, `busy`, `onPress`, `type`), cztery wystąpienia podmienione (sign-in, sign-up, Google, wylogowanie), trzy zestawy stylów usunięte; blok `finalize` zniknął przy F2. Ekran neutralny (×3, trzy linie stylu) zostawiony celowo. `tsc` + `lint` czyste.

### F9 — Kopia startera wskazuje nieistniejące ścieżki i zakazaną komendę

- **Ważność**: 💬 OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Zgodność z planem
- **Lokalizacja**: src/app/(app)/index.tsx:52, :57; src/app/(app)/explore.tsx:64-69
- **Szczegóły**: hinty „Try editing `src/app/index.tsx`", „`src/app/_layout.tsx` sets up the tab navigator" i „Fresh start: `npm run reset-project`" są po przeniesieniu nieprawdziwe, a ostatnia reklamuje komendę zakazaną w CLAUDE.md. Plan świadomie nie przepisywał treści (krok 6).
- **Poprawka**: usuń trzy hinty teraz albo zostaw S-02, które zastępuje cały ekran startowy.
- **Decyzja**: FIXED — 2026-09-08: hint „Fresh start / `npm run reset-project`" usunięty; ścieżki w `index.tsx` i `explore.tsx` zaktualizowane na `src/app/(app)/…`, opis layoutu mówi o bramce sesji. `tsc` + `lint` czyste.
