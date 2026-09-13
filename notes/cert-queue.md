# Kolejka nocna — zgłoszenie do certyfikacji

**Termin: 14 września 2026, 23:59.** Trzecia i ostateczna tura, jedno podejście.

Plik operacyjny i **jedyne źródło stanu**. Sesja przeżyje kompresję kontekstu tylko wtedy, gdy
po każdym kroku dopisze wpis do Dziennika na końcu. Nie trzymaj stanu w pamięci rozmowy.

Strategia wybrana przez właściciela: **najpierw pewniaki, potem CRUD.** Każdy ukończony punkt ma
mieć wartość sam w sobie, a nie dopiero jako komplet.

---

## 0. Stan wyjściowy — zmierzony 13.09.2026, nie założony

Ocena wg oficjalnego `mvp-check`: **3/5**.

| # | Kryterium | Stan | Czego brakuje |
|---|---|---|---|
| 1 | CRUD | ❌ | Jest Read i Update na singletonie `user_profile`. **Brak Create i Delete na kolekcji.** |
| 2 | Logika biznesowa | ✅ | `calorie-target.ts`, `dish-macros.ts`, `dish-validation.ts` |
| 3 | Testy pod ryzyko | ✅ | 81 jednostkowych + 26 E2E; ryzyka #1/#2/#4 z `test-plan.md` pokryte |
| 4 | Autentykacja | ✅ | Clerk, JWT w `auth.ts`, `userId` filtrowany w SQL-u |
| 5 | Dokumentacja | ⚠️ | `context/foundation/` mocne, ale `README.md` to nietknięty starter Expo |

**Pułapka, którą trzeba znać przed planowaniem:** `ingredient` i `dish` są **puste** na produkcji
(`SELECT COUNT(*)` → `0` i `0`, sprawdzone). Wykluczenie składnikowe wskazuje `ingredient_id`, więc
**bez seeda nie da się utworzyć ani jednego wykluczenia**, a zrzut „główna funkcjonalność"
pokazałby pustą listę. Do CRUD-a na wykluczeniach potrzeba jednak wyłącznie **składników i grup**,
nie dań — to znacznie mniej niż faza 3 F-01.

**Czego NIE trzeba archiwizować:** obie otwarte zmiany są w toku (`dish-source-and-seed-pool` →
`implementing`, `dietary-preferences` → `planned`). `/10x-archive` dopiero po ukończeniu.

---

## 1. Zasady

Pełny zestaw w `lesson-queue.md` §1. Tu tylko te, o które najłatwiej się potknąć, plus nowe.

- **`npm install` zakazane** → `npm ci`. Playwright poza repo:
  `cd ~/.mealplan-e2e && NODE_PATH="$HOME/.mealplan-e2e/node_modules" npx playwright test`
- **`git add -A` zakazane.** Stage po ścieżkach, wypisz je w Dzienniku.
- **`--no-verify` zakazane.** Bramka krzyczy → napraw przyczynę.
- **`10x get` zakazane** — synchronizuje `.claude/skills/` i kasuje resztę.
- **Znacznik czasu z `date -u +%H:%M`, wklejany W TEJ SAMEJ KOMENDZIE**, w której piszesz wpis.
  13.09 dwa wpisy dostały czas oszacowany, mimo znajomości reguły.
- **`wrangler dev` trzyma `dist/client`** — ubij go przed `expo export`, inaczej EBUSY, a testy
  pojadą przeciw staremu artefaktowi.
- **Harness używa `localhost`, nie `127.0.0.1`** — `azp` porównywane jako łańcuch znaków.

**Praca przez PR (decyzja D24):**

```sh
git checkout -b <nazwa>
git push -u origin <nazwa>
gh pr create --base main --fill
gh pr checks <nr> --watch
gh pr merge <nr> --squash --delete-branch
```

- **W tej sesji scalasz SAM po zielonych sprawdzeniach.** Nikogo nie ma do przeglądu, a czekanie
  zatrzymałoby noc. Własność, która ma zostać zachowana: na `main` nie trafia kod, którego nie
  sprawdziły bramki — self-merge ją zachowuje.
- **Zmiana `.github/workflows/impl-review.yml` wyłącza recenzenta na tym PR-ze** (walidacja wobec
  gałęzi domyślnej). To nie usterka, nie debuguj.

**Warunek produkcyjny:** `migrations apply --remote` **przed** commitem fazy, która go potrzebuje.
Push na `main` wdraża natychmiast.

