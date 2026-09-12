# Kolejka pracy nocnej — MealPlan

Plik operacyjny dla autonomicznej sesji. **Stan trzymamy tutaj, nie w pamięci rozmowy** — sesja
przeżyje kompresję kontekstu tylko wtedy, gdy po każdym kroku dopisze wpis do Dziennika na końcu.

Decyzje i ich uzasadnienia: [night-decisions.md](night-decisions.md). Nadzór zewnętrzny:
[night-supervisor.md](night-supervisor.md). Punkt przywracania sprzed nocy: **`349d3ec`**.

**Zrobione przed startem pętli:** wszystkie 18 lekcji (m2l3 → m5l5) pobrane, 30 skilli
zainstalowanych, commit `c9d0c70`. Sieć i autoryzacja 10x nie są już do niczego potrzebne.

> **Warunek startu: pętlę prowadzi jedna sesja.** Commit `e4ae643` (23:06) pochodzi z równoległej
> sesji domykającej przegląd fazy 2 — praca zamierzona, nie kolizja. Zanim ruszysz, upewnij się,
> że tamta sesja skończyła i jest zamknięta: dwie sesje pracujące jednocześnie rozjadą
> `## Progress`, historię gita i stan tej kolejki.

> **Faza 2 wymaga ponownego przebiegu.** Przegląd z `e4ae643` odnotowuje, że poprawki F1/F2/F4/F6
> zmieniły schemat i zachowanie tras, więc kryteria **2.4–2.10** trzeba przejść jeszcze raz na
> `wrangler dev` — mimo że w `## Progress` są odhaczone. Migracja `0002` jest już zastosowana
> `--local` i `--remote`, tabela `user_profile` na produkcji zweryfikowana. Wciągnij 2.4–2.10 do
> zakresu harnessu w T1: to najtańszy sposób, żeby przestały wymagać człowieka.

---

## 1. Zasady — obowiązują przez całą noc

**Zakazane bezwarunkowo** (z `CLAUDE.md`, złamanie psuje repo):

- `npm install` — psuje `package-lock.json` na Windowsie wpisami `*-wasm32*`; używaj `npm ci`.
  **Playwright instaluj POZA projektem** (globalnie albo w scratchpadzie). Po zadaniu
  `git diff package-lock.json` musi być pusty.
- `npm run reset-project`, `npm audit fix --force`.
- `10x get` z jakimkolwiek refem — **synchronizuje `.claude/skills/` do manifestu tej lekcji
  i kasuje resztę**. Wszystko jest już pobrane; nie ma powodu tego uruchamiać.
- Zmiana `slug` / `scheme` w `app.json`, usuwanie reguł `rules` z `wrangler.jsonc`.
- Dopisywanie pól do `src/app/api/account+api.ts` — profil ma własną trasę.

**Uczciwość weryfikacji — reguła nadrzędna:**

- Kryterium w `## Progress` odhaczasz **wyłącznie** po zobaczeniu wyniku. Nigdy „powinno działać".
- Czego nie pokrywa harness → `- [ ] 3.x … — BLOCKED-MANUAL: <czego zabrakło>` i idziesz dalej.
  **Nie zmyślaj zieleni.** Rano właściciel ma wiedzieć, co naprawdę sprawdzone.
- Dwie nieudane próby naprawy tego samego → wpis w Dzienniku, następne zadanie. Bez zapętlania.

**Decyzje:** masz mandat na samodzielne rozstrzyganie. Każdą decyzję nietrywialną dopisz do
`night-decisions.md` w formacie Co / Powód / Jak cofnąć. Decyzja bez zapisu = decyzja niepodjęta.

**Git:** commit po każdym ukończonym zadaniu. Push na `main` tylko w T5, po zielonym T4.

**Dane produkcyjne:** testy przeciw lokalnemu `wrangler dev`, nie produkcji. Na emulatorze
`adb reverse tcp:8787 tcp:8787` + `EXPO_PUBLIC_API_URL=http://127.0.0.1:8787`.

