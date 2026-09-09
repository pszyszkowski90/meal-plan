# Konto e-mail + hasło i granica danych użytkownika — plan implementacji

> Wersja 2 (2026-09-01). Wersja 1 opierała się na Better Auth na D1; została zastąpiona po
> przeglądzie planu i ponownym badaniu opcji — uzasadnienie w `change.md`.
>
> Wersja 2.1 (2026-09-01): osiem poprawek z `reviews/plan-review.md` — warunki produkcyjne
> przeniesione do faz, które ich potrzebują (F1), rozszerzone typy D1 (F2), transport tokenu
> po stronie klienta (F3), poprawiona analiza `.gitignore` (F4), wyliczone `authorizedParties`
> (F5), bramka bundlowania w fazie 1 (F6), zdefiniowany stan neutralny (F7), nagłówki Progress
> zgodne z parserem `/10x-implement` (F8).
>
> Wersja 2.2 (2026-09-01, w trakcie implementacji fazy 1): **logowanie przez Google wchodzi do
> zakresu** — decyzja użytkownika podjęta po włączeniu Google w dashboardzie Clerka, przed
> commitem fazy 1. Dodaje krok 11 fazy 1, trasę `/sso-callback`, dwie zależności i cztery wiersze
> Progress. Reszta planu bez zmian.
>
> Wersja 2.3 (2026-09-08, w trakcie implementacji fazy 1): dwie poprawki z testów ręcznych,
> obie na polecenie użytkownika — **bramka grupy `(auth)`** (zalogowany nie ogląda formularzy
> logowania) i **ponowna wysyłka kodu** na ekranie rejestracji. Krok 12 fazy 1 i wiersz 1.16.
>
> Wersja 2.4 (2026-09-08, po `/10x-impl-review` fazy 1): **nawigacja po zmianie sesji ma jednego
> właściciela — bramkę grupy `(auth)`**. `finalize()` w sign-in i sign-up bez `navigate`, przycisk
> Google bez `router.replace`. Wariant `navigate` + `decorateUrl` z kroków 9–11 odrzucony:
> `decorateUrl` zwraca absolutny URL, który Expo Router traktuje jako zewnętrzny (pełne
> przeładowanie), a bramka i tak przekierowywała, więc guard `currentTask` był martwy
> (`reviews/impl-review-phase-1.md`, F2).
>
> Wersja 2.5 (2026-09-08, wejście w fazę 2): kontrakt kroku 1 fazy 2 skorygowany wobec SDK —
> `create({ identifier })` przed `sendCode()` (bez parametrów), `submitPassword` pod
> `resetPasswordEmailCode`, `finalize()` bez `navigate`; maskowanie `form_identifier_not_found` po
> stronie ekranu, bo instancja nie ma włączonej ochrony przed wyliczaniem kont.
>
> Wersja 2.6 (2026-09-08, po `/10x-impl-review` fazy 2): pod maskę przed wyliczaniem kont wchodzi też
> błąd `sendCode()` i każde odrzucenie kodu (`reviews/impl-review-phase-2.md`, F1–F3).
>
> Wersja 2.7 (2026-09-09, korekta v2.6): ustawienie w dashboardzie **nie zastępuje** maski ekranowej.
> Ścieżka to *Protect → Rules → User enumeration protection*, nie „Configure → Attack protection",
> a tryb *strict* wymaga, by hasło nie było pierwszą strategią logowania — czego nie spełniamy.
> Zostaje tryb *bulk* (same limity częstotliwości) i maska jako jedyny mechanizm ukrywający istnienie
> konta. Wiersz Progress 2.6 przepisany.
>
> Wersja 2.8 (2026-09-09, w trakcie implementacji fazy 3): **logowanie z nowego urządzenia wymaga
> potwierdzenia kodem** — Clerk zwraca `status: 'needs_client_trust'`, którego ekran logowania nie
> znał. Wyszło przy weryfikacji kryterium 3.9: telefon nie mógł wejść na konto założone
> w przeglądarce. Nie jest to rozjazd konfiguracji — instancja ma `second_factors: []`,
> `sign_in.second_factor.required: false` i `native_settings.trusted_device_sign_in_enabled: false`,
> a status mimo to przychodzi, więc nie ma go czym wyłączyć. Dodaje krok 3 fazy 2 i wiersze 2.7–2.8.
> Zakres poszerzony świadomie, decyzją użytkownika: na tym kroku stoi kryterium 4.8, czyli dosłowny
> wynik S-01 („ten sam stan w przeglądarce i na telefonie").

## Przegląd

Fragment **S-01** mapy drogowej: użytkownik zakłada konto e-mail + hasło, potwierdza adres kodem
z maila, loguje się i widzi ten sam stan na telefonie oraz w przeglądarce; niezalogowany nie
dostaje żadnego widoku produktowego. Realizuje FR-001 i sekcję *Access Control* z PRD.

Tożsamość prowadzi **Clerk**. Nasz Worker nie hashuje haseł, nie trzyma sesji i nie wysyła maili —
tylko **weryfikuje podpis JWT** i mapuje `userId` na własne dane w D1. To przenosi cały ciężar
bezpieczeństwa haseł poza nasz kod i redukuje stronę serwerową do jednej funkcji, która nie ma jak
się zepsuć przy kolejnym SDK Expo.

Zmiana nadal dowozi to, co czyni ją fundamentem: **pierwszy schemat D1**, **konwencję migracji**
i **warstwę repozytorium przyjmującą `userId` jako pierwszy argument**. D1 nie ma RLS, więc ta
warstwa pozostaje jedynym mechanizmem izolacji danych między kontami — zmienia się tylko to,
że `userId` przychodzi z podpisanego tokenu Clerka, a nie z naszej tabeli sesji.

## Analiza bieżącego stanu

- **Auth: nie istnieje.** Zero dostawcy, sesji, tokenów, ciasteczek i hashowania w całym drzewie
  źródeł.
- **D1: podłączone, puste.** Binding `DB` → baza `mealplan` (`wrangler.jsonc:40-45`) dochodzi do
  tras API przez [`getWorkerEnv()`](../../../src/server/env.ts) — potwierdzone na produkcji
  (`/api/health` zwraca `d1: true`). Zero tabel, zero migracji, brak katalogu `migrations/`.
- **Trasy API: jedna.** [health+api.ts](../../../src/app/api/health+api.ts) jest smoke testem
  wdrożenia; sięga po `DB` bezpośrednio, bo nie ma jeszcze do czego się podłączyć.
- **Router: same ekrany startera.** [_layout.tsx](../../../src/app/_layout.tsx) montuje `AppTabs`
  **bezwarunkowo** (`_layout.tsx:15`), a trasy to `index.tsx` i `explore.tsx` — obie publiczne.
- **Zakładki są rozdwojone.** Natywnie `NativeTabs.Trigger name="index"` musi odpowiadać nazwie
  pliku trasy (`app-tabs.tsx:15,23`); na webie `TabTrigger name="home" href="/"` wiąże `href`
  (`app-tabs.web.tsx:24,27`). Każda zmiana struktury tras dotyka obu plików.
- **Brak prymitywu pola tekstowego.** W `src/components/ui/` jest tylko `collapsible.tsx`; żaden
  ekran w repo nie ma jeszcze formularza.
- **Sekrety: żadne.** Ścieżka `wrangler secret put` jest przygotowana, ale nieużyta.
  `.gitignore` **już obejmuje** `.dev.vars`, `.wrangler/` i `.wrangler-dry/`
  (`.gitignore:36-39`, weszły razem z wdrożeniem) — nie ma tu nic do dopisania, zostaje
  wyłącznie potwierdzenie przed pierwszym sekretem.
- **Auto-deploy z `main` jest włączony i bezwarunkowy.** Workers Builds: push na `main` → build
  (`npx expo export -p web`) → `npx wrangler deploy`, bez udziału człowieka
  ([deploy-plan.md](../../deployment/deploy-plan.md), sekcja *Auto-deploy z `main`*). Każdy commit
  fazy wchodzi na produkcję natychmiast, więc **każdy warunek produkcyjny musi być spełniony przed
  commitem fazy, która od niego zależy**, a nie na końcu zmiany.
- **Brak runnera testów.** „Przetestowane" znaczy: `npx tsc --noEmit` przechodzi i ekran został
  otwarty na realnej platformie.

## Pożądany stan końcowy

Na wdrożonym Workerze i w Expo Go na telefonie:

1. Nowy użytkownik zakłada konto e-mail + hasło i potwierdza adres **kodem wpisanym w aplikacji**;
   bez potwierdzenia konto nie powstaje.
2. Loguje się na webie i w aplikacji natywnej; sesja przetrwa zamknięcie aplikacji (na native
   dzięki `expo-secure-store`, na webie dzięki magazynowi przeglądarki obsługiwanemu przez Clerka).
3. Wejście na dowolną trasę produktową bez sesji kończy się przekierowaniem na ekran logowania,
   a zakładki nawet się nie montują.
4. Każda trasa API sięgająca po dane użytkownika weryfikuje token Clerka i przechodzi przez funkcję
   repozytorium z `userId` w pierwszym argumencie; bez tokenu dostaje 401, z cudzym tokenem nie
   widzi obcych wierszy.
5. Użytkownik, który zapomniał hasła, dostaje kod na e-mail i ustawia nowe — bez opuszczania
   aplikacji.
6. Zgadywanie hasła jest hamowane po stronie Clerka; nasz kod nie musi tego implementować.

Weryfikacja: przepływ konta ćwiczony lokalnie i w Expo Go, bramka tras sprawdzona na
`npx wrangler dev`, całość powtórzona na produkcji plus jeden przebieg na telefonie.
`npx tsc --noEmit`, `npx expo lint` i `npm run check-lock` czyste.

### Kluczowe odkrycia:

- **`@clerk/expo` 4.5.4 (25.08.2026) deklaruje `expo: ">=54 <58"`** — SDK 57 mieści się
  w zakresie; `react ^19`, `react-native >=0.75` również pasują. Dokumentacja Expo podaje starszy
  zakres (`>=53 <56`) i jest nieaktualna — źródłem prawdy jest `package.json` paczki.
- **Przepływ własnych ekranów działa w Expo Go i na webie.** Clerk rozdziela trzy podejścia:
  komponenty natywne (wymagają development buildu), hosted auth i **custom flow na hookach**
  (`useSignUp` / `useSignIn`) — tylko ten ostatni daje własny wygląd i działa w Expo Go, którym
  weryfikujemy ten kamień milowy.
- **Weryfikacja i reset idą kodem w aplikacji, nie linkiem.** `signUp.verifications.sendEmailCode()`
  → `verifyEmailCode({ code })`; reset: `signIn.resetPasswordEmailCode.sendCode()` →
  `verifyCode({ code })` → `submitPassword({ password })`. To usuwa cały problem „link kliknięty
  na innym urządzeniu", nad którym zastanawialiśmy się w wersji 1 planu.
- **API Core 3 jest inne niż większość przykładów w sieci.** Obowiązuje `signIn.password({...})`
  + `signIn.finalize({ navigate })`; **nie** `signIn.create()` + `setActive({ session })` — ta
  druga forma to `@clerk/expo/legacy`. Metody zwracają `{ error }`, nie rzucają wyjątkiem przy
  błędach walidacji.
- **Na Expo web sign-up wymaga kotwicy CAPTCHA** — `<View nativeID="clerk-captcha" />` na ekranie
  rejestracji. Na iOS i Androidzie Clerk ten krok pomija, więc brak kotwicy objawi się wyłącznie
  na webie.
- **`publishableKey` musi być podany jawnie** w `ClerkProvider`: zmienne środowiskowe wewnątrz
  `node_modules` nie są wstawiane do produkcyjnych buildów React Native.
- **Weryfikacja tokenu jest bezsieciowa.** `verifyToken(token, { jwtKey })` z `@clerk/backend`
  używa klucza publicznego PEM — zero rundy do Clerka, rząd wielkości ~2 ms na Workers.
  `@clerk/backend` jest kanonicznym SDK dla izolatów V8.
- **Bindingi nie są w `process.env`** — [env.ts:24-38](../../../src/server/env.ts) pozostaje
  jedynym kanałem (`globalThis`), bo `worker.ts` idzie przez esbuild, a trasy `+api.ts` przez
  Metro do `dist/server`.
- **`wrangler d1 migrations apply` czyta wyłącznie pliki `.sql` z najwyższego poziomu**
  `migrations_dir` (domyślnie `migrations/`) i nie schodzi do podkatalogów. Dlatego migracje
  wstecz mogą leżeć w `migrations/down/` bez ryzyka, że wrangler je uruchomi — pod warunkiem,
  że nie ustawimy `migrations_pattern`.
- **Plan Workers Paid przestaje być wymaganiem tej zmiany.** Był potrzebny wyłącznie dlatego, że
  hashowanie hasła nie mieści się w 10 ms CPU. Bez hashowania po naszej stronie darmowy plan
  wystarcza; Paid wraca jako temat przy generatorze (S-04).

## Czego NIE robimy

- **Żadnych danych profilowych** — wiek, waga, wzrost, płeć, aktywność to S-02
  (`profile-and-calorie-target`). Tu powstaje tylko konto i granica dostępu.
- **Żadnych preferencji, planu, listy zakupów** — S-03 i dalsze.
- **Żadnych passkeys, MFA ani komponentów natywnych Clerka** — wymagają development buildu albo
  wykraczają poza FR-001. PRD ma płaski model roli.
- **Żadnego logowania społecznościowego poza Google.** Google weszło do zakresu w wersji 2.2 planu
  (krok 11 fazy 1) i idzie przepływem przeglądarkowym `useSSO`, który działa w Expo Go. Natywny
  Google Sign-In (`@clerk/expo-google-signin`) pozostaje poza zakresem — wymaga development buildu.
- **Żadnego wywoływania Backend API Clerka** — `CLERK_SECRET_KEY` nie wchodzi do projektu. Worker
  używa wyłącznie klucza publicznego do weryfikacji podpisu.
- **Żadnej synchronizacji użytkowników webhookiem z Clerka** — tabela `app_user` powstaje leniwie,
  przy pierwszym uwierzytelnionym żądaniu.
- **Żadnego nadawcy maili po naszej stronie** — Resend wypada z zakresu, maile wysyła Clerk.
- **Żadnej edycji e-maila ani zmiany hasła z poziomu zalogowanego konta** (tylko reset).
- **Żadnej obsługi offline dla sesji** — S-09 domyka offline dla planu i listy zakupów.
- **Żadnego runnera testów** — bramką jest `tsc`, `lint` i przebieg ręczny.

## Podejście do implementacji

Cztery fazy. Kolejność wynika z jednej obserwacji: **przepływ logowania w ogóle nie dotyka naszego
Workera** — klient Clerka rozmawia bezpośrednio z Clerkiem. Dlatego konto, weryfikacja i bramka
tras powstają najpierw, w najszybszej możliwej pętli, a serwer dochodzi dopiero wtedy, gdy mamy
prawdziwy token, którym da się go sprawdzić.

Auto-deploy z `main` narzuca drugą regułę, niezależną od kolejności faz: **warunek produkcyjny
wchodzi w tej fazie, która go potrzebuje, a nie w fazie wdrożeniowej.** Fazy 1–2 nie ruszają
schematu D1, ale wystawiają na produkcję bundel webowy, który bez `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
w Workers Builds nie zna aplikacji Clerka — dlatego ta zmienna jest krokiem 3 fazy 1, nie fazy 4.
Tak samo migracja `--remote`: jest krokiem 4 fazy 3, bo `/api/account` powstaje w fazie 3 i jest
wdrażane w chwili, gdy commit tej fazy trafia na `main`. Faza 4 nie zakłada już warunków — tylko
je sprawdza i przeprowadza przebieg na dwóch platformach.

## Krytyczne szczegóły implementacji

**Czas i cykl życia.** `.dev.vars` i `.wrangler/` są już w `.gitignore` — potwierdź to
(`git check-ignore .dev.vars .wrangler/`) przed pierwszym `wrangler secret put` i przed pierwszym
`wrangler dev`. Migracja D1 idzie **przed** wdrożeniem kodu, który jej używa, a przy auto-deployu
z `main` „wdrożenie" znaczy „commit fazy" — więc `migrations apply --remote` wykonuje się w fazie 3,
przed jej commitem, a nie w fazie 4.

**Sekwencjonowanie stanu.** Na webie `output: "server"` renderuje HTML bez sesji (Clerk odtwarza
ją dopiero po hydracji), więc bramka tras nie może w pierwszym renderze zakładać ani „zalogowany",
ani „niezalogowany" — dopóki `useAuth()` zwraca `isLoaded === false`, ekran renderuje stan
neutralny. Inaczej przy każdym wejściu mignie ekran logowania. Nie da się tego załatać `setState`
w efekcie: `react-hooks/set-state-in-effect` jest w tym repo **błędem lintu**.

**Transport tokenu jest jednolity.** Zarówno web, jak i native wysyłają `Authorization: Bearer`
z `getToken()`. Nasz Worker nigdy nie czyta ciasteczek — to jedna ścieżka do zaimplementowania
i jedna do przetestowania.

**`getToken()` rzuca, gdy nie ma sieci.** W Core 3 przy braku połączenia leci `ClerkOfflineError`
zamiast `null` — czyli „offline" i „wylogowany" to dwa różne stany i nie wolno ich mylić w kodzie
odpytującym API. Typ importuje się z `@clerk/react/errors` (`@clerk/expo` nie reeksportuje go).

**Debugowanie i obserwowalność.** Lokalna baza `wrangler dev` żyje w `.wrangler/state`; zaglądasz
przez `npx wrangler d1 execute mealplan --local --command "…"`. Na produkcji to samo z `--remote`
(wyłącznie odczyt) plus `npx wrangler tail`. Clerk ma własny dashboard z logami — na darmowym
planie 1 dzień retencji.

---

## Phase 1: Konto po stronie klienta i bramka tras

### Przegląd

Rejestracja z kodem weryfikacyjnym, logowanie, wylogowanie i odcięcie tras produktowych — wszystko
bez udziału naszego backendu.

### Wymagane zmiany:

#### 1. Zależności

**Plik**: `package.json`, `package-lock.json`

**Cel**: dołożyć SDK Clerka i magazyn, w którym trzyma token na urządzeniu.

**Kontrakt**: `@clerk/expo` (≥ 4.5.4) oraz `expo-secure-store`; `expo-constants` i
`expo-web-browser` już są w projekcie i spełniają zakresy peer. Paczki `expo-*` instaluj przez
`npx expo install`. Po instalacji **obowiązkowo** `npm run check-lock`; jeśli zgłosi niespójność,
lock regeneruj na Linuksie zasianym obecnym plikiem — procedura w
[deploy-plan.md](../../deployment/deploy-plan.md), sekcja o `@emnapi`.

*(Aneks 2.4, po przeglądzie fazy 1: `npx expo install` dopisuje pluginy `@clerk/expo`
i `expo-secure-store` do `app.json` → `plugins`. **Zostają**: konfigurują wyłącznie projekt natywny
— iOS deployment target 17.0 i filtr intentów `clerk://…hosted-callback` na Androidzie — bez
efektu w Expo Go i na webie, a pierwszy development build ich wymaga. `slug` i `scheme`
nietknięte.)*