**Czego NIE ruszasz:** ustawień repozytorium. Dostęp dla oceniających właściciel ustawi sam jutro.

---

## 2. Zadania

### C1 — README (pewniak, zamyka kryterium 5) · ~30 min

Obecny `README.md` to **79 linii startera Expo**, z instrukcją `npm run reset-project`, która
w tym repo jest **zakazana** (przenosi kod do `app-example/`). `mvp-check` wymaga wprost README
mówiącego, czym jest projekt.

**Zachowaj** sekcję `## Deployment` (linie ~44–66) — nie jest ze startera, opisuje realną
kolejność wdrożenia. Resztę napisz od nowa.

**Co ma zawierać:**
- czym jest MealPlan (planowanie posiłków, Expo SDK 57 + Cloudflare Workers + D1 + Clerk),
- **cztery twarde ograniczenia produktowe** z `CLAUDE.md` §„Produkt" (±10% kalorii, zero pozycji
  z wykluczeń, limit czasu przygotowania, jawny błąd zamiast planu częściowego),
- uruchomienie lokalne (`npm ci`, `.env.local` z `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`,
  `.dev.vars` z `CLERK_JWT_KEY`, `npm start`),
- testy: `npm test` (81 jednostkowych) i E2E (poza repo — patrz `tests/e2e/README.md`),
- wdrożenie (zachowana sekcja),
- odnośniki do `context/foundation/` (prd, roadmap, test-plan, tech-stack, lessons) i `CLAUDE.md`.

**Gotowe, gdy:** zero treści startera, zero wzmianki o `reset-project`, `npx tsc --noEmit` czysty.

### C2 — Zrzuty ekranu · ~30 min

Formularz wymaga **pięciu**; cztery da się zrobić automatycznie Playwrightem, bo harness już umie
się logować (`tests/e2e/auth.setup.ts`, `support/sign-in.ts`).

| Zrzut | Wymagany | Skąd |
|---|---|---|
| Ekran logowania | nie | `/sign-in` |
| Strona główna po zalogowaniu | **tak** | zakładka Home z kartą celu |
| Główna funkcjonalność 1 | **tak** | formularz `/profile` |
| Główna funkcjonalność 2 | **tak** | wyliczone zapotrzebowanie na Home |
| Przechodzące testy | **tak** | wyjście `npm test` — **zrzut terminala, robi człowiek** |

**Jak:** napisz jednorazowy skrypt Playwrighta w katalogu harnessu (NIE w repo — to nie jest test),
który loguje się stanem z `.auth`, wchodzi na `/`, `/profile`, i robi `page.screenshot()`.
Zapisz PNG **poza repo** (np. `~/mealplan-zrzuty/`). Zrzuty do gita nie idą.

**Uwaga:** zrób je **po** C6 (wdrożeniu), jeśli C3–C5 wejdą — wtedy pokażą nową funkcjonalność.
Jeśli nocy zabraknie, zrób je z tego, co działa **już teraz** — to jest sens kolejności „pewniaki
najpierw".

### C3 — S-03 faza 1: schemat, repozytorium, trasa · duże

Plan: [`context/changes/dietary-preferences/plan.md`](../context/changes/dietary-preferences/plan.md),
faza 1, **11 kryteriów**, zero odhaczonych. **Tu powstaje brakujące kryterium 1 (Create i Delete
na realnej kolekcji).**

**Migracja to `0005_preferences.sql`** — `0004` zajął indeks `dish_ingredient(ingredient_id)`.
Para wsteczna w `migrations/down/` **obowiązkowa** (pilnuje `check-conventions`).

Kontrakt (skrót; pełny w planie):
- `user_preferences` — `user_id` PK → `app_user`, `max_prep_minutes`, `meals_per_day`, `updated_at`.
  **`CHECK` tylko na enumeracjach** (`meals_per_day` 3–6); zakres `max_prep_minutes` idzie do
  `src/lib/preferences.ts`, **nie do DDL** (precedens: ustalenie F1 przeglądu fazy 2 S-02).
- `exclusion` — `kind` ∈ `ingredient|dish|group`, dokładnie jedno z `ingredient_id`/`dish_id`/
  `group_id` niepuste, `source` ∈ `preferences|plan`, unikalność na krotce.
