# Brief: Moduł 3, Lekcja 2 — Od planu do testów jednostkowych

> **From Plan to Tests: Implementing Units with an Agent**
> Brief pisany po nocy, w której problem wyroczni z tej lekcji zadecydował o kształcie
> testów kalorycznych (12/13.09.2026).

## Co lekcja wprowadza

Zamienia mapę ryzyk z lekcji 1 w testy, które **naprawdę chronią kod**. Diagnozuje, dlaczego
testy generowane przez LLM tracą około połowy skuteczności na realnych funkcjach — **problem
wyroczni** i anty-wzorce „vibe-testingu" — i pokazuje, jak kontrakt jakości kieruje każdą fazę
wdrożenia przez `/10x-research` → `/10x-plan` → `/10x-implement`. Wprowadza `/10x-tdd` jako
opcjonalny tryb test-first tam, gdzie da się z góry nazwać pierwszą nieudaną asercję. Zamyka
**testowaniem mutacyjnym** jako bramką dowodzącą, czy asercja łapie regresję, czy tylko wykonuje
linię kodu.

**Problem wyroczni** to rdzeń lekcji: wartość oczekiwana zaczerpnięta z implementacji poddawanej
testowi. Taki test jest tautologią — zatwierdza bieżące zachowanie **razem z bieżącymi błędami**
i nigdy nie może zawieść z właściwego powodu.

## Co z tego dotyczy MealPlana

Wzór kaloryczny jest miejscem, gdzie ta lekcja ma w tym repo największą stawkę. Plan tygodnia
(S-04) weźmie cel dnia właśnie stąd, a PRD stawia twardy guardrail ±10%. Błąd we wzorze przenosi
się na **każdy** wygenerowany plan.

Dlatego wszystkie liczby w testach — 1780 kcal (przemiana materii), × 1,55 (aktywność), 2759 kcal
(cel), 2200 (nadpisanie) — pochodzą z **kryteriów planu**, czyli z wymagania, i nigdy z uruchomienia
`calorie-target.ts`. Zapisałem to wprost w nagłówku
[`profile-api.spec.ts`](../tests/e2e/profile-api.spec.ts), żeby następna sesja nie „uprościła"
tego przez wklejenie aktualnego wyniku.

**Test tej dyscypliny wypadł pozytywnie w praktyce:** przesunięcie wyniku `computeCalorieTarget`
o 7 kcal zapaliło cztery testy jednostkowe i test E2E („Expected 2759, Received 2766"). Gdyby
wyrocznia pochodziła z implementacji, oba przebiegi byłyby zielone, a guardrail ±10% liczyłby
się od złej liczby.

Druga rzecz wprost z lekcji: **asercje behawioralne zamiast lustra implementacji**. Test
kryterium 3.9 nie sprawdza, czy pojawił się komunikat o błędzie — sprawdza, że **żądanie nie
wyszło do sieci** (liczy żądania `PUT`). To jest obserwowalny skutek biznesowy; komunikat to
szczegół prezentacji, który wolno zmienić bez łamania testu.

## Co warto zastosować i gdzie

- **Dwuwarstwowa strategia** z lekcji odwzorowała się tu jako podział: czyste moduły w `src/lib/`
  testuje `npm test` (`node --test`, zero zależności), a kontrakt trasy — test integracyjny po
  HTTP z pominięciem UI ([`profile-api.spec.ts`](../tests/e2e/profile-api.spec.ts)). Pominięcie
  UI jest tu istotą, nie wygodą: walidacja klienta nie może przesłaniać walidacji serwera, bo
  klient jest pod kontrolą atakującego.
- **Testowanie mutacyjne bez Strykera.** Nie mogę dołożyć zależności (lockfile), ale *ideę* dało
  się zrealizować ręcznie: każda asercja tej nocy przeszła próbę celowego zepsucia. To jest
  mutacja robiona ręką zamiast narzędziem — ta sama odpowiedź na to samo pytanie („czy ta asercja
  cokolwiek łapie"), tylko punktowo zamiast systematycznie. Stryker zostaje jako kandydat, gdy
  runner przestanie być ograniczony do `src/lib/`.
- **`/10x-tdd` byłby tu właściwy dla fazy 1** (wzór i walidacja), gdzie pierwszą nieudaną asercję
  dało się nazwać z góry: „2759 dla 80/180/30/mężczyzna/3". Dla faz 2–4 (serwer, ekran, produkcja)
  test-first nie miał sensu i plan słusznie kierował je do `/10x-implement`.

## Czego lekcja NIE robi

Nie zastępuje testów E2E — to lekcja 4. Nie twierdzi, że pokrycie jest celem: jednostką pracy
jest chronione ryzyko, nie procent linii. I nie udaje, że agent napisze dobre testy bez kontraktu —
cała lekcja jest o tym, że **bez wyroczni z niezależnego źródła** generowanie testów produkuje
zielone tautologie.
