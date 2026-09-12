# Kolejka pracy nocnej — MealPlan

Plik operacyjny dla autonomicznej sesji (`/loop`). **Stan trzymamy tutaj, nie w pamięci rozmowy** —
sesja przeżyje kompresję kontekstu tylko wtedy, gdy po każdym kroku zaktualizuje Dziennik na końcu.

Ustalenia z 12.09.2026: pełne uprawnienia gita z pushem na `main`, harness testowy jako pierwsze
zadanie, lekcje kursu pobierane wraz z instalacją skilli.

---

## 1. Zasady — obowiązują przez całą noc

**Zakazane bezwarunkowo** (z `CLAUDE.md`, złamanie psuje repo):

- `npm install` — psuje `package-lock.json` na Windowsie wpisami `*-wasm32*`; używaj `npm ci`.
  **Playwright instaluj POZA projektem** (globalnie albo w katalogu scratchpad), nigdy jako
  zależność repo. Po każdym dotknięciu zależności: `npm run check-lock`.
- `npm run reset-project` — przenosi kod do `app-example/`.
- `npm audit fix --force` — cofa `expo` o kilka major.
- Zmiana `slug` / `scheme` w `app.json`, usuwanie reguł `rules` z `wrangler.jsonc`.
- Dopisywanie pól do `src/app/api/account+api.ts` — profil ma własną trasę.

**Uczciwość weryfikacji — reguła nadrzędna:**

- Kryterium w `## Progress` odhaczasz **wyłącznie** po zobaczeniu wyniku. Nigdy „powinno działać".
- Kryterium, którego nie da się sprawdzić maszynowo i nie pokrywa go harness, oznaczasz
  `- [ ] 3.x … — BLOCKED-MANUAL: <czego zabrakło>` i idziesz dalej. **Nie zmyślaj zieleni.**
- Jeśli coś nie działa i dwie próby naprawy nie pomogły — zapisz w Dzienniku, przejdź do
  następnego zadania. Nie zapętlaj się na jednym problemie.

**Git:** commituj po każdym ukończonym zadaniu, temat w trybie rozkazującym, zdaniowa wielkość
liter, bez prefiksu. Push na `main` **tylko** w zadaniu T5 i tylko po zielonym harnessie.

**Dane produkcyjne:** testy kierujesz na lokalnego `wrangler dev`, nie na produkcję.
Na emulatorze: `adb -s emulator-5554 reverse tcp:8787 tcp:8787` i `EXPO_PUBLIC_API_URL`
na `http://127.0.0.1:8787`. Bez tego zapisy lądują w produkcyjnej D1.

---

## 2. Preflight — zanim ruszysz z czymkolwiek

Uruchom i zapisz wynik w Dzienniku. Wynik decyduje, które zadania są w ogóle wykonalne.

```sh
cd "C:/Prywatne/Dieta 2"
git status --short
npx tsc --noEmit            # na świeżym klonie 2 fałszywe błędy o .css — patrz Pułapki w CLAUDE.md
npm test
ipconfig | grep -A4 "Ethernet 3"    # VPN firmowy — warunek działania emulatora
10x auth --status
```

**Interpretacja:**

| Wynik | Co to znaczy |
| --- | --- |
| `Ethernet 3` bez adresu IPv4 | VPN padł → emulator nie rozwiąże żadnej nazwy, Clerk zawiśnie na spinnerze **bez błędu w logach**. T2 i weryfikacja natywna odpadają; oznacz `BLOCKED-VPN`, rób resztę. |
| `10x auth --status` → `auth_expired` | T6 (lekcje) odpada w całości — logowanie wymaga przeglądarki. Oznacz `BLOCKED-AUTH`. |
| `npx tsc --noEmit` czerwone | Uruchom raz `npm start`, żeby wygenerowało `.expo/types/`, i sprawdź ponownie. |

---

## 3. Kolejka zadań

### T0 — Domknij to, co wisi

Niezacommitowane: `context/changes/profile-and-calorie-target/change.md`, `plan.md` oraz nowy
`reviews/impl-review-phase-2.md`. Przeczytaj przegląd, sprawdź czy jego ustalenia są już w planie,
zacommituj całość jednym commitem.

**Gotowe, gdy:** `git status --short` czyste.

### T1 — Harness webowy (pierwsze zadanie merytoryczne)

Cel: powtarzalny skrypt, który loguje się i przechodzi ścieżkę produktową w przeglądarce przeciw
`npx wrangler dev` na zbudowanym `dist/`. To on zdejmuje ręczne bramki z fazy 3 i z każdej następnej.

- Playwright **poza repo** — `npm i -g playwright` albo instalacja w katalogu scratchpad.
  Spec i konfiguracja lądują w `e2e/` w repo, uruchamiane globalnym binarium. `package.json`
  i `package-lock.json` zostają nietknięte — sprawdź `git diff --stat` po zadaniu.