- `exclusion_group` — `id`, `slug` UNIQUE, `name` po polsku. **Bez `user_id`** — dane współdzielone.
- `ingredient_group` — para PK, **indeks na `group_id`** (inaczej `SCAN`, patrz ustalenie F1
  przeglądu fazy 1 F-01).

Dalej: `src/server/repository/preferences.ts` (wzorzec: `user-profile.ts` — `userId` pierwszym
argumentem, `prepare(` tylko tutaj, wartości przez `bind`), `src/app/api/preferences+api.ts`
(wzorzec: `profile+api.ts` — `requireUserId` **wewnątrz** `try`, `Cache-Control: no-store` tylko
na sukcesie, log bez `userId`), `src/lib/preferences.ts` + test.

**Pamiętaj:** `migrations apply --remote` **przed** commitem tej fazy.

### C4 — Seed składników i grup (warunek demonstracji C5) · średnie

Bez tego C5 nie ma czego pokazać.

**Minimalnie:** ~25 składników z **prawdziwymi** makrami USDA i ~8 grup wykluczeniowych:
grzyby, orzechy, nabiał, ryby, owoce morza, strączki, gluten, wieprzowina.

Składniki muszą:
- mieć `category` z enuma `0003` (`warzywa`, `owoce`, `mieso`, `ryby`, `nabial`, `jaja`,
  `pieczywo`, `suche`, `tluszcze`, `przyprawy`, `inne`),
- **przejść sito Atwatera z progiem bezwzględnym** (decyzja D20 — warzywa przechodzą, błędy
  mapowania nie),