#### 2. Konfiguracja instancji Clerka (krok człowieka, nie kodu)

**Plik**: — (dashboard Clerka)

**Cel**: włączyć dokładnie te metody, których używa kod, i wyłączyć resztę.

**Kontrakt**: aplikacja na planie Hobby; włączone **E-mail + hasło**, weryfikacja adresu
**kodem** (`email_code`), reset hasła **kodem** na e-mail. Wyłączone: logowanie społecznościowe,
MFA, passkeys. Skopiowany publishable key i **PEM public key** (Dashboard → API Keys → PEM Public
Key) — ten drugi wejdzie do sekretów w fazie 3. Kod implementuje wyłącznie strategie faktycznie
włączone w dashboardzie; rozjazd objawia się błędem dopiero w runtime.

#### 3. Klucz publikowalny — lokalnie **i** w środowisku buildu

**Plik**: `.env.local`, panel Cloudflare → Workers Builds *(klucz nie wchodzi do `app.json`;
jedyną zmianę w `app.json` robi krok 1 — pluginy)*

**Cel**: dać klientowi klucz, który musi być wstawiony do bundla przy eksporcie — w obu miejscach,
gdzie ten eksport się odbywa.

**Kontrakt**: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` w `.env.local` (plik jest już objęty
`.gitignore` przez wzorzec `.env*.local`) **oraz** jako zmienna środowiskowa buildu w Workers
Builds. `expo export` czyta ją w momencie budowania, nie w runtime, więc nie jest sekretem
Workera. **Oba wpisy powstają przed pierwszym commitem tej fazy**: push na `main` uruchamia build
natychmiast, a klucz ustawiony wyłącznie lokalnie daje działający `wrangler dev` i martwą
produkcję ([deploy-plan.md](../../deployment/deploy-plan.md), *Czego to wdrożenie NIE rozstrzyga*).
To krok przeniesiony tu z fazy 4 — patrz reguła w „Podejściu do implementacji".

#### 4. Dostawca sesji

**Plik**: `src/app/_layout.tsx`

**Cel**: zamontować Clerka nad całym drzewem i zdjąć zakładki z korzenia.

**Kontrakt**: `<ClerkProvider publishableKey={…} tokenCache={tokenCache}>` opakowuje
`ThemeProvider`; `tokenCache` importowany z `@clerk/expo/token-cache`. `publishableKey` podany
**jawnie** jako prop. `AppTabs` **znika** z tego pliku (dziś `_layout.tsx:15`) i przenosi się do
layoutu grupy `(app)`; w korzeniu zostaje `<Stack screenOptions={{ headerShown: false }}>`.
Kolejność splash (`preventAutoHideAsync` w module, `hideAsync` w `onLayout` nakładki) zostaje
nietknięta. `useColorScheme` przechodzi z `react-native` na
[`@/hooks/use-color-scheme`](../../../src/hooks/use-color-scheme.ts).

#### 5. Bramka bundlowania — zaraz po `ClerkProvider`, przed ekranami

**Plik**: — (operacja, nie plik)

**Cel**: dowiedzieć się, czy `@clerk/expo` przechodzi przez Metro, **zanim** powstaną trzy ekrany
i prymityw pola.

**Kontrakt**: `npx expo export -p web` uruchamiane natychmiast po kroku 4, na drzewie w którym
jedyną zmianą jest `ClerkProvider` z `tokenCache`. `app.json` ma `web.output: "server"`, więc
eksport prerenderuje trasy w Node — z `ClerkProvider` i `expo-secure-store` w drzewie. To ta sama
klasa ryzyka („ciężka biblioteka auth bundlowana przez Metro"), która przewróciła wersję 1 planu,
tylko po stronie klienta. Jeśli eksport padnie, **to jest bloker do eskalacji, nie rzecz do
łatania w locie** — zatrzymaj fazę i wróć do decyzji o dostawcy. Koszt tej bramki to jedno
polecenie; koszt jej pominięcia to trzy ekrany do wyrzucenia.

#### 6. Przeniesienie tras produktowych do grupy

**Plik**: `src/app/index.tsx` → `src/app/(app)/index.tsx`, `src/app/explore.tsx` → `src/app/(app)/explore.tsx`

**Cel**: oddzielić trasy wymagające sesji od publicznych, bez zmiany adresów URL.

**Kontrakt**: grupa `(app)` nie zmienia ścieżek (`/` i `/explore` zostają), więc
`NativeTabs.Trigger name="index"` i `TabTrigger href="/"` dalej pasują. Treść obu ekranów bez
zmian — to przeniesienie plików, nie przepisanie.

#### 7. Layout grupy chronionej

**Plik**: `src/app/(app)/_layout.tsx`

**Cel**: jedno miejsce decydujące, czy widok produktowy w ogóle się zmontuje.

**Kontrakt**: czyta `useAuth()`; przy `!isLoaded` renderuje **stan neutralny**, przy `!isSignedIn`
zwraca `<Redirect href="/sign-in" />`, w przeciwnym razie montuje `<AppTabs />`.

„Stan neutralny" to konkretnie: `<ThemedView type="background" style={{ flex: 1 }} />` — pełny
ekran w kolorze tła, bez przekierowania, bez zakładek i bez wskaźnika ładowania. To nie jest
detal kosmetyczny: `AnimatedSplashOverlay` woła `hideAsync()` w `onLayout`
([_layout.tsx:14](../../../src/app/_layout.tsx#L14)), czyli **zanim** Clerk skończy się ładować,
więc ten kadr jest tym, co użytkownik faktycznie widzi między splashem a decyzją bramki — i tym,
co ocenia kryterium 1.10. Kolejność splash zostaje nietknięta (patrz krok 4); jeśli kadr okaże się
zauważalny, właściwą poprawką jest utrzymanie nakładki splash do `isLoaded`, a nie `setState`
w efekcie — `react-hooks/set-state-in-effect` jest w tym repo błędem lintu.

#### 8. Prymityw pola tekstowego

**Plik**: `src/components/ui/text-field.tsx`, `src/constants/theme.ts`

**Cel**: pole formularza zgodne z motywem, bo w repo nie ma żadnego, a powstanie ich teraz kilka.

**Kontrakt**: opakowuje `TextInput`; kolor z `useTheme()`, odstęp i promień ze `Spacing` — **zero
surowych kolorów i liczb**. Propsy: etykieta, komunikat błędu, `secureTextEntry`, tryb klawiatury.
Bez `useMemo`/`useCallback`/`React.memo` — `reactCompiler` jest włączony.

*(Aneks 2.4, po przeglądzie fazy 1: paleta `Colors` w `theme.ts` zyskuje `textDanger` w obu trybach
— komunikat błędu przy zakazie surowych kolorów nie ma innego źródła barwy. Nowy wpis rozszerza typ
`ThemeColor`, więc jest dostępny w `ThemedText` przez `themeColor="textDanger"`.)*

#### 9. Rejestracja z weryfikacją kodem

**Plik**: `src/app/(auth)/sign-up.tsx`

**Cel**: dwuetapowy ekran: dane konta, potem kod z maila.

**Kontrakt**: `useSignUp()` → `signUp.password({ emailAddress, password })` →
`signUp.verifications.sendEmailCode()` → ekran kodu →
`signUp.verifications.verifyEmailCode({ code })` → `signUp.finalize()` (bez `navigate` — patrz krok 10). Krok kodu
pokazywany, gdy `signUp.status === 'missing_requirements'`
i `signUp.unverifiedFields` zawiera `email_address`. Błędy z `errors.fields.*` renderowane przy
polach, nie w alercie. **Ekran musi zawierać `<View nativeID="clerk-captcha" />`** — bez niego
rejestracja na webie się nie powiedzie.

#### 10. Logowanie i wylogowanie

**Plik**: `src/app/(auth)/sign-in.tsx`, `src/app/(app)/index.tsx`

**Cel**: wejście do aplikacji i wyjście z niej.

**Kontrakt**: `useSignIn()` → `signIn.password({ emailAddress, password })`; przy
`signIn.status === 'complete'` → `signIn.finalize()` **bez `navigate`**. Po aktywacji sesji
przekierowuje wyłącznie bramka grupy `(auth)` (krok 12) — nawigacja po zmianie sesji ma jednego
właściciela, symetrycznie do wylogowania. *(Wersja 2.4: pierwotny wariant `navigate` +
`decorateUrl` odrzucony po przeglądzie fazy 1 — `decorateUrl` zwraca absolutny URL, który Expo
Router traktuje jako zewnętrzny i robi pełne przeładowanie; guard `currentTask` był martwy, bo
bramka przekierowywała i tak.)* Wylogowanie:
`signOut()` z `useClerk()` na ekranie startowym — po nim layout grupy przestaje widzieć sesję
i router sam trafia na `/sign-in`. Reszta zawartości ekranu startera zostaje.

#### 11. Logowanie przez Google (SSO w przeglądarce)

**Plik**: `package.json`, `src/app/sso-callback.tsx`,
`src/components/ui/google-sign-in-button.tsx`, `src/app/(auth)/sign-in.tsx`,
`src/app/(auth)/sign-up.tsx`

**Cel**: dać drugą drogę wejścia, która nie wymaga wymyślania hasła — bez schodzenia z Expo Go.

**Kontrakt**: `expo-auth-session` i `expo-crypto` doinstalowane przez `npx expo install`
(`expo-web-browser` już jest). Hook to **`useSSO` z `@clerk/expo/experimental`**, nie
z `@clerk/expo`: tylko wariant eksperymentalny stoi na zasobach Core 3, ten drugi woła w środku
`@clerk/react/legacy` i wprowadziłby do aplikacji drugi, niezgodny model sesji obok
`signIn.password`. `startSSOFlow({ strategy: 'oauth_google' })` domyka sesję sam (woła `finalize()`
w środku), a przekierowanie na `/` robi bramka `(auth)` — po stronie przycisku nie ma nawigacji. Metoda **rzuca wyjątkiem**
przy błędzie, w odróżnieniu od `signIn.password`, które zwraca `{ error }` — stąd `try/catch`.
Zamknięcie okna przez użytkownika **nie jest błędem**: `authSessionResult.type` jest wtedy inny niż
`success` i ekran po prostu zostaje na formularzu.

Trasa `/sso-callback` jest publiczna (poza grupą `(app)`) i woła `WebBrowser.maybeCompleteAuthSession()`
**w zakresie modułu**. Na webie `startSSOFlow` otwiera okno wyskakujące i ta trasa jest jego
lądowaniem — bez niej okno nigdy nie odda wyniku i przepływ wisi. Na iOS i Androidzie trasa nie
jest oglądana, a wywołanie zwraca tam `{ type: 'failed' }` zamiast rzucać. Podczas prerenderu
`window` nie istnieje i implementacja webowa też zwraca `failed`, więc eksport się nie wywraca.

**Krok człowieka w dashboardzie Clerka**: adresy przekierowania muszą być na białej liście —
webowy (`<origin>/sso-callback`) **oraz** ten z Expo Go, który zawiera adres IP w sieci lokalnej
(`exp://<ip>:8081/--/sso-callback`) i **zmienia się razem z siecią**. Bez wpisu callback wraca bez
`rotating_token_nonce` i logowania nie da się domknąć. To najczęstsza przyczyna „działa na webie,
nie działa na telefonie" w tym przepływie.