**Heartbeat:** każdy wpis w Dzienniku zaczynasz znacznikiem UTC (`date -u +%H:%M`). Nadzorca
rozpoznaje po nim, czy sesja żyje. Cisza dłuższa niż 45 minut to dla niego sygnał zacięcia.

---

## 2. Preflight

```sh
cd "C:/Prywatne/Dieta 2"
git status --short && git log --oneline -3
npx tsc --noEmit      # czerwone na starcie? uruchom raz `npm start` (generuje .expo/types/)
npm test
```

Autoryzacja 10x i VPN **nie są już sprawdzane** — lekcje pobrane, VPN celowo rozłączony (D3).

---

## 3. Kolejka zadań

### T1 — Plan testów i harness webowy

Prowadzisz to skillami z lekcji m3l1–m3l4, nie ręcznie (D6).

1. `/10x-test-plan` — mapa ryzyk i bramki jakości dla tego, co już istnieje. Zapis do
   `context/foundation/test-plan.md`.
2. `/10x-e2e` — scenariusze przeglądarkowe przeciw `npx wrangler dev` na zbudowanym `dist/`.
   Materiały o anty-wzorcach i wzorcu seedowania są w `.claude/skills/10x-e2e/references/`.

Konto testowe (instancja **development** Clerka, przećwiczone):
`mealplan.qa+clerk_test@example.com` / `Mp-Emu-2026-Kx71`, kod weryfikacyjny **`424242`**.
Dane wejściowe czytaj ze zmiennej środowiskowej z pliku gitignorowanego — **żadnych haseł
w pliku commitowanym**.

Pokryj **to, co istnieje dziś**, zanim oprzesz na tym fazę 3: `/sign-in` → logowanie → bramka
wpuszcza do `(app)`; `/api/health` → `d1:true`; `/api/account` bez tokenu → 401; nieznana ścieżka
→ 404; wylogowanie → `/sign-in`.

**Gotowe, gdy:** przechodzi dwa razy z rzędu zielono i `git diff package-lock.json` pusty.

**Limit: 2,5 godziny.** Po tym czasie przechodzisz do T3 z tym, co masz — choćby samym logowaniem.
Faza 3 jest celem nocy, harness jest środkiem. Wpisz w Dzienniku, co z harnessu zostało niegotowe,
i wróć do tego w T4, jeśli zostanie czas. Harness, który zjadł noc i nie ma czego weryfikować,
jest porażką, nie sukcesem.

### T2 — Harness natywny (jedna próba, 30 minut)

VPN jest celowo rozłączony (D3), więc sprawdzona konfiguracja DNS nie zadziała. Jedna hipoteza
do przetestowania: bez VPN-a wystarczy domyślny DNS hosta albo `-dns-server 8.8.8.8`.

```sh
emulator.exe -avd mealplan35 -no-window -no-audio -no-boot-anim \
  -gpu swiftshader_indirect -port 5554          # DNS domyślny; druga próba: -dns-server 8.8.8.8
adb -s emulator-5554 reverse tcp:8081 tcp:8081
adb -s emulator-5554 reverse tcp:8787 tcp:8787
npx expo start --android
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"
```

Objaw porażki DNS: Metro ładuje bundle, ale Clerk stoi na spinnerze **bez błędu w logach**.
Odczyt stanu: `adb shell uiautomator dump /data/local/tmp/ui.xml` + `cat` (szybsze niż zrzuty,
daje `bounds` do klikania). W Git Bashu ścieżki gościa wymagają `MSYS_NO_PATHCONV=1`.

**Nie wracaj do ślepych uliczek:** obraz `android-36.1`, `-feature -GLDMA`,
`-gpu swangle_indirect`, tryb okienkowy. Wszystkie sprawdzone, wszystkie nie działają.

**Po 30 minutach bez skutku:** `BLOCKED-VPN` w Dzienniku i dalej. To zadanie nie jest warunkiem
powodzenia nocy.

### T3 — Faza 3: ekran profilu i karta celu

```
/10x-goal-implement profile-and-calorie-target
```

