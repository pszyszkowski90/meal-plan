<!-- IMPL-REVIEW-REPORT -->
# Przegląd implementacji: Konto e-mail + hasło i granica danych użytkownika

- **Plan**: context/changes/account-and-login/plan.md
- **Zakres**: Faza 2 z 4 (commit `529c9db` — Reset hasła)
- **Data**: 2026-09-08
- **Werdykt**: WYMAGA UWAGI przy przeglądzie → po sortowaniu 2026-09-08 **8/8 ustaleń FIXED** (F1 via Fix A). `npx tsc --noEmit` i `npx expo lint` czyste po poprawkach. Wiersz Progress 2.6 zamknięty 9.09.2026 (tryb *bulk* był już włączony; *strict* niedostępny — patrz korekta F3). Poprawki niezacommitowane — wchodzą jednym commitem z tym raportem.
- **Ustalenia**: 0 krytycznych, 3 ostrzeżenia, 5 obserwacji

## Werdykty

| Wymiar | Werdykt |
|-----------|---------|
| Zgodność z planem | PASS (sekwencja SDK, pominięcie `verifyCode` po odrzuconym haśle, `finalize()` bez nawigacji, link w sign-in — wszystko MATCH) |
| Dyscyplina zakresu | WARNING (F5 — nieszkodliwy dodatek) |
| Bezpieczeństwo i jakość | WARNING (F1, F2, F3) |
| Architektura | PASS (nawigacja po sesji nadal ma jednego właściciela — bramkę `(auth)`) |
| Spójność wzorców | WARNING (F4) |
| Kryteria sukcesu | PASS (2.1 `tsc` PASS, 2.2 `lint` PASS — ponowne uruchomienie 2026-09-08; 2.3–2.5 ręczne, `[x]` na słowo użytkownika, bez śladu w diffie z natury: e-mail, Expo Go) |

## Kontekst weryfikacji

- Pliki kodu w commicie: `src/app/(auth)/forgot-password.tsx` (nowy, 182 linie), `src/app/(auth)/sign-in.tsx` (+4 linie). Pozostałe zmiany to plan/change/raport fazy 1.
- Sprawdzone w typach SDK (`@clerk/shared` 4.6.1): `create`, `sendCode`, `verifyCode`, `submitPassword`, `finalize` zwracają `{ error }` i nie rzucają; błąd z `meta.paramName` trafia do `errors.fields.<pole>`, bez `paramName` do `errors.global`. `form_identifier_not_found` ma `paramName: identifier` — maska z linii 133–137 działa dla tego przypadku.
- Twarde reguły repo: brak `useMemo`/`useCallback`/`useEffect`, brak surowych kolorów i liczb w `StyleSheet`, wyłącznie `ThemedText`/`ThemedView`, importy przez `@/*`, kebab-case — wszystko spełnione. Brak `console.*`, hasło nigdzie nie logowane.

## Ustalenia

### F1 — Błąd `sendCode()` zdradza istnienie konta i jego metodę logowania

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🔎 ŚREDNI — prawdziwy kompromis; zatrzymaj się, aby to przemyśleć
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/app/(auth)/forgot-password.tsx:61-64
- **Szczegóły**: Nieznany adres przechodzi do kroku kodu (maska), ale konto **istniejące**, dla którego `sendCode()` zawiedzie — np. konto założone tylko przez Google (bez czynnika hasła) albo limit wysyłek — zostaje na kroku e-maila z surowym komunikatem Clerka z `errors.global`. Trzy różne zachowania (nieznany → krok kodu; znane z hasłem → krok kodu; znane bez hasła → błąd) to właśnie wyszukiwarka kont, której plan chciał uniknąć.
- **Poprawka A ⭐ Zalecana**: Przy `sendError` zachowaj się jak dla nieznanego adresu — `setAttemptExists(false)`, `setStep('code')` — i nie renderuj błędu globalnego z tego wywołania.
  - Siła: Jedna odpowiedź ekranu niezależnie od stanu konta; spójna z intencją planu i z tym, co zrobi ochrona w dashboardzie po włączeniu.
  - Kompromis: Realne awarie (limit wysyłek, brak sieci) też znikają pod maską — użytkownik dowie się dopiero po wpisaniu kodu, że „kod jest nieprawidłowy". Można wyłączyć spod maski `ClerkOfflineError`/błędy sieci.
  - Pewność: MED — nie potwierdzono na żywo, co Clerk zwraca dla konta Google-only przy `sendCode()`; kod błędu może wymagać osobnego rozpoznania.
  - Martwy punkt: Zachowanie po włączeniu ochrony w dashboardzie — czy Clerk maskuje też ten przypadek. (Rozstrzygnięte 9.09.2026 przy korekcie F3: nie maskuje, bo dostępny jest tylko tryb *bulk*.)
