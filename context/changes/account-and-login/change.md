---
change_id: account-and-login
title: Konto e-mail + hasło i granica danych użytkownika
status: impl_reviewed
created: 2026-08-31
updated: 2026-09-11
archived_at: null
---

## Notes

- Element mapy drogowej: **S-01** (`context/foundation/roadmap.md`), kamień milowy M-01.
- Odnośniki PRD: FR-001, sekcja Access Control.
- Odblokowuje: S-02 (`profile-and-calorie-target`) i S-03 (`dietary-preferences`).
- Pierwsza zmiana dotykająca D1: wprowadza schemat, konwencję migracji i warstwę repozytorium,
  którą dziedziczy każdy późniejszy fragment.

### Decyzja: dostawcą tożsamości jest Clerk (2026-09-01)

Plan v1 (31.08.2026) zakładał **Better Auth na D1**. Przegląd planu wykazał sześć poważnych
ustaleń, z czego trzy dotyczyły nie produktu, lecz tarcia biblioteki z tym runtime'em: CLI
generujące schemat nie umiało załadować konfiguracji zależnej od bindingów, kontrakt `baseURL` nie
istniał dla trzech środowisk, a hashowanie hasła nie mieściło się w limicie CPU. Ponowne badanie
opcji (1.09.2026) potwierdziło, że część z tego naprawiły wydania Better Auth 1.5 i 1.7 — natywne
wsparcie D1, nowe CLI, dynamiczny `baseURL` — ale dwa ryzyka zostały:

1. `@better-auth/utils/password` nie deklaruje warunku eksportu `workerd`, więc bundle na Workers
   dostaje czysto-JS scrypt (~4,5–5 s CPU). W naszym przypadku bundlerem jest Metro, nie wrangler,
   więc wynik był niemożliwy do przewidzenia bez pomiaru.
2. `@better-auth/expo` psuł się przy każdym kolejnym SDK Expo (SDK 55: `import.meta` w Hermes,
   SDK 56: dynamiczne importy, iOS: rozwiązywanie `.cjs` w Metro). Wszystkie zgłoszenia zamknięte,
   ale jesteśmy na SDK 57 — nowszym niż każde z nich.

Wybrano **Clerk**, bo przenosi hashowanie, sesje, maile i limit prób poza nasz kod, a stronę
serwerową sprowadza do weryfikacji podpisu tokenu kluczem publicznym. To usuwa całą klasę ryzyka
„ciężka biblioteka auth bundlowana przez Metro do workerd", która przewróciła plan v1.

Rozważone i odrzucone: **własne minimalne auth** (musielibyśmy napisać reset, weryfikację i limit
prób, czyli dokładnie to, co jest w zakresie), **Supabase Auth** (ciągnie projekt Postgresa,
którego nie używamy, i drugi panel), **EAS Hosting** (to wyłącznie hosting — Expo nie ma produktu
auth i samo odsyła do Clerka, Supabase i Better Auth; do tego działa na tym samym runtime workerd,
więc nie usuwa żadnego z naszych ograniczeń).

Świadomie przyjęte koszty: e-mail i hash hasła mieszkają u Clerka (rezydencja danych w wybranym
regionie to funkcja planów płatnych), sesja na planie Hobby ma sztywne 7 dni, i powstaje
uzależnienie od dostawcy. Dane objęte guardrailem prywatności z PRD — waga, wiek, płeć — zostają
w D1 w regionie EEUR.

Skutek uboczny: **plan Workers Paid przestaje być wymaganiem tej zmiany** (był potrzebny wyłącznie
pod hashowanie). Wraca jako temat przy generatorze planu — Otwarte pytanie 6 mapy drogowej.