- Konto testowe (instancja **development** Clerka, gotowe do użycia):
  `mealplan.qa+clerk_test@example.com` / `Mp-Emu-2026-Kx71`, kod weryfikacyjny **`424242`**.
  Dane wejściowe czytaj ze zmiennych środowiskowych z pliku gitignorowanego, **nie wpisuj haseł
  w plik commitowany**.
- Pokryj **to, co istnieje dziś**: `/sign-in` → logowanie → bramka wpuszcza do `(app)`,
  `/api/health` zwraca `d1:true`, `/api/account` bez tokenu zwraca 401, nieznana ścieżka 404,
  wylogowanie odsyła na `/sign-in`. Tym dowodzisz, że harness działa, zanim oprzesz na nim fazę 3.
- Napisz `e2e/README.md`: jak uruchomić, skąd biorą się dane logowania, dlaczego Playwright
  jest poza `package.json`.

**Gotowe, gdy:** skrypt przechodzi dwa razy z rzędu zielono i `git diff package-lock.json` pusty.

### T2 — Harness natywny (Android)

Ta sama ścieżka na emulatorze. Przepis jest sprawdzony — trzymaj się go co do znaku:

```sh
emulator.exe -avd mealplan35 -no-window -no-audio -no-boot-anim \
  -gpu swiftshader_indirect -dns-server 10.254.15.20,10.254.15.5 -port 5554
adb -s emulator-5554 reverse tcp:8081 tcp:8081
adb -s emulator-5554 reverse tcp:8787 tcp:8787
npx expo start --android
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"
```

Sterowanie i odczyt: `adb shell uiautomator dump /data/local/tmp/ui.xml` + `cat` (szybsze niż
zrzuty, daje `bounds` do klikania), zrzut `adb exec-out screencap -p > plik.png`. W Git Bashu
ścieżki gościa wymagają `MSYS_NO_PATHCONV=1`.

**Nie wracaj do ślepych uliczek:** obraz `android-36.1` (SystemUI crashuje w pętli),
`-feature -GLDMA`, `-gpu swangle_indirect`, tryb okienkowy. Wszystkie sprawdzone, wszystkie nie działają.

Zapakuj to w skrypt `e2e/android/` — start emulatora, preflight DNS, przebieg, zrzuty do katalogu
wyników. **Limit: 90 minut.** Jeśli się nie domyka, oznacz `BLOCKED-ANDROID`, zapisz co zawiodło
i przejdź do T3 — faza 3 jest ważniejsza niż komplet harnessu.

### T3 — Faza 3: ekran profilu i karta celu

`/10x-implement profile-and-calorie-target phase 3`. Kontrakt plików i kryteria są w
`context/changes/profile-and-calorie-target/plan.md`. Przypomnienia z `CLAUDE.md`, o które łatwo się potknąć:

- Trasa w `src/app/`, **nie** `app/`. Nowa zakładka = edycja **obu** plików `app-tabs.tsx`
  i `app-tabs.web.tsx`, inaczej trasa jest nieosiągalna na jednej platformie.
- Zero `useMemo` / `useCallback` / `React.memo` — `reactCompiler` jest włączony.
- Zero surowych kolorów i odstępów: `useTheme()` i `Spacing`. Tekst przez `ThemedText` / `ThemedView`.
- `useColorScheme` z `@/hooks/use-color-scheme`, nie z `react-native`.
- Ekran przewijalny sam rezerwuje `BottomTabInset + Spacing.*` w `paddingBottom`.
- `setState` w efekcie to **błąd lintu**, nie ostrzeżenie.
- Żądania wyłącznie przez `src/lib/api.ts` + `useAuthedFetch()`. `OfflineError` ≠ `NotSignedInError`.

Domknij kryteria automatyczne 3.1–3.6. Ręczne 3.7–3.13 zostaw na T4.

**Gotowe, gdy:** 3.1–3.6 odhaczone z SHA, commit fazy zrobiony.

### T4 — Weryfikacja fazy 3 harnessem

Rozszerz T1 i T2 o ścieżkę profilu i odhacz kryteria 3.7–3.13 tym, co harness realnie pokazuje:

- podgląd 1 780 → × 1.55 → 2 759 dla 80/180/30/mężczyzna/3 przed zapisem,
- zapis → „Zapisano", Home pokazuje „2 759 kcal dziennie",
- „70,5" przyjęte; wiek 17 i waga 7 → błędy pod polami po „Zapisz", bez żądania sieciowego,
- nadpisanie 2 200 widoczne na Profilu i Home, „Wróć do wyliczenia" działa,
- offline: odczyt i zapis komunikują brak sieci **bez wylogowania**,
- natywnie: zakładka Profil z ikoną, klawiatury liczbowe, formularz nie chowa się pod zakładkami.