- **Poprawka B**: Zostaw krok e-maila, ale zamień surowy komunikat na jeden neutralny („Nie udało się wysłać kodu. Spróbuj ponownie.") dla każdego `sendError`.
  - Siła: Awarie pozostają widoczne; zmiana dwóch linii.
  - Kompromis: Nadal inna odpowiedź niż dla adresu nieznanego — wyciek „konto istnieje, ale nie ma hasła" zostaje.
  - Pewność: HIGH — zachowanie w pełni po naszej stronie.
  - Martwy punkt: Brak znaczących.
- **Decyzja**: FIXED via Fix A — 2026-09-08: `setAttemptExists(!sendError)` + `setStep('code')` przy każdym wyniku `sendCode()`; `errors.global` renderowane tylko na kroku e-maila albo gdy próba istnieje.

### F2 — Błędy kodu bez `paramName` pokazane surowo i inaczej niż na ścieżce maskowanej

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/app/(auth)/forgot-password.tsx:78-82, 93, 145-149
- **Szczegóły**: Do `CODE_REJECTED` normalizowany jest tylko błąd z `errors.fields.code` (`form_code_incorrect`). Odpowiedzi `verifyCode` bez `paramName` — kod wygasły, „za dużo prób" — lądują w `errors.global` i są renderowane dosłownie (angielska treść Clerka), a na ścieżce maskowanej (`attemptExists === false`) każdy kod daje polski `CODE_REJECTED`. Różnica treści zdradza, że próba istnieje. Plan wymagał „komunikatem identycznym jak dla kodu błędnego".
- **Poprawka**: W `submitNewPassword` ustaw `setCodeRejected(true)` przy **każdym** błędzie `verifyCode` i nie renderuj `errors.global`, gdy `codeRejected` jest `true` (błędy `submitPassword`/`finalize` nadal widoczne, `errors.fields.password` bez zmian).
- **Decyzja**: FIXED — 2026-09-08: `setCodeRejected(true)` przy każdym błędzie `verifyCode`; `codeError` zależy już tylko od `codeRejected`; `errors.global` ukryte, gdy `codeRejected`.

### F3 — Maska po stronie ekranu jest tylko UI; ochrona w dashboardzie odłożona „docelowo"

- **Ważność**: ⚠️ OSTRZEŻENIE
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/app/(auth)/forgot-password.tsx:22-26, 42, 73-76 (oraz plan, faza 2 krok 1)
- **Szczegóły**: `signIn.create()` nadal dostaje 422 `form_identifier_not_found` z FAPI (widoczne w zakładce Network), a odrzucenie kodu na ścieżce maskowanej nie robi żadnego żądania — `busy` (linia 42, pochodna `fetchStatus`) nigdy nie mignie, odpowiedź jest natychmiastowa. Maska zwodzi tylko przypadkowego użytkownika. Plan sam nazywa ochronę w dashboardzie „docelowym źródłem prawdy", ale nie ma dla niej kroku ani wiersza Progress — to wada planu, nie kodu.
- **Poprawka**: Włącz *Enumeration protection* w dashboardzie Clerka (Configure → Attack protection) teraz i dopisz to jako wiersz ręczny Progress fazy 2 (np. 2.6); w komentarzu pliku zmień „docelowe" na „włączone, maska to pas bezpieczeństwa".
- **Decyzja**: FIXED, potem **skorygowana 2026-09-09** — poprawka opierała się na dwóch błędnych założeniach, oba wyszły przy próbie wykonania kroku przez użytkownika:
  1. **Zła ścieżka.** „Configure → Attack protection" pochodzi ze zmiany z 7.08.2025 i już nie istnieje. Aktualnie: *Protect → Rules → User enumeration protection → Manage*.
  2. **Zły wniosek.** Ustawienie **nie zastępuje** maski. Tryb *bulk* to same limity częstotliwości i istnienia konta nie ukrywa. Tryb *strict* ukrywa, ale wymaga, żeby **hasło nie było pierwszą strategią logowania** (trzeba je wyłączyć albo ustawić preferowaną strategię na OTP) — a `sign-in.tsx` startuje od `signIn.password()`. Dwa pozostałe warunki strict (Open access mode, brak username) spełniamy.

  Stan po korekcie: maska ekranowa jest **jedynym** mechanizmem ukrywającym istnienie konta, dopóki logowanie jest hasło-pierwsze; zmiana tego to decyzja produktowa poza FR-001. Tryb *bulk* okazał się już włączony na instancji (potwierdzone przez użytkownika 9.09.2026), więc wiersz Progress 2.6 jest `[x]` bez dodatkowej pracy — limity częstotliwości mamy, ukrywania istnienia konta nie. Plan → v2.7, komentarz w `forgot-password.tsx` przepisany. Źródło: [dokumentacja Clerka](https://clerk.com/docs/guides/secure/user-enumeration-protection).

### F4 — Trzecia kopia bloku `errors.global` i stylów `container`/`safeArea`

- **Ważność**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/app/(auth)/forgot-password.tsx:145-149, 165-178 (kopie: sign-in.tsx:72-76, 104-118; sign-up.tsx:125-129, 168-185)
- **Szczegóły**: Faza 1 (F8) wyniosła przycisk do `action-button.tsx` z uzasadnieniem „trzecia kopia stylu to już wzór". Faza 2 tworzy trzecią kopię mapowania `errors.global` i trzecią kopię `container`/`safeArea`. Kod działa i jest zgodny z planem — to obserwacja, nie blokada.
- **Poprawka**: Wyciągnij `src/components/ui/auth-screen.tsx` (ramka `ThemedView` + `SafeAreaView` ze stylami) i `global-errors.tsx` (mapowanie `errors.global`), podmień w trzech ekranach.
- **Decyzja**: FIXED — 2026-09-08: `src/components/ui/auth-screen.tsx` (`AuthScreen`) i `global-errors.tsx` (`GlobalErrors`), podmienione w sign-in, sign-up i forgot-password; style `container`/`safeArea` i importy `SafeAreaView`/`MaxContentWidth`/`ThemedView` usunięte z ekranów.

### F5 — „Wróć do logowania" poza planem, `push` zamiast powrotu

- **Ważność**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Dyscyplina zakresu
- **Lokalizacja**: src/app/(auth)/forgot-password.tsx:157-159
- **Szczegóły**: Plan nie przewidywał linku powrotnego; dodatek jest nieszkodliwy (nie nawiguje po `finalize()`, właścicielem pozostaje bramka). `router.push('/sign-in')` z ekranu, na który weszło się `push`-em z sign-in, buduje stos sign-in → forgot → sign-in; przycisk wstecz na Androidzie wraca na forgot-password. Ten sam ping-pong istnieje między sign-in i sign-up od fazy 1.
- **Poprawka**: `router.canGoBack() ? router.back() : router.push('/sign-in')`; dopisz link do kroku 1 fazy 2 jako aneks.
- **Decyzja**: FIXED — 2026-09-08: `router.canGoBack() ? router.back() : router.push('/sign-in')` z komentarzem; aneks v2.6 w kroku 1 fazy 2 planu.

### F6 — Pole kodu edytowalne po `needs_new_password`

- **Ważność**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Bezpieczeństwo i jakość
- **Lokalizacja**: src/app/(auth)/forgot-password.tsx:78, 106-115
- **Szczegóły**: Po udanym `verifyCode` i odrzuconym haśle ponowna próba poprawnie pomija weryfikację, ale pole kodu pozostaje aktywne, a zmiana jego wartości jest po cichu ignorowana.
- **Poprawka**: `editable={signIn.status !== 'needs_new_password'}` na polu kodu (albo ukryj pole i zmień nagłówek na „Kod przyjęty — ustaw nowe hasło").
- **Decyzja**: FIXED — 2026-09-08: `codeAccepted = signIn.status === 'needs_new_password'`, pole kodu `editable={!codeAccepted}`.

### F7 — Brak ponownej wysyłki kodu (sign-up ją ma)

- **Ważność**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Spójność wzorców
- **Lokalizacja**: src/app/(auth)/forgot-password.tsx:100-127
- **Szczegóły**: Rejestracja dostała „Wyślij kod ponownie" w wersji 2.3 planu; reset go nie ma. Zgubiony mail zmusza do powrotu na sign-in i ponownego wpisania adresu. Plan tego nie wymagał — nie jest to odchylenie.
- **Poprawka**: `Pressable disabled={busy}` wołający `sendCode()` ponownie; w gałęzi `!attemptExists` nic nie rób, żeby maska trzymała.
- **Decyzja**: FIXED — 2026-09-08: `resendCode()` (no-op pod maską, wynik `sendCode()` celowo pominięty), stan `codeResent` steruje nagłówkiem i ukrywa `errors.global`; link znika po `codeAccepted`. Aneks v2.6 w planie.

### F8 — Wiersze Progress 2.1–2.5 odhaczone bez SHA; SHA dopisane, ale niezacommitowane

- **Ważność**: ℹ️ OBSERWACJA
- **Wpływ**: 🏃 NISKI — szybka decyzja; poprawka jest oczywista i wąsko zakrojona
- **Wymiar**: Kryteria sukcesu
- **Lokalizacja**: context/changes/account-and-login/plan.md:867-874
- **Szczegóły**: Commit `529c9db` zaznaczył 2.1–2.5 jako `[x]` bez ` — <sha>`; sufiksy `— 529c9db` siedzą w drzewie roboczym (`git diff` pokazuje tylko te 5 linii). Konwencja Progress wymaga SHA po zakończeniu kroku — bez commitu ślad zginie przy `checkout`.
- **Poprawka**: Dołącz `plan.md` do commitu poprawek z tego przeglądu (razem z tym raportem i `change.md`).
- **Decyzja**: FIXED — 2026-09-08: `plan.md` z sufiksami `— 529c9db` (i aneksami v2.6) wchodzi do commitu poprawek z tego przeglądu razem z raportem, `change.md` i kodem F1–F7.