#### 12. Bramka grupy `(auth)` i ponowna wysyłka kodu

**Plik**: `src/app/(auth)/_layout.tsx`, `src/app/(auth)/sign-up.tsx`

**Cel**: domknąć dwie luki, które wyszły w testach ręcznych — zalogowany użytkownik oglądał
formularz logowania, a zgubiony mail z kodem zostawiał rejestrację w martwym punkcie.

**Kontrakt**: layout grupy `(auth)` jest odwrotnością bramki `(app)`: przy `!isLoaded` stan
neutralny, przy `isSignedIn` `<Redirect href="/" />`, inaczej `<Stack screenOptions={{ headerShown:
false }} />`. Jest **jedynym właścicielem nawigacji po zmianie sesji** — ekrany auth nie
nawigują same (wersja 2.4). Skutek uboczny (zmierzony 2026-09-08): ekrany `/sign-in`, `/sign-up`
i `/forgot-password` prerenderują się do stanu neutralnego (HTML identyczny z `/`), a formularz
pojawia się po załadowaniu Clerka (~80 ms) — ta sama cena, którą płaci bramka `(app)`, w zamian
za brak mignięcia formularza u zalogowanego. Bez tego Clerk odrzuca rejestrację drugiego konta w tej samej przeglądarce błędem
„You're already signed in" — poprawnie wyświetlonym, ale bezużytecznym dla użytkownika.