Każde kryterium, którego harness nie obejmuje → `BLOCKED-MANUAL` z jednozdaniowym powodem.

### T5 — Faza 4: produkcja

**Bramka wejściowa — wszystkie trzy naraz, inaczej nie wchodzisz:** T4 zielone bez ani jednego
`BLOCKED-MANUAL` w kryteriach 3.7–3.13, `npx tsc --noEmit` / `npx expo lint` / `npm test` /
`npm run check-lock` czyste, `npx wrangler dev` na zbudowanym `dist/` przechodzi smoke test.

Kolejność jest obowiązkowa i `wrangler deploy` **nie buduje**:

```sh
npx wrangler d1 migrations list mealplan --remote     # warunek produkcyjny PRZED commitem fazy
npx expo export -p web
npx wrangler deploy --dry-run --outdir .wrangler-dry  # 6 modułów, nic z node_modules
npx wrangler deploy
```

Smoke po wdrożeniu: `/` HTML, `/profile` 200, `/explore` 404, `/api/health` `d1:true`,
`/api/profile` bez `Authorization` → 401. Nazwę zasobu bierz **z wdrożonego HTML-a**, nie z
lokalnego `dist/` — hash bundla Metro bywa niedeterministyczny.

Jeśli smoke pada: `npx wrangler rollback` (cofa **kod, nie schemat D1**), opisz w Dzienniku, stop.

Push na `main` uruchamia Workers Builds, więc rozstrzygnij, czy wdrażasz pushem czy ręcznym
`wrangler deploy` — nie rób obu.

### T6 — Lekcje kursu

Tylko jeśli preflight nie dał `BLOCKED-AUTH`. Ostatnia przerobiona to m1l4
(`notes/10x-lesson-m1l4-brief.md`).

```sh
10x list
10x get <ref> --tool claude-code --lang pl
```

Bierz lekcje **po kolei**, od pierwszej nieprzerobionej. Dla każdej: zainstaluj skille, napisz
`notes/10x-lesson-<ref>-brief.md` — co lekcja wprowadza, co z tego dotyczy MealPlana, co warto
zastosować i gdzie. Zmiany w `CLAUDE.md` (sekcja kursowa) rób **osobnym commitem**, żeby dało się
je cofnąć niezależnie od kodu.

Jedna lekcja na raz, commit po każdej.

### T7 — Materiał decyzyjny pod Otwarte pytania

To praca, której nic nie blokuje, i to ona odblokuje poranek. Dla pytań 1–3 z
`context/foundation/roadmap.md` napisz `context/changes/dish-source-and-seed-pool/options.md`:

- **OP 1** — źródło przepisów i makr: model AI na żądanie / własna zseedowana pula / publiczna baza
  (USDA, Open Food Facts) + własne przepisy. Dla każdej opcji: konsekwencje dla guardraila ±10%,
  dla limitu CPU Workera, dla FR-016 (kroki), dla listy zakupów (jednostki do sumowania), koszt,
  ryzyko. Zakończ rekomendacją z uzasadnieniem.
- **OP 2** — czy źródło daje instrukcję rozbitą na kroki (pochodna OP 1).
- **OP 3** — rozdzielenie wykluczeń składnikowych od daniowych: zaproponuj model danych i pokaż,
  jak obsługuje „nie jem grzybów" kontra „nie jem risotto", pamiętając że FR-004 i FR-011 zasilają
  **jedną** listę wykluczeń.

**Nie podejmuj tych decyzji za właściciela** i nie zmieniaj na ich podstawie statusów w roadmapie.
Piszesz materiał do wyboru, nie wybór.

### T8 — Zapas, gdy kolejka się wyczerpie

W tej kolejności, po jednej rzeczy, commit po każdej:

1. Rozszerz `src/lib/calorie-target.test.ts` o przypadki brzegowe (skrajne wagi i wzrosty,
   granice walidacji, zaokrąglanie).
2. `/10x-rule-review CLAUDE.md` — raport do `notes/`, **bez** samodzielnej edycji reguł projektu.
3. Uzupełnij `e2e/README.md` o to, czego się nauczyłeś w nocy.

**Nie wymyślaj nowego zakresu produktowego.** Poza MVP zostają: dziennik jedzenia, śledzenie wagi,
plan miesięczny, FR-005, FR-015. Nie dokładaj ich „przy okazji".

---

## 4. Dziennik

Dopisuj na dole po **każdym** ukończonym zadaniu i przy każdej blokadzie. Format:

```
### <HH:MM> — <T#> <tytuł>
Wynik: ok | blocked | failed
Co zrobione: <jedno–trzy zdania>
Commit: <sha albo ->
Do decyzji rano: <albo ->
```

<!-- DZIENNIK PONIŻEJ -->