Skill jest zbudowany pod pracę bez nadzoru (D5): deleguje kod do subagenta, przestawia wyłącznie
automatyczne wiersze `## Progress`, weryfikuje bramkami (kryteria planu, próba celowego zepsucia,
pełny zestaw testów), commituje fazę dopiero na zielono, wiersze ręczne zostawia jako listę
kontrolną. Kontrakt plików i kryteria są w
`context/changes/profile-and-calorie-target/plan.md`.

Pułapki z `CLAUDE.md`, o które łatwo się potknąć — **przeczytaj przed startem**:

- Trasa w `src/app/`, **nie** `app/`. Nowa zakładka = edycja **obu** plików `app-tabs.tsx`
  i `app-tabs.web.tsx`, inaczej trasa jest nieosiągalna na jednej platformie.
- Zero `useMemo` / `useCallback` / `React.memo` — `reactCompiler` memoizuje sam.
- Zero surowych kolorów i odstępów: `useTheme()` i `Spacing`. Tekst przez `ThemedText` / `ThemedView`.
- `useColorScheme` z `@/hooks/use-color-scheme`, nie z `react-native`.
- Ekran przewijalny sam rezerwuje `BottomTabInset + Spacing.*` w `paddingBottom`.
- `setState` w efekcie to **błąd lintu**, nie ostrzeżenie.
- Żądania wyłącznie przez `src/lib/api.ts` + `useAuthedFetch()`. `OfflineError` ≠ `NotSignedInError`.

### T4 — Weryfikacja fazy 3 harnessem

Rozszerz T1 o ścieżkę profilu i odhacz 3.7–3.13 tym, co harness realnie pokazuje:

- podgląd 1 780 → × 1.55 → 2 759 dla 80/180/30/mężczyzna/3 przed zapisem,
- zapis → „Zapisano", Home pokazuje „2 759 kcal dziennie",
- „70,5" przyjęte; wiek 17 i waga 7 → błędy pod polami po „Zapisz", bez żądania sieciowego,
- nadpisanie 2 200 widoczne na Profilu i Home, „Wróć do wyliczenia" działa,
- offline: odczyt i zapis komunikują brak sieci **bez wylogowania**,
- 3.12 (Expo Go) → `BLOCKED-MANUAL`, jeśli T2 padło.

Na koniec `/10x-impl-review profile-and-calorie-target`.

### T5 — Faza 4: produkcja

**Bramka (złagodzona w D4):** webowy harness w pełni zielony; `npx tsc --noEmit`, `npx expo lint`,
`npm test`, `npm run check-lock` czyste; `npx wrangler dev` na zbudowanym `dist/` przechodzi smoke.
Niesprawdzone kryteria **natywne** nie blokują.

`wrangler deploy` **nie buduje** — kolejność obowiązkowa:

```sh
npx wrangler d1 migrations list mealplan --remote     # warunek produkcyjny PRZED commitem fazy
npx expo export -p web
npx wrangler deploy --dry-run --outdir .wrangler-dry  # 6 modułów, nic z node_modules
npx wrangler deploy
```

Smoke: `/` HTML, `/profile` 200, `/explore` 404, `/api/health` `d1:true`, `/api/profile` bez
`Authorization` → 401. Nazwę zasobu bierz **z wdrożonego HTML-a**, nie z lokalnego `dist/` —
hash bundla Metro bywa niedeterministyczny.

Padło? `npx wrangler rollback` (cofa **kod, nie schemat D1**), wpis w Dzienniku, stop.
Nie rób jednocześnie pusha na `main` i ręcznego `wrangler deploy` — wybierz jedno.

### T6 — Briefy z lekcji (offline, bez sieci)

Odpowiedzi CLI z tytułami i streszczeniami wszystkich 18 lekcji leżą w scratchpadzie sesji
(`lessons/*.json`). Ostatni przerobiony brief to m1l4.

Dla każdej lekcji od m2l3 w górę napisz `notes/10x-lesson-<ref>-brief.md`: co lekcja wprowadza,
co z tego dotyczy MealPlana, co warto zastosować i gdzie. **Priorytet: m3l1, m3l2, m3l4, m5l5** —
to one dały narzędzia używane tej nocy, więc brief piszesz z realnego doświadczenia, nie
ze streszczenia. Jedna lekcja na raz, commit po każdej.