Ekran kodu w `sign-up.tsx` ma link **„Nie dostałem kodu, wyślij ponownie"** wołający
`signUp.verifications.sendEmailCode()` jeszcze raz; po sukcesie etykieta zmienia się na
potwierdzenie. Clerk pamięta rozpoczętą rejestrację między odświeżeniami, ale **nie** wysyła kodu
ponownie sam — stąd link. Błąd wysyłki renderuje się w `errors.global`, jak dotąd.

**Ustalenia z testów, które warto znać przed fazą 2**: instancja ma `min_length: 15` dla haseł
(polityka Clerka, nie nasz kod) — krótsze hasło kończy `POST /sign_ups` błędem 400 **przed**
wysyłką kodu, co wygląda jak „nie doszło"; instancja deweloperska dostarcza maile
z `notifications@accounts.dev` w ~5 s; adresy z sufiksem `+clerk_test` przyjmują kod `424242`
bez wysyłki.

### Kryteria sukcesu:

#### Automated Verification:

- `npm run check-lock` przechodzi po dodaniu zależności
- `npx tsc --noEmit` czyste — przy `typedRoutes` to jednocześnie dowód, że `href="/sign-in"`
  i pozostałe trasy istnieją
- `npx expo lint` czyste, w szczególności bez `react-hooks/set-state-in-effect`
- `npx expo export -p web` i `npx wrangler deploy --dry-run --outdir .wrangler-dry` przechodzą,
  a lista modułów nadal nie zawiera niczego z `node_modules`
- Bramka bundlowania: `npx expo export -p web` przeszedł po kroku 4, **przed** napisaniem ekranów
- `/sso-callback` jest w wyeksportowanych trasach i zwraca 200 na `npx wrangler dev`
- Zalogowany użytkownik wchodząc na `/sign-in` lub `/sign-up` trafia na `/`; niezalogowany widzi formularz

#### Manual Verification:

