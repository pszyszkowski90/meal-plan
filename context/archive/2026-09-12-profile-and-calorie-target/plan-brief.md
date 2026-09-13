# Profil użytkownika i wyliczone zapotrzebowanie kaloryczne — krótki plan

> Pełny plan: `context/changes/profile-and-calorie-target/plan.md`
> Wersja 1 (2026-09-12). Badanie z 8.09.2026 nie zostało zacommitowane i przepadło; jego
> ustalenia odtworzono w sesji planowania i zapisano w tabeli decyzji poniżej.

## Co i dlaczego

Zalogowany użytkownik podaje w zakładce **Profil** wiek, wagę, wzrost, płeć (do wzoru) i poziom
aktywności 1–5, może to edytować i widzi wyliczone dzienne zapotrzebowanie z rozbiciem na
podstawową przemianę materii i współczynnik aktywności. Może nadpisać cel własną liczbą kcal
i wrócić do wyliczenia. To fragment S-02 mapy drogowej (FR-002, FR-003, Open Question 5) — jedno
z trzech wejść generatora planu (S-04), a zarazem źródło celu, którego pilnuje ograniczenie ±10%.

## Punkt wyjścia

S-01 jest zamknięte i na produkcji: `requireUserId`, repozytorium z `userId` w pierwszym
argumencie, `useAuthedFetch()` z rozróżnieniem offline / brak sesji, migracja `0001_app_user`
z parą `down/`, trasa odniesienia `/api/account`. Ekrany `(app)` to nadal starter („Welcome to
Expo”, „Explore”). Nie ma kontrolki wyboru, żadna trasa nie czyta ciała żądania, nie ma runnera
testów. Repo działa na Node 25, więc natywne `node --test` ze zdejmowaniem typów działa bez
transpilera (sprawdzone).

## Pożądany stan końcowy

Na produkcji i w Expo Go: zakładki **Home** / **Profil**. Profil pokazuje podgląd wyliczenia już
w trakcie wpisywania („1 780 kcal × 1.55 = 2 759 kcal dziennie”), zapisuje przez `PUT /api/profile`,
zwraca błędy pod pola, nie gubi wartości offline. „Własny cel” nadpisuje wynik i przeżywa edycję
profilu; „Wróć do wyliczenia” go czyści. Home pokazuje kartę obowiązującego celu albo wezwanie
„Uzupełnij profil” z przejściem. `npm test` przypina stałe wzoru.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) |
| --- | --- | --- |
| Wzór | **Mifflin-St Jeor** + mnożniki aktywności 1.2 / 1.375 / 1.55 / 1.725 / 1.9 | Najdokładniejszy wzór dla dorosłych wg ADA, a mnożniki zna każdy kalkulator — użytkownik może sprawdzić liczbę gdzie indziej |
| Zaokrąglanie | wynik z **zaokrąglonego** BMR: `round(round(bmr) × mnożnik)` | Wyjaśnienie na ekranie ma się zgadzać z tym, co użytkownik policzy ręcznie, co do 1 kcal |
| Pole celu (schudnąć / utrzymać / przytyć) | **nie** — jedyną korektą jest ręczne nadpisanie | Zakres dokładnie jak FR-002/FR-003; wybór deficytu ociera się o poradę dietetyczną z Non-Goals |
| Model nadpisania | osobna liczba kcal, **zostaje po edycji profilu**, jawne „Wróć do wyliczenia” | Poprawka literówki nie kasuje świadomie ustawionego celu; generator czyta jedno pole „obowiązujący” |
| Wyjaśnienie (OQ5) | rozbicie na dwa wiersze (BMR, × mnożnik) + wynik + jedno zdanie | PRD: sama liczba budzi nieufność; składowe są sprawdzalne |
| Gdzie żyje wyliczenie | jeden czysty moduł `src/lib/calorie-target.ts` po obu stronach; **cel nie jest utrwalany** w D1 | Podgląd na żywo i odpowiedź API liczą identycznie; S-04 użyje tego samego modułu bez dryfu |
| Nawigacja | zakładka „Profil” **zastępuje** „Explore”; Home dostaje kartę celu | Dwie zakładki jak dziś, minimalna zmiana obu plików `app-tabs`; starter przestaje udawać produkt |
| Brak profilu | bez przymusu — Home pokazuje wezwanie z przejściem | Bramki sesji mają jednego właściciela; druga bramka zależna od API to stan ładowania i offline w miejscu celowo minimalnym |
| Walidacja | 18–100 lat, 30–300 kg (do 0,1), 100–250 cm, cel 1000–6000 kcal; granice włącznie | Wzór zwalidowany dla dorosłych; granice łapią literówki, które inaczej trafiłyby do generatora |
| Płeć | dwie wartości (kobieta / mężczyzna) z etykietą „do wyliczenia” | Zapisujemy dokładnie to, czego używa wzór; enum dwóch wartości w schemacie |
| Test wzoru | `node --test` na czystym module, `npm test`, **zero nowych zależności** | Lockfile nietknięty (reguła `check-lock`), a stałe wzoru przestają być komentarzem |
| Kontrakt API | jedna trasa `/api/profile`, `GET` i `PUT`, ten sam kształt `{ profile, target }`; brak profilu = 200 z `null` | Klient nie myli „brak profilu” z awarią; po zapisie bierze odpowiedź bez scalania |
| Klucz obcy | `user_profile.user_id REFERENCES app_user(id)`; `PUT` woła `touchAppUser` przed zapisem | D1 wymusza FK domyślnie; konto, które nie weszło na Home, nie ma jeszcze wiersza `app_user` |