Zmiany w sekcji kursowej `CLAUDE.md` rób **osobnym commitem**.

### T7 — Otwarte pytania 1–3: rozstrzygnij i zaplanuj

Bez tego noc kończy się po fazie 4. Mandat jest w D7, razem z granicą: **decyzja otwiera
planowanie, nie implementację.**

1. Napisz `context/changes/dish-source-and-seed-pool/options.md` — dla OP 1 (źródło przepisów
   i makr: model AI na żądanie / własna zseedowana pula / publiczna baza + własne przepisy)
   rozpisz konsekwencje dla guardraila ±10%, limitu CPU Workera, FR-016 (kroki), sumowania
   jednostek w liście zakupów, kosztu i ryzyka. OP 2 jest pochodną OP 1. Dla OP 3 zaproponuj
   model danych i pokaż, jak obsługuje „nie jem grzybów" kontra „nie jem risotto" — pamiętając,
   że FR-004 i FR-011 zasilają **jedną** listę wykluczeń.
2. Rozstrzygnij, zapisz jako decyzję w `night-decisions.md` z odrzuconymi opcjami.
3. `/10x-new` + `/10x-plan` + `/10x-plan-review` dla odblokowanych fragmentów, w kolejności
   `dish-source-and-seed-pool` → `dietary-preferences`.
4. **Zatrzymaj się na gotowym, zrecenzowanym planie.** Żadnego kodu na tych fragmentach.

### T8 — Zapas

Po jednej rzeczy, commit po każdej: przypadki brzegowe w `src/lib/calorie-target.test.ts`
(skrajne wagi i wzrosty, granice walidacji, zaokrąglanie); `/10x-rule-review CLAUDE.md` → raport
do `notes/`, **bez** samodzielnej edycji reguł; `/10x-lesson` na to, co noc wykazała.

**Nie wymyślaj nowego zakresu produktowego.** Poza MVP zostają: dziennik jedzenia, śledzenie
wagi, plan miesięczny, FR-005, FR-015.

---

## 4. Dziennik

Dopisuj po **każdym** zadaniu i przy każdej blokadzie:

```
### <HH:MM UTC> — <T#> <tytuł>
Wynik: ok | blocked | failed
Co zrobione: <jedno–trzy zdania>
Commit: <sha albo ->
Do decyzji rano: <albo ->
```

<!-- DZIENNIK PONIŻEJ -->

### 21:20 UTC — Preflight
Wynik: ok
Co zrobione: `git status` czysty, historia zgodna (commit równoległej sesji `e4ae643` leży pięć
commitów wstecz — tamta sesja skończyła). `npx tsc --noEmit` bez błędów, `npm test` 28/28 zielono.
Warunek startu spełniony, pętlę prowadzi jedna sesja.
Commit: -
Do decyzji rano: -