- `git check-ignore .dev.vars .wrangler/` potwierdza oba wpisy, sprawdzone przed pierwszym sekretem
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` jest ustawiony w Workers Builds, **zanim** commit tej fazy
  trafi na `main` — inaczej auto-deploy wystawia produkcję bez tożsamości aplikacji
- W przeglądarce: rejestracja → kod z maila → konto aktywne → wylogowanie → logowanie
- W Expo Go na telefonie: ten sam przepływ, a po zamknięciu i ponownym otwarciu aplikacji sesja
  jest zachowana bez logowania (dowód, że `tokenCache` działa)
- Na `npx wrangler dev` (zbudowany `dist/`): wejście na `/` i na `/explore` bez sesji przekierowuje
  na `/sign-in`, a zakładki nie migają ani przez moment po pierwszym renderze
- Zakładki działają na webie i natywnie po przeniesieniu tras do grupy `(app)`
- Adresy przekierowania SSO — webowy i ten z Expo Go — są na białej liście w dashboardzie Clerka
- W przeglądarce: „Zaloguj się przez Google" zakłada konto i wpuszcza do zakładek
- W Expo Go: ten sam przepływ wraca z przeglądarki do aplikacji i zachowuje sesję

**Uwaga implementacyjna**: przepływ konta nie dotyka Workera, więc do jego ćwiczenia wystarczy
`npx expo start --web` i Expo Go. Bramkę tras sprawdzasz **wyłącznie** na `npx wrangler dev`, bo
to jedyne miejsce, gdzie widać zachowanie serwerowego renderowania i hydracji. Po tej fazie
zatrzymaj się na ręczne potwierdzenie.

---

## Phase 2: Reset hasła

### Przegląd

Trzyetapowy przepływ w aplikacji: adres → kod z maila → nowe hasło. Bez opuszczania aplikacji
i bez strony pośredniej.

### Wymagane zmiany:

#### 1. Ekran odzyskiwania hasła

**Plik**: `src/app/(auth)/forgot-password.tsx`

**Cel**: jedyna ścieżka powrotu dla użytkownika, który zapomniał hasła.

**Kontrakt** *(wersja 2.5 — skorygowany wobec zainstalowanego SDK 4.6.1)*: `useSignIn()` →
`signIn.create({ identifier: emailAddress })` → `signIn.resetPasswordEmailCode.sendCode()`
(**bez parametrów**; bez wcześniejszego `create` metoda rzuca „Cannot reset password without a sign
in”) → ekran kodu i nowego hasła → `signIn.resetPasswordEmailCode.verifyCode({ code })` (status
przechodzi w `needs_new_password`) → `signIn.resetPasswordEmailCode.submitPassword({ password })`
(nie `signIn.submitPassword`) → `signIn.finalize()` **bez `navigate`** — na `/` odsyła bramka
`(auth)` (v2.4). Jeśli `submitPassword` odrzuci hasło, ponowna próba pomija `verifyCode`
(sprawdzenie `signIn.status === 'needs_new_password'`), bo kod jest już zużyty.

Krok wysyłki kodu pokazuje tę samą odpowiedź niezależnie od tego, czy adres istnieje — inaczej
ekran staje się wyszukiwarką kont. Instancja ma **wyłączoną** *Enumeration protection*, więc
Clerk zwraca dla nieznanego adresu `form_identifier_not_found`; ekran maskuje to sam: przechodzi do
kroku kodu z tym samym tekstem, a każdy kod odrzuca komunikatem identycznym jak dla kodu błędnego.
**Maska ekranowa jest jedynym mechanizmem, jaki mamy** (ustalone 9.09.2026 wobec dashboardu). Clerk
daje dwa tryby w *Protect → Rules → User enumeration protection* (nie „Configure → Attack
protection" — ta strona już nie istnieje): *bulk* nakłada wyłącznie limity częstotliwości i
istnienia konta nie ukrywa, a *strict* stawia trzy warunki, z których jednego nie spełniamy —
**hasło nie może być pierwszą strategią logowania** (trzeba je wyłączyć albo ustawić preferowaną
strategię na OTP), a nasz ekran logowania zaczyna od `signIn.password()`. Pozostałe dwa warunki
(Open access mode, brak identyfikatorów typu username) spełniamy. Wniosek: strict jest poza
zasięgiem, dopóki logowanie jest hasło-pierwsze, a to zmiana produktowa poza FR-001. Tryb *bulk*
jest na instancji włączony (potwierdzone 9.09.2026, wiersz 2.6), więc limity częstotliwości mamy —
ale istnienia konta nie ukrywają. Granice maski, które zostają na stałe: 422 z FAPI widać
w zakładce Network, a zamaskowane odrzucenie kodu nie robi żądania, więc nie mruga stanem `busy`.

Błąd `sendCode()` dla konta istniejącego (np. tylko Google, bez czynnika hasła) też idzie pod maskę,
a każde odrzucenie kodu przez `verifyCode` pokazuje jedną treść (v2.6).

Ekran ma też link „Wróć do logowania" (`router.back()` gdy jest historia, inaczej
`push('/sign-in')`) — dodany w implementacji, aneks v2.6. Nie jest to nawigacja po zmianie sesji,
więc nie narusza zasady jednego właściciela z v2.4.

Krok kodu ma link „Nie dostałem kodu, wyślij ponownie" (jak rejestracja od v2.3): przy istniejącej
próbie woła `sendCode()` raz jeszcze, pod maską nic nie wysyła, a nagłówek w obu przypadkach mówi
„jeśli konto istnieje, wysłaliśmy kod ponownie". Link znika po przyjęciu kodu. Aneks v2.6.

#### 2. Wejście z ekranu logowania

**Plik**: `src/app/(auth)/sign-in.tsx`

**Cel**: bez odnośnika przepływ jest nieosiągalny.

**Kontrakt**: link „Nie pamiętam hasła" prowadzący na `/forgot-password`.

#### 3. Zaufanie nowego urządzenia *(aneks v2.8)*

**Plik**: `src/app/(auth)/sign-in.tsx`

**Cel**: wpuścić na konto z urządzenia, które go nie zakładało. Bez tego kroku konto utworzone
w przeglądarce jest na telefonie nieosiągalne, a wynik S-01 — nieosiągalny.

**Kontrakt**: gdy po `signIn.password({...})` status to `needs_client_trust` (hasło jest już
`verified` — brakuje potwierdzenia *klienta*, nie tożsamości), ekran woła
`signIn.mfa.sendEmailCode()` i przechodzi na etap kodu: `signIn.mfa.verifyEmailCode({ code })` →
status `complete` → `signIn.finalize()` **bez `navigate`**, bo na `/` odsyła bramka `(auth)` (v2.4).
Etap bierze się ze `signIn.status`, nie z lokalnego stanu — Clerk pamięta rozpoczętą próbę między
odświeżeniami, dokładnie jak rejestracja. Stąd też ten sam stan dostarczenia
(`pending` / `sent` / `resent` / `failed`) i link „Nie dostałem kodu, wyślij ponownie": po
odświeżeniu nie wiemy, czy poprzednia wysyłka doszła, więc tego nie twierdzimy.

Clerk oferuje dla tego kroku dokładnie jeden czynnik — `email_code` na adres konta
(`supportedSecondFactors: [{ strategy: 'email_code', primary: true }]`) — więc ekran nie ma czego
wybierać. Na etapie kodu chowają się Google, „Nie pamiętam hasła" i „Nie mam jeszcze konta", jak
w rejestracji. Komunikat o nieobsługiwanym kroku **zostaje**, dla statusów nadal nieznanych.

### Kryteria sukcesu:

#### Automated Verification:

- `npx tsc --noEmit` czyste
- `npx expo lint` czyste
- Logowanie na świeżym kliencie (wyczyszczone ciasteczka) przechodzi etap kodu urządzenia
  i kończy się aktywną sesją

#### Manual Verification:

- Reset przechodzi od początku do końca: kod dociera na e-mail, nowe hasło działa, stare nie
- Po resecie użytkownik jest zalogowany i trafia do zakładek
- Ten sam przepływ działa w Expo Go
- Logowanie w Expo Go na konto założone w przeglądarce domyka `needs_client_trust` kodem z maila

---

## Phase 3: Granica danych na serwerze

### Przegląd

Powstaje weryfikacja tokenu, pierwszy schemat D1, konwencja migracji i warstwa repozytorium —
czyli wszystko, co dziedziczy S-02 i każdy późniejszy fragment.

### Wymagane zmiany:

#### 1. Zależność i sekret weryfikacji

**Plik**: `package.json`, `.dev.vars`, sekret Workera

**Cel**: dać Workerowi możliwość sprawdzenia podpisu bez rundy sieciowej do Clerka.

**Kontrakt**: `@clerk/backend` w zależnościach; `CLERK_JWT_KEY` (klucz publiczny PEM z dashboardu)
ustawiony przez `npx wrangler secret put CLERK_JWT_KEY` i wpisany do lokalnego `.dev.vars`.
`CLERK_SECRET_KEY` **nie** wchodzi — nie wołamy Backend API. Po zmianie zależności ponownie
`npm run check-lock`.

Jeśli `@clerk/backend` nie przejdzie przez Metro do `dist/server` (ta sama klasa ryzyka, która
przewróciła wersję 1 planu), ścieżką odwrotu jest weryfikacja tokenu biblioteką `jose` przeciw
temu samemu kluczowi PEM, z jawnym sprawdzeniem `exp`, `nbf` i `azp`. Kontrakt `requireUserId`
poniżej się nie zmienia, więc podmiana dotyczy jednego pliku.

#### 2. Typy środowiska

**Plik**: `src/server/env.ts`

**Cel**: rozszerzyć kontrakt `WorkerEnv` i ręcznie deklarowany typ D1 tak, żeby dały się w nim
wyrazić zapytania repozytorium — zachowując jeden kanał `globalThis`.

**Kontrakt**: `WorkerEnv` zyskuje `CLERK_JWT_KEY: string`. Dodatkowo **`D1PreparedStatement`
zyskuje `bind(...values: unknown[]): D1PreparedStatement` i `run(): Promise<unknown>`** — dziś
([env.ts:16-22](../../../src/server/env.ts#L16-L22)) ma wyłącznie `first<T>()`, bo `health+api.ts`
niczego więcej nie potrzebował. Bez tego `touchAppUser` z kroku 5 (`prepare(...).bind(...)`,
`INSERT … ON CONFLICT DO UPDATE`) nie skompiluje się, a `npx tsc --noEmit` jest bramką tej samej
fazy. Typy zostają ręcznie deklarowane — **nie** wciągamy `@cloudflare/workers-types`, bo to
drugi zestaw globalnych typów obok React Native. Komentarz na górze pliku zostaje nietknięty:
opisuje mechanizm `globalThis`, nie typy.

#### 3. Weryfikacja tokenu

**Plik**: `src/server/auth.ts`

**Cel**: zamienić żądanie na `userId` albo na odpowiedź 401, w jednym miejscu, którego nie da się
obejść przypadkiem.

**Kontrakt**: `requireUserId(request: Request): Promise<{ userId: string } | Response>` — czyta
nagłówek `Authorization: Bearer`, woła `verifyToken(token, { jwtKey, authorizedParties })`
z `@clerk/backend` i zwraca `sub` jako `userId`. Przy braku lub niepoprawności tokenu zwraca
`Response` z 401 i ciałem JSON. Zwracanie `Response` zamiast rzucania wyjątku jest zamierzone:
trasa musi jawnie zdecydować, co robi.

`authorizedParties` wyliczone wprost, bez „i tak dalej": **adres produkcyjny Workera**,
`http://localhost:8787` (`wrangler dev`) i `http://localhost:8081` (`expo start --web`). Trzeci
wpis nie jest nadmiarowy — plan sam dopuszcza `expo start --web` do ćwiczenia przepływów Clerka
(patrz *Strategia testowania*), a kryterium 3.12 wymaga tokenu z działającej aplikacji; token
z originu poza listą wróci jako 401 nieodróżnialne od zepsutej weryfikacji. Tokeny z Expo Go nie
mają originu przeglądarki, więc nie mają też roszczenia `azp` — **potwierdź w tej fazie, że
`verifyToken` przepuszcza token bez `azp`** (kryterium 3.9); jeśli nie, listę zastępuje jawne
pominięcie sprawdzenia dla klientów natywnych, opisane w komentarzu pliku.