- mieć `name` niosący **stan** produktu („ryż biały, suchy"), bo `0003:23-27` tego wymaga.

Przypisz składniki do grup w `ingredient_group` tak, żeby demo miało sens (pieczarki i borowiki →
grzyby; mleko, ser, jogurt → nabiał).

**Dań NIE seeduj** — do CRUD-a na wykluczeniach niepotrzebne, a faza 3 F-01 wymaga przeglądu
gramatur przez człowieka.

**Jak:** skrypt w `scripts/` **bez zależności** (reszta skryptów repo też ich nie ma) generujący
SQL, albo `wrangler d1 execute --file`. Idempotentnie (`INSERT OR IGNORE` po `slug`/`name`).

### C5 — S-03 faza 2: ekran preferencji · duże

Plan, faza 2, **10 kryteriów**.

- Zakładka w **obu** plikach `app-tabs` (`app-tabs.tsx` natywny — `name` = nazwa pliku trasy;
  `app-tabs.web.tsx` — `name` + `href`). Inaczej trasa nieosiągalna na jednej platformie.
  **Test `3.13` w `profile-screen.spec.ts` jest inwentarzem zakładek — rozszerz jego oczekiwania.**
- **Strażnik `touched` od pierwszej linii** (wzorzec: `profile.tsx:103`).
- `setState` wyłącznie w callbackach obietnicy — nigdy w ciele efektu.
- Rezerwa `BottomTabInset + Spacing.*` w `paddingBottom`.
- Dostępność w prymitywach (ustalenie F6): `TextField` nie nadaje nazw. **`aria-*` nie wystarczy** —
  natywnie nazwę daje `accessibilityLabel`.

**Gotowe, gdy:** da się dodać i usunąć wykluczenie w przeglądarce, a zrzut pokazuje niepustą listę.

### C6 — Wdrożenie i finalne zrzuty

```sh
# ubij wrangler dev i workerd PRZED eksportem
npx expo export -p web
npx wrangler deploy --dry-run --outdir .wrangler-dry   # 6 modułów, nic z node_modules
npx wrangler dev                                        # bramka przed deployem
npx wrangler deploy
```

Smoke test po wdrożeniu: `/` → HTML 200, nieznana ścieżka → 404, `/api/health` →
`{"ok":true,"d1":true,…}`, `/api/account` bez nagłówka → 401.

**Nazwę zasobu do sprawdzenia bierz z WDROŻONEGO HTML-a**, nie z lokalnego `dist/` — hash bundla
bywa niedeterministyczny.

---

## 3. Czego NIE robić

- **Nie implementuj generatora planu (S-04).** Poza zakresem i poza kryteriami.
- **Nie seeduj dań.** Patrz C4.
- **Nie bierz się za 10xArchitect/10xChampion** — właściciel odradził wprost.
- **Nie ruszaj ustawień repozytorium** ani nie dodawaj współpracowników.
- **Nie archiwizuj** `dish-source-and-seed-pool` ani `dietary-preferences` — obie w toku.
- **Plan B na CRUD**, gdyby C3–C5 nie wyszły: `DELETE /api/profile` plus `POST` jako osobna
  operacja. Broni się słabo (singleton, nie „elementy"), więc **tylko jako ratunek**.

---

## 4. Co właściciel robi sam, jutro przy oddawaniu

1. **Odblokowanie dostępu** — dodanie `przeprogramowani` jako współpracownika **albo**
   upublicznienie repo. Bez tego nie ma czego oceniać. Zaproszenie wymaga akceptacji, więc lepiej
   wcześniej.
2. **Zrzut terminala z `npm test`** (pozostałe cztery robi skrypt z C2).
3. **Formularz 10xBuilder** (moduły 1–3):
   <https://baserow.io/form/g6rJ-njiGpV5lPxvot6iRxsXTh8Wb-AnRjy7s2Zck1c>
   Pola wymagane: e-mail, imię i nazwisko, typ projektu, zgoda na promocję, link do repo,
   komentarz o kulisach pracy, 5 zrzutów. Publiczny URL (opcjonalny):
   `https://meal-plan.kurs-ai-szysza.workers.dev`
4. **Materiał na „komentarz o kulisach pracy"** — gotowy w repo, nie trzeba wymyślać:
   `notes/lesson-decisions.md` (D1–D25 z uzasadnieniami i sposobami cofnięcia),
   `context/foundation/lessons.md` (6 reguł z realnych awarii), jedenaście raportów przeglądu
   w `context/`, oraz `notes/lesson-queue.md` §Dziennik.

---

## 5. Dziennik

Dopisuj po **każdym** zadaniu i przy każdej blokadzie.

```
### <HH:MM UTC> — <ID> <tytuł>
Wynik: ok | blocked | failed | pominięte
Co zrobione: <jedno–trzy zdania>
Co zacommitowane: <ścieżki — dowód, że nie było `git add -A`>
PR: <numer albo ->
Do decyzji: <albo ->
```

<!-- DZIENNIK PONIŻEJ -->

### 20:32 UTC — C1 README
Wynik: ok
Co zrobione: `README.md` napisany od nowa — czym jest MealPlan, cztery twarde ograniczenia
produktowe, uruchomienie lokalne (`npm ci`, `.env.local`, `.dev.vars`), testy i bramki, struktura
oraz odnośniki do `context/foundation/`. Zero treści startera, zero wzmianki o `reset-project`;
sekcja `## Deployment` zachowana bez zmian. `npx tsc --noEmit`, `npm run check-conventions`
i `npm test` (81/81) czyste, wszystkie odnośniki w README wskazują na istniejące pliki.
Co zacommitowane: `README.md`, `notes/cert-queue.md`
PR: #6
Do decyzji: zachowana sekcja `## Deployment` została po angielsku w reszcie polskiego README —
ujednolicenie języka to osobna, świadoma decyzja właściciela.

### 20:42 UTC — C2 Zrzuty ekranu
Wynik: ok
Co zrobione: cztery automatyczne zrzuty zrobione i **obejrzane**: `01-ekran-logowania.png`,
`02-strona-glowna.png` (Home z kartą 2759 kcal), `03-funkcjonalnosc-profil.png` (wypełniony
formularz z rozbiciem 1780 × 1,55 = 2759 i komunikatem „Zapisano"), `04-funkcjonalnosc-
zapotrzebowanie.png` (to samo Home w szerokości telefonu). Leżą w `~/mealplan-zrzuty/`, **poza
repo**. Skrypt jednorazowy: `~/.mealplan-e2e/zrzuty.mjs` — też poza repo, bo nic nie sprawdza;
uruchomienie: `cd ~/.mealplan-e2e && NODE_PATH="$HOME/.mealplan-e2e/node_modules" node zrzuty.mjs`.
Jechało przeciw `wrangler dev` na `localhost:8787` (lokalna D1, nie produkcja); `dist/` z 19:58
było aktualne, więc bez ponownego `expo export`.
Co zacommitowane: `notes/cert-queue.md` (zrzuty i skrypt z założenia nie wchodzą do repo)
PR: #7
Do decyzji: piąty zrzut (terminal z `npm test`) zostaje po stronie właściciela — punkt 4.2.
Jeśli C3–C5 wejdą, wystarczy powtórzyć jedną komendę po C6, żeby zrzuty pokazały wykluczenia.