### 21:57 UTC — T1 Plan testów i harness webowy
Wynik: ok
Co zrobione: `/10x-test-plan` napisał `context/foundation/test-plan.md` — siedem ryzyk z wpływem,
prawdopodobieństwem i dowodem, tabela odpowiedzi na ryzyko, cztery fazy wdrożenia, bramki jakości.
Umiejętności użyłem jako autora dokumentu, bez jej maszyny stanów (D8); wywiad zastąpiłem dowodami
z dokumentów (D9). `/10x-e2e` w trybie jednego ryzyka zbudował harness w `tests/e2e/`: 13 testów,
dwa przebiegi z rzędu zielone (12,6 s), `git diff package-lock.json` pusty, `npm run check-lock`
i `npx tsc --noEmit` czyste. Playwright i poświadczenia leżą POZA repo (D10) — hasła, którego nie
ma w drzewie, nie da się zacommitować, co zamyka ustalenie F1 przeglądu fazy 1.
Pokryte: logowanie z weryfikacją urządzenia, bramka wpuszcza i sesja przeżywa przeładowanie,
wylogowanie, 401 bez tokenu i przy podrobionym tokenie, `d1:true`, 404 dla nieznanej ścieżki,
oraz kryteria fazy 2 **2.4, 2.6, 2.7, 2.8, 2.10** (wciągnięte do zakresu zgodnie z nagłówkiem
kolejki). **Niepokryte: 2.5 i 2.9** — oba wymagają drugiego konta testowego; odnotowane w planie.
Każda asercja przeszła próbę celowego zepsucia: odmowa tożsamości zamieniona na 200 zapaliła
8 z 10 testów, przesunięcie wyniku wzoru o 7 kcal zapaliło testy celu (2759 kontra 2766).
Dwie rzeczy znalezione po drodze, obie zapisane: harness MUSI używać `localhost`, nie `127.0.0.1`
(`azp` porównywane jako łańcuch znaków — inaczej każde uwierzytelnione żądanie dostaje 401 bez
wskazówki), oraz `wrangler dev` trzyma `dist/client`, więc bez jego zatrzymania `expo export`
pada na EBUSY i testy jadą przeciw staremu buildowi — co raz dało fałszywą zieleń przy próbie
celowego zepsucia. Formularz logowania nie ma nazw dostępnościowych; zgłoszone, nienaprawione (D11).
Commit: 64634da + ten
Do decyzji rano: czy naprawiać dostępność formularza (D11) i czy założyć drugie konto testowe dla 2.5/2.9

### 22:06 UTC — T2 Harness natywny
Wynik: blocked
Co zrobione: Emulator **nie wystartował ani razu**, więc hipoteza z D3 (że bez VPN-a wystarczy
domyślny DNS albo `-dns-server 8.8.8.8`) **pozostaje niesprawdzona** — blokada leży wcześniej.
Trzy próby: domyślna, `-read-only`, i ponowna po ubiciu procesów. Każda kończy się tym samym:
`FATAL | Running multiple emulators with the same AVD`, mimo że żadnego `qemu-system-x86_64`
w systemie nie ma. Przyczyna to dwie osierocone blokady w `~/.android/avd/mealplan35.avd/`
(`hardware-qemu.ini.lock` — katalog z plikiem `pid` — oraz `multiinstance.lock`), których nie
udało się usunąć ani z Bash, ani z PowerShella. `adb devices` przy tym nie zwraca nawet nagłówka,
więc serwer adb też wisi. Zostały po sesji, która pracowała przed pętlą.
Limit 30 minut wyczerpany, trzy nieudane próby tego samego — zgodnie z zasadami przechodzę dalej.
Commit: ten
Do decyzji rano: **BLOCKED-EMULATOR, nie BLOCKED-VPN.** Naprawa jest prawdopodobnie trywialna
i wymaga człowieka przy maszynie: zamknąć Android Studio, jeśli działa, usunąć te dwie blokady
i zrobić `adb kill-server`. Dopiero potem da się sprawdzić hipotezę DNS. Kryterium 3.12 zostaje
jako BLOCKED-MANUAL.

### 22:24 UTC — T3 Faza 3: ekran profilu i karta celu
Wynik: ok
Co zrobione: `/10x-goal-implement` wdrożył fazę 3 — implementacja delegowana do subagenta, bramki
i commit w kontekście głównym. Powstały `choice-field.tsx` (prymityw wyboru), `profile.tsx`
(formularz z podglądem na żywo i nadpisaniem celu), `TargetCard` na Home odświeżana przez
`useIsFocused` + ref; zakładka Profil zastąpiła Explore na OBU platformach, marka to „MealPlan",
link „Docs" zniknął; usunięte `explore.tsx`, `hint-row.tsx` i `external-link.tsx` (bez importerów).
Wszystkie sześć kryteriów automatycznych 3.1–3.6 zielone i odhaczone: `tsc`, `expo lint`,
`npm test` 28/28, `expo export` + `wrangler deploy --dry-run` (12 modułów, nic z `node_modules`),
`/profile` → 200 HTML i `/explore` → 404 na `wrangler dev`, `grep` bez trafień.
Harness E2E po zmianie: 13/13. Jeden test wymagał przekotwiczenia — asercja opierała się na wierszu
`userId: user_…`, który faza 3 celowo usuwa; dowodem granicy danych jest teraz karta celu.
To dryf zaplanowany, nie regresja. Nowa asercja przeszła próbę celowego zepsucia: usunięcie
nagłówka `Authorization` zapaliło ją na czerwono, po czym zepsucie przywrócone.
Commit: 42b6917
Do decyzji rano: mnożnik w podglądzie renderuje się jako „× 1,55" (`toLocaleString('pl-PL')`),
a kryterium 3.7 zapisuje „× 1.55" — do rozstrzygnięcia, która forma obowiązuje. Karta na Home
składa „2 759 kcal" i „dziennie" jako dwa osobne wiersze, nie jedno zdanie jak w umowie planu.