#### 4. Pierwsza migracja i migracja wstecz

**Plik**: `migrations/0001_app_user.sql`, `migrations/down/0001_app_user.down.sql`

**Cel**: dać własnym danym użytkownika lokalną tożsamość, do której dowiążą się profil (S-02),
preferencje (S-03) i plany (S-04).

**Kontrakt**: tabela `app_user(id TEXT PRIMARY KEY, created_at TEXT NOT NULL, last_seen_at TEXT
NOT NULL)`, gdzie `id` to identyfikator użytkownika z Clerka (`sub`). **Żadnych danych
tożsamościowych** — e-mail i hasło zostają u Clerka i nie są tu duplikowane. Plik tworzony przez
`npx wrangler d1 migrations create mealplan app_user`; plik wstecz pisany ręcznie
(`DROP TABLE IF EXISTS`) i leży w podkatalogu `down/`, którego wrangler nie czyta. `migrations_dir`
zostaje domyślny (`migrations/`), a `migrations_pattern` **nie** jest ustawiane — jego ustawienie
zaczęłoby zamiatać `down/`.

**Migracja idzie na produkcję w tej fazie, nie w fazie 4**: `npx wrangler d1 migrations apply
mealplan --local` do pracy, a `--remote` **przed commitem tej fazy**. Auto-deploy z `main` wystawia
`/api/account` w chwili pushu, więc odłożenie `--remote` do fazy 4 zostawia trasę czytającą
nieistniejącą tabelę — to okno 500, przed którym ostrzegają „Krytyczne szczegóły implementacji".
Migracja jest addytywna i do kroku 6 nie ma czytelnika, więc położenie jej wcześniej nic nie
kosztuje. Migracje **nie** idą przez CI i pozostają krokiem ręcznym.

#### 5. Warstwa repozytorium

**Plik**: `src/server/repository/app-users.ts`

**Cel**: utrwalić kontrakt „dostęp do danych użytkownika wyłącznie przez funkcję z `userId`
w pierwszym argumencie" — jedyny mechanizm izolacji, jaki mamy na D1.

**Kontrakt**: `touchAppUser(userId: string): Promise<{ id, createdAt, lastSeenAt }>` — wstawia
wiersz przy pierwszym kontakcie i aktualizuje `last_seen_at` przy kolejnych (`INSERT … ON CONFLICT
DO UPDATE`). Zapytania budowane przez `getWorkerEnv().DB.prepare(...).bind(...)`, **zawsze**
z warunkiem po `userId`; żadnej funkcji zwracającej listę wszystkich użytkowników. Nagłówek pliku
nazywa regułę wprost, bo to on jest wzorcem odniesienia dla S-02 i dalszych.

#### 6. Trasa odniesienia

**Plik**: `src/app/api/account+api.ts`

**Cel**: jedyny sposób, żeby izolację dało się sprawdzić ręcznie przed S-02 — i szablon, z którego
powstaną trasy profilu, preferencji i planu.

**Kontrakt**: `GET` → `requireUserId` → `touchAppUser(userId)` → JSON. Zero SQL-a w pliku, zero
sięgania po `getWorkerEnv()`. Komentarz w pliku mówi, że to nie jest funkcja produktowa, żeby
trasa nie obrosła w pola należące do S-02.

#### 7. Transport tokenu po stronie klienta

**Plik**: `src/lib/api.ts`, `src/app/(app)/index.tsx`

**Cel**: domknąć drugą połowę granicy danych. Bez tego pliku kontrakt „klient wysyła token
nagłówkiem `Authorization: Bearer`" istnieje wyłącznie w prozie — w `CLAUDE.md` i w akapicie
*Transport tokenu jest jednolity* — a S-02 wymyśli go od zera. To odpowiednik
`src/server/repository/` po stronie klienta: jedno miejsce, przez które idzie każde żądanie
do własnego API.

**Kontrakt**: `authedFetch(path: string, init?: RequestInit): Promise<Response>` — bierze token
z `getToken()` (z `useAuth()`), dokłada `Authorization: Bearer <token>` i zwraca odpowiedź.
**Rozróżnia trzy stany, nie dwa**: brak sesji (`getToken()` zwraca `null` → nie wysyłamy żądania),
brak sieci (`ClerkOfflineError` z `@clerk/react/errors` — `@clerk/expo` go nie reeksportuje) oraz
odpowiedź serwera. Mylenie „offline" z „wylogowany" jest tu jedynym realnym błędem, bo drugie
oznacza wyrzucenie użytkownika z aplikacji.

`(app)/index.tsx` woła `authedFetch('/api/account')` raz przy wejściu i pokazuje zwrócony `userId`
— to czyni kryterium 4.9 (`wrangler tail` widzi ruch z produkcji) osiągalnym przez działającą
aplikację, a nie tylko przez ręczny `curl`, i daje przepływowi *offline* miejsce, w którym da się
go w ogóle wywołać.

### Kryteria sukcesu:

#### Automated Verification:

- `npm run check-lock`, `npx tsc --noEmit` i `npx expo lint` czyste
- `npx wrangler d1 migrations apply mealplan --local` stosuje `0001` bez błędu, a
  `npx wrangler d1 migrations list mealplan --local` nie pokazuje zaległych
- `npx wrangler deploy --dry-run --outdir .wrangler-dry` nadal nie wciąga niczego z `node_modules`
- Na `wrangler dev`: `GET /api/account` bez nagłówka `Authorization` zwraca 401
- Na `wrangler dev`: `GET /api/account` z tokenem konta A zwraca `userId` konta A i tworzy wiersz
  w `app_user` (sprawdzone `wrangler d1 execute --local`)
- Na `wrangler dev`: `GET /api/account` z tokenem konta B zwraca `userId` konta B, a wiersz konta A
  pozostaje nietknięty
- `GET /api/account` z tokenem po wygaśnięciu (albo z ręcznie zepsutym podpisem) zwraca 401
- `GET /api/health` nadal zwraca `{"ok":true,"d1":true}`
- Token z Expo Go (bez roszczenia `azp`) przechodzi weryfikację przy wyliczonej liście
  `authorizedParties` — jeśli nie, kontrakt kroku 3 wymaga poprawki przed dalszą pracą
- `npx wrangler d1 migrations list mealplan --remote` nie pokazuje zaległych **przed** commitem tej
  fazy, bo auto-deploy wystawi `/api/account` natychmiast po pushu

#### Manual Verification:

- `grep` po `src/app/api/` potwierdza, że żadna trasa poza `health+api.ts` nie woła
  `getWorkerEnv()` ani `prepare(` — cały dostęp idzie przez `src/server/repository/`
- Token do testów pozyskany z działającej aplikacji z fazy 1 (`getToken()`), a nie wygenerowany
  ręcznie — inaczej test nie dowodzi, że produkcyjny przepływ się zgadza