## Zakres

**W zakresie:** moduł wzoru i walidacji z testem; `allowImportingTsExtensions` i skrypt `npm test`;
migracja `0002_user_profile` z parą `down/`; repozytorium `user-profile.ts`; trasa `/api/profile`
(`GET`/`PUT`); prymityw `ChoiceField`; ekran `/profile`; zakładka Profil na obu platformach
i usunięcie Explore; karta celu na Home; smoke na produkcji; aktualizacja `CLAUDE.md`.

**Poza zakresem:** pole celu i presety deficytu; historia pomiarów; onboarding wymuszający profil;
utrwalanie wyliczonego celu; jednostki imperialne; wiek < 18; trzecia wartość płci; podział na
posiłki (S-03/S-04); Vitest i testy komponentów; usuwanie konta; przebudowa Home poza kartą;
sprzątanie assetów startera.

## Architektura / Podejście

```
src/lib/calorie-target.ts  ── typy, granice, validateProfile, computeCalorieTarget, ProfileResponse
        ▲                                   ▲
        │ podgląd na żywo, błędy pod polami  │ walidacja ciała, wyliczenie w odpowiedzi
src/app/(app)/profile.tsx                src/app/api/profile+api.ts   GET | PUT
src/app/(app)/index.tsx (TargetCard)        │ requireUserId → touchAppUser → repozytorium
        │ useAuthedFetch('/api/profile')    ▼
        └──────────────────────────► src/server/repository/user-profile.ts
                                            │ getUserProfile / saveUserProfile (userId, …)
                                            ▼
                                     D1 user_profile ──FK──► app_user
```

Zapisujemy wejścia i nadpisanie, liczymy przy odczycie. Jeden moduł, jedna trasa, jeden kształt.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Wzór i walidacja jako czysty moduł z testem | `calorie-target.ts`, `.test.ts`, `npm test`, `tsconfig` | Lint może zgłosić import `.ts` — wyciszenie punktowe w teście, nie globalne |
| 2. Granica danych profilu na serwerze | migracja `0002` + `down/`, repozytorium, `/api/profile`, `--remote` przed commitem | Okno 500, jeśli `--remote` pójdzie po pushu; FK bez `touchAppUser` |
| 3. Ekran profilu i karta celu | `ChoiceField`, `profile.tsx`, obie zakładki (+ `profile.png`), Home, usunięcie Explore | Typed routes regenerują się dopiero po `expo start` |
| 4. Produkcja i reguły | smoke na Workerze, przebieg web + Expo Go, `CLAUDE.md` | Mały — faza sprawdza, nie zakłada |

**Wymagania wstępne:** S-01 na produkcji (jest); dwa konta testowe z tokenami z działającej
aplikacji; telefon z Expo Go i `EXPO_PUBLIC_API_URL` w `.env.local`; dostęp do
`wrangler d1 migrations apply --remote`. Żadnych nowych sekretów ani zmiennych buildu.

**Szacowany nakład pracy:** ~3 sesje po godzinach — faza 1 krótka, fazy 2 i 3 po sesji, faza 4
w ogonie fazy 3.

## Otwarte ryzyka i założenia

- Mifflin-St Jeor zaniża dla bardzo umięśnionych i zawyża dla otyłych; produkt tego nie koryguje
  (Non-Goals) — nadpisanie jest zaworem bezpieczeństwa.
- Karta Home odświeża się na sygnał `useIsFocused()` z refem „pobrano w tym fokusie” (nie
  `useFocusEffect` — bez `useCallback` jego callback leci przy każdym renderze; przegląd planu F2).
  Na webie headless `Tabs` powinny emitować fokus; jeśli nie, zostaje odświeżenie przy montowaniu
  i użytkownik widzi stary cel do przeładowania strony.
- Ostrzeżenie Node o braku `"type"` w `package.json` wyciszamy flagą; dopisanie `"type": "module"`
  jest zakazane (CommonJS w skryptach i trasach Metro).

## Kryteria sukcesu (podsumowanie)

- Użytkownik wpisuje 80 kg / 180 cm / 30 lat / mężczyzna / poziom 3 i **przed** zapisem widzi
  „1 780 × 1.55 = 2 759 kcal”; po zapisie Home pokazuje tę liczbę na webie i w Expo Go.
- Nadpisanie 2 200 przeżywa zmianę wagi, a „Wróć do wyliczenia” je czyści; wiek 17 i waga 7 nie
  przechodzą; offline nie wylogowuje i nie gubi wpisanych wartości.
- `GET /api/profile` konta A nigdy nie oddaje danych konta B; bez tokenu 401; `npm test` zielony.