### 22:44 UTC — T4 Weryfikacja fazy 3 harnessem
Wynik: ok
Co zrobione: `tests/e2e/profile-screen.spec.ts` (+ `support/profile-form.ts`) zamienia ręczne
kryteria na testy. Odhaczone realnym przebiegiem: **3.7** (podgląd 1780 → × 1,55 → 2759 i zero
żądań przed zapisem), **3.8** (zapis → „Zapisano", Home pokazuje ten sam cel), **3.9** („70,5"
przyjęte; wiek 17 i waga 7 zatrzymują zapis PRZED siecią — asercja liczy żądania, nie komunikaty),
**3.10** (nadpisanie 2200 i wyliczone 2759 w jednym wierszu, edycja wagi go nie kasuje, „Wróć do
wyliczenia" czyści), **3.11** (offline: komunikat, sesja zachowana, wartości w polach zostają),
**3.13** (zakładki MealPlan / Home / Profil, bez Docs i Explore).
**3.12 zostaje BLOCKED-MANUAL** — emulator nie wystartował, warstwa natywna niesprawdzona wcale.
Zestaw: 19/19, cztery przebiegi z rzędu.
Po drodze wyszły trzy rzeczy warte uwagi rano, wszystkie zapisane w planie:
1. Ekran pokazuje „1780"/„2759", nie „1 780"/„2 759" — `toLocaleString('pl-PL')` nie grupuje liczb
   czterocyfrowych. To zapis kryterium jest nieprecyzyjny, nie kod.
2. Mnożnik renderuje się jako „× 1,55", kryterium pisze „× 1.55".
3. **Obserwacja o realnym zachowaniu:** odpowiedź początkowego `GET /api/profile` nadpisuje to,
   co użytkownik zdążył wpisać, jeśli dojdzie po rozpoczęciu pisania. To była przyczyna losowej
   czerwieni (raz na trzy przebiegi) — usunięta w testach przez czekanie na stan, ale w aplikacji
   zostaje: na wolnym łączu użytkownik traci pierwsze znaki.
Zestaw jedzie na jednym workerze — jedno konto testowe znaczy, że wiersz profilu w D1 jest
zasobem współdzielonym; `retries` maskowałyby wyścig, więc usunąłem przyczynę.
Commit: 7aadf2d
Do decyzji rano: rozstrzygnąć 1 i 2 (separator i przecinek), zdecydować, czy 3 to defekt do naprawy

### 22:49 UTC — Korekta znaczników czasu w Dzienniku
Wynik: ok
Co zrobione: Znaczniki wpisów T1–T4 były błędne — część zapisałem czasem lokalnym (+02:00),
a wpis T4 („02:25") był po prostu zmyślony zamiast zmierzony. Odtworzyłem je z czasów commitów
i poprawiłem na: T1 21:57, T2 22:06, T3 22:24, T4 22:44. To nie jest kosmetyka: nadzorca liczy
ciszę od ostatniego znacznika, więc znacznik z przyszłości kazałby mu uznać martwą sesję za żywą.
Od tego wpisu każdy znacznik pochodzi z `date -u +%H:%M`, nie z oszacowania.
Commit: ten
Do decyzji rano: -