- Na `wrangler dev`: ekran startowy pokazuje `userId` pobrany przez `authedFetch`, a po wyłączeniu
  sieci komunikuje brak połączenia **bez** wylogowania użytkownika

---

## Phase 4: Wdrożenie i przebieg na dwóch platformach

### Przegląd

Potwierdzenie, że warunki produkcyjne rzeczywiście weszły w swoich fazach, pełny przebieg
w przeglądarce i na telefonie, oraz aktualizacja reguł projektu, bo ta zmiana je zmienia.

Ta faza **nie zakłada już żadnego warunku produkcyjnego** — zmienna buildu weszła w fazie 1
(krok 3), sekret `CLERK_JWT_KEY` i migracja `--remote` w fazie 3 (kroki 1 i 4). Zostaje sprawdzenie
i przebieg.

### Wymagane zmiany:

#### 1. Potwierdzenie stanu produkcji

**Plik**: — (operacja, nie plik)

**Cel**: udowodnić, że nic nie zostało odłożone — bo przy auto-deployu z `main` produkcja już
działa na kodzie wszystkich czterech faz.

**Kontrakt**: trzy sprawdzenia przed przebiegiem: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` jest
w zmiennych buildu Workers Builds, `npx wrangler secret list` pokazuje `CLERK_JWT_KEY`,
a `npx wrangler d1 migrations list mealplan --remote` nie pokazuje zaległych. Jeśli któreś
zawiedzie, produkcja jest zepsuta **teraz** i naprawa idzie przed przebiegiem, nie po nim.

#### 2. Wdrożenie

**Plik**: — (operacja, nie plik)

**Cel**: mieć na produkcji dokładnie to drzewo, które przechodzi weryfikację lokalną.

**Kontrakt**: normalnie wystarcza push na `main` — Workers Builds robi `npx expo export -p web`
+ `npx wrangler deploy` sam. Ręczny deploy z lokalnego drzewa (`npx expo export -p web`, potem
`npx wrangler deploy`) jest ścieżką awaryjną, gdy build w Workers Builds padnie. Migracje **nie**
idą przez CI i pozostają krokiem ręcznym — do tej fazy są już zastosowane.

#### 3. Aktualizacja reguł projektu

**Plik**: `CLAUDE.md`

**Cel**: reguły opisują stan po tej zmianie, a nie przed nią.

**Kontrakt**: sekcja *Architektura* mówi, że tożsamość prowadzi Clerk, że `userId` pochodzi
z podpisanego tokenu weryfikowanego kluczem PEM, że D1 nie przechowuje danych tożsamościowych,
że dostęp do danych idzie przez `src/server/repository/` z `userId` w pierwszym argumencie i że
trasy produktowe mieszkają w grupie `(app)` za bramką sesji. Sekcja *Struktura i konwencje* zyskuje
`src/server/repository/`, `src/lib/api.ts` (jedyny kanał żądań klienta do własnego API — po stronie
klienta to, czym repozytorium jest po stronie serwera) i `migrations/`. Sekcja *Komendy
i weryfikacja* zyskuje kolejność migracji, informację, że migracje wstecz leżą w `migrations/down/`
i uruchamia je wyłącznie człowiek, oraz regułę wynikającą z auto-deployu: **warunek produkcyjny
(zmienna buildu, sekret, migracja `--remote`) wchodzi przed commitem fazy, która go potrzebuje** —
push na `main` wdraża natychmiast. Usunięte zdanie o nierozstrzygniętej decyzji o auth.

### Kryteria sukcesu:

#### Automated Verification:

- `npx tsc --noEmit`, `npx expo lint`, `npm run check-lock` czyste
- `npx wrangler d1 migrations list mealplan --remote` nie pokazuje zaległych migracji
- Po wdrożeniu: `GET /` zwraca HTML, nieznana ścieżka zwraca 404, `GET /api/health` zwraca
  `{"ok":true,"d1":true}`
- Na produkcji: `GET /api/account` bez tokenu zwraca 401, a z ważnym tokenem zwraca `userId`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` jest w zmiennych buildu Workers Builds, a
  `npx wrangler secret list` pokazuje `CLERK_JWT_KEY` — oba weszły we wcześniejszych fazach

#### Manual Verification:

- Pełny przebieg na produkcji w przeglądarce: rejestracja → kod → logowanie → zakładki →
  wylogowanie → blokada tras
- Przebieg w Expo Go na telefonie wskazującym na produkcję: logowanie, zamknięcie aplikacji,
  ponowne otwarcie — sesja zachowana; wylogowanie ją czyści
- To samo konto pokazuje ten sam stan w przeglądarce i na telefonie — dosłowny wynik S-01
- `npx wrangler tail` pokazuje żądania `/api/account` z produkcji bez błędów
- `CLAUDE.md` opisuje stan po zmianie

---

## Strategia testowania

Repo nie ma runnera testów i ta zmiana go nie wprowadza. Weryfikacja opiera się na trzech
warstwach:

### Sprawdzenia automatyczne

- `npx tsc --noEmit` — jedyne realne sprawdzenie poprawności w tym repo; przy `typedRoutes` łapie
  też nieistniejące trasy w `<Link href>` i `<Redirect href>`
- `npx expo lint` — w szczególności reguły React Compilera
- `npm run check-lock` — po każdej zmianie zależności, przed pushem
- `npx wrangler deploy --dry-run --outdir .wrangler-dry` — lista modułów; wzrost o cokolwiek
  z `node_modules` znaczy, że `rules` zostały naruszone

### Sprawdzenia po HTTP

Trasy API ćwiczone `curl`-em na `npx wrangler dev` z prawdziwym tokenem z aplikacji, plus
`wrangler d1 execute --local` do zaglądania w bazę. `npx expo start --web` jest dopuszczalne
**wyłącznie** do ćwiczenia przepływów Clerka, które nie dotykają Workera; dla wszystkiego, co
dotyka `+api.ts` albo renderowania serwerowego, bramką pozostaje `wrangler dev`.

### Kroki testowania ręcznego

1. Rejestracja nowego konta, kod z maila, potwierdzenie
2. Logowanie, przejście po zakładkach, wylogowanie, próba wejścia na `/explore` bez sesji
3. Reset hasła: kod, nowe hasło, sprawdzenie, że stare nie działa
4. Drugie konto: `GET /api/account` z jego tokenem nie pokazuje wiersza pierwszego
5. Expo Go: logowanie, zamknięcie aplikacji, ponowne otwarcie — sesja zachowana

## Uwagi dotyczące wydajności

Weryfikacja tokenu z kluczem PEM jest lokalna i mieści się w pojedynczych milisekundach CPU, więc
**limit 10 ms planu darmowego przestaje być problemem tej zmiany** — to jedyny powód, dla którego
wersja 1 planu wymagała planu Paid. Paid wraca do rozważenia przy generatorze (S-04), zgodnie
z Otwartym pytaniem 6 mapy drogowej.

Każde uwierzytelnione żądanie wykonuje jeden zapis do D1 (`last_seen_at`). Przy dziennym limicie
100 tys. zapisów darmowego planu to nie jest blisko, ale gdy dojdą trasy odpytywane często, warto
`touchAppUser` ograniczyć do zapisu raz na dobę zamiast przy każdym żądaniu.

Sesja na planie Hobby Clerka ma **sztywne 7 dni** — użytkownik loguje się ponownie raz w tygodniu.
Wydłużenie wymaga planu płatnego; na MVP przyjęte świadomie.

## Uwagi dotyczące migracji

- **Wyłącznie addytywne.** Bez `DROP COLUMN` i bez zmiany typu, dopóki MVP nie ma odtwarzalnego
  środowiska.
- **Migracja wstecz w tym samym commicie**, w `migrations/down/`, niewidziana przez wranglera
  (czyta tylko `.sql` z najwyższego poziomu), uruchamiana wyłącznie ręcznie:
  `npx wrangler d1 execute mealplan --remote --file migrations/down/<plik>`.
- **Kolejność przy wdrożeniu**: schemat (`--remote`) przed kodem — a przy auto-deployu z `main`
  „kod na produkcji" znaczy „commit fazy", więc `--remote` idzie **przed commitem** fazy, która
  wystawia trasę czytającą tabelę (tu: faza 3, krok 4). `wrangler rollback` cofa kod, **nie**
  schemat — po rollbacku schemat zostaje i to jest zamierzone, bo migracje są addytywne.
- **Pliki już wdrożone są niezmienne.** Poprawka to nowa migracja z wyższym numerem.
- Danych do przeniesienia nie ma — baza jest pusta.
- **Numeracja zaczyna się od `0001`**, bo tak nazywa pliki `wrangler d1 migrations create`.

## Otwarte ryzyka i założenia

- **Tożsamość mieszka poza naszą infrastrukturą.** Clerk przechowuje adres e-mail i hash hasła;
  rezydencja danych w wybranym regionie jest funkcją planów płatnych. Dane profilowe objęte
  guardrailem PRD (waga, wiek, płeć) zostają w D1 w regionie EEUR i nigdy nie trafiają do Clerka.
  Przyjęte świadomie na MVP.
- **`@clerk/expo` w prerenderze Metro jest niesprawdzony.** `app.json` ma `web.output: "server"`,
  więc `expo export -p web` prerenderuje trasy w Node — z `ClerkProvider` i `tokenCache`
  z `expo-secure-store` w drzewie. To ta sama klasa ryzyka, która przewróciła wersję 1 planu,
  tylko po stronie klienta i **bez ścieżki odwrotu**: własne ekrany na hookach są jedynym
  podejściem, które działa w Expo Go (komponenty natywne wymagają development buildu). Dlatego
  faza 1 ma krok 5 — jedno `expo export` zaraz po `ClerkProvider`, przed napisaniem ekranów.
  Niepowodzenie tej bramki jest blokerem do eskalacji, nie rzeczą do łatania.
- **`@clerk/backend` w bundlu Metro jest niesprawdzony.** Ta sama klasa, mniejsza powierzchnia
  i z gotową ścieżką odwrotu (`jose`). Rozstrzyga się w fazie 3, po tym jak faza 1 dowiozła już
  działające konto.
- **Uzależnienie od dostawcy.** Wyjście z Clerka oznacza migrację użytkowników i przepisanie
  ekranów auth. Nasz kod produktowy jest odizolowany o tyle, że zna wyłącznie `userId` jako string.
- **Limit 50 000 MRU** planu Hobby jest o rzędy wielkości powyżej skali zapisanej w PRD
  (`target_scale.users: small`).

## Referencje

- Element mapy drogowej: [roadmap.md](../../foundation/roadmap.md) → S-01, kamień milowy M-01
- Wymagania: [prd.md](../../foundation/prd.md) → FR-001, *Access Control*, *Success Criteria*
- Platforma, decyzja o auth i rejestr ryzyka: [infrastructure.md](../../foundation/infrastructure.md)
- Runbook wdrożenia, granica dostępu, historia lockfile'a: [deploy-plan.md](../../deployment/deploy-plan.md)
- Reguły projektu: [CLAUDE.md](../../../CLAUDE.md)
- Kanał bindingów: [src/server/env.ts](../../../src/server/env.ts)
- Wzorzec trasy API: [src/app/api/health+api.ts](../../../src/app/api/health+api.ts)
- Expo + Clerk: <https://docs.expo.dev/guides/using-clerk/>
- Przegląd SDK Expo Clerka: <https://clerk.com/docs/reference/expo/overview>
- Weryfikacja tokenu na serwerze: <https://clerk.com/docs/reference/backend/verify-token>
- Cennik Clerka (Hobby: 50 000 MRU, sesja 7 dni): <https://clerk.com/pricing>
- Migracje D1: <https://developers.cloudflare.com/d1/reference/migrations/>

## Progress

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` po zakończeniu kroku.
> Nie zmieniaj nazw tytułów kroków. Zobacz
> [`.claude/skills/10x-plan/references/progress-format.md`](../../../.claude/skills/10x-plan/references/progress-format.md).

### Phase 1: Konto po stronie klienta i bramka tras

#### Automated

- [x] 1.1 `npm run check-lock` przechodzi po dodaniu zależności — 0d1e449
- [x] 1.2 `npx tsc --noEmit` czyste — 0d1e449
- [x] 1.3 `npx expo lint` czyste, bez `react-hooks/set-state-in-effect` — 0d1e449
- [x] 1.4 `expo export` i `wrangler deploy --dry-run` bez modułów z `node_modules` — 0d1e449
- [x] 1.5 Bramka bundlowania: `expo export -p web` przeszedł po kroku 4, przed ekranami — 0d1e449
- [x] 1.12 `/sso-callback` jest w wyeksportowanych trasach i zwraca 200 na `wrangler dev` — 0d1e449
- [x] 1.16 Zalogowany na `/sign-in` i `/sign-up` trafia na `/`; niezalogowany widzi formularz — 0d1e449

#### Manual

- [x] 1.6 `git check-ignore .dev.vars .wrangler/` potwierdza oba wpisy, przed pierwszym sekretem — 0d1e449
- [x] 1.7 `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` w Workers Builds przed commitem fazy — 0d1e449
- [x] 1.8 W przeglądarce: rejestracja → kod → wylogowanie → logowanie — 0d1e449
- [x] 1.9 W Expo Go: ten sam przepływ, sesja przetrwa zamknięcie aplikacji — 0d1e449
- [x] 1.10 Na `wrangler dev`: `/` i `/explore` bez sesji przekierowują na `/sign-in`, bez mignięcia zakładek — 0d1e449
- [x] 1.11 Zakładki działają na webie i natywnie po przeniesieniu tras do `(app)` — 0d1e449
- [x] 1.13 Adresy przekierowania SSO (web i Expo Go) są na białej liście w dashboardzie Clerka — 0d1e449
- [x] 1.14 W przeglądarce: „Zaloguj się przez Google" zakłada konto i wpuszcza do zakładek — 0d1e449
- [x] 1.15 W Expo Go: przepływ Google wraca do aplikacji i zachowuje sesję — 0d1e449

### Phase 2: Reset hasła

#### Automated

- [x] 2.1 `npx tsc --noEmit` czyste — 529c9db
- [x] 2.2 `npx expo lint` czyste — 529c9db
- [x] 2.7 Logowanie na świeżym kliencie przechodzi etap kodu urządzenia i kończy się sesją

#### Manual

- [x] 2.3 Reset przechodzi end-to-end: kod dociera, nowe hasło działa, stare nie — 529c9db
- [x] 2.4 Po resecie użytkownik jest zalogowany i trafia do zakładek — 529c9db
- [x] 2.5 Ten sam przepływ działa w Expo Go — 529c9db
- [x] 2.6 *User enumeration protection* w trybie **bulk** włączone (Protect → Rules → Manage) — potwierdzone 2026-09-09, było włączone wcześniej; tryb *strict* niedostępny, bo hasło jest pierwszą strategią logowania
- [x] 2.8 Logowanie w Expo Go na konto z przeglądarki domyka `needs_client_trust` kodem z maila

### Phase 3: Granica danych na serwerze

#### Automated

- [x] 3.1 `npm run check-lock`, `npx tsc --noEmit` i `npx expo lint` czyste
- [x] 3.2 Migracja `0001` stosuje się lokalnie, `migrations list --local` bez zaległych
- [x] 3.3 `wrangler deploy --dry-run` nadal bez modułów z `node_modules`
- [x] 3.4 `GET /api/account` bez nagłówka `Authorization` zwraca 401
- [x] 3.5 `GET /api/account` z tokenem konta A zwraca jego `userId` i tworzy wiersz w `app_user`
- [x] 3.6 `GET /api/account` z tokenem konta B nie rusza wiersza konta A
- [x] 3.7 Token z zepsutym podpisem lub po wygaśnięciu zwraca 401
- [x] 3.8 `GET /api/health` nadal zwraca `{"ok":true,"d1":true}`
- [x] 3.9 Token z Expo Go (bez roszczenia `azp`) przechodzi weryfikację
- [x] 3.10 `migrations list --remote` bez zaległych przed commitem fazy

#### Manual

- [x] 3.11 Żadna trasa poza `health+api.ts` nie woła `getWorkerEnv()` ani `prepare(`
- [x] 3.12 Token do testów pochodzi z działającej aplikacji, nie z ręcznej generacji
- [x] 3.13 Ekran startowy pokazuje `userId` z `authedFetch`; offline nie wylogowuje użytkownika

### Phase 4: Wdrożenie i przebieg na dwóch platformach

#### Automated

- [ ] 4.1 `npx tsc --noEmit`, `npx expo lint`, `npm run check-lock` czyste
- [ ] 4.2 `migrations list --remote` bez zaległych migracji
- [ ] 4.3 Smoke po wdrożeniu: `/` HTML, nieznana ścieżka 404, `/api/health` `d1:true`
- [ ] 4.4 Na produkcji `/api/account` zwraca 401 bez tokenu i `userId` z ważnym tokenem
- [ ] 4.5 Klucz publikowalny w zmiennych buildu, `wrangler secret list` pokazuje `CLERK_JWT_KEY`

#### Manual

- [ ] 4.6 Pełny przebieg na produkcji w przeglądarce
- [ ] 4.7 Przebieg w Expo Go przeciw produkcji: sesja przetrwa zamknięcie aplikacji
- [ ] 4.8 To samo konto pokazuje ten sam stan w przeglądarce i na telefonie
- [ ] 4.9 `npx wrangler tail` pokazuje żądania `/api/account` bez błędów
- [ ] 4.10 `CLAUDE.md` opisuje stan po zmianie
