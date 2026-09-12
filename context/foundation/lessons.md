# Lessons Learned

> Rejestr powtarzających się reguł i wzorców, tylko do dodawania. Ponownie odczytywany na początku
> przez /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

<!-- Pierwsze cztery wpisy pochodzą z jednej nocnej sesji (12/13.09.2026) — każdy z realnej
awarii, nie z teorii. Kolejne wpisy dopisuj pojedynczo. -->

## Zatrzymaj serwer, zanim przebudujesz artefakt, który właśnie testujesz

- **Kontekst**: każda weryfikacja przeciw `wrangler dev` na zbudowanym `dist/` — bramki faz,
  próby celowego zepsucia, przebiegi harnessu E2E.
- **Problem**: `wrangler dev` trzyma otwarte `dist/client`, więc `npx expo export -p web` przerywa
  z `EBUSY: resource busy or locked`. Jeśli przeoczysz ten błąd w wyjściu, serwer nadal serwuje
  **stary** build, a testy jadą przeciw poprzedniej wersji kodu. Tej nocy próba celowego zepsucia
  „przeszła na zielono" właśnie z tego powodu — zepsucie nigdy nie dotarło na serwer, a wynik
  wyglądał jak dowód, że asercje są dobre. Był dowodem, że nic nie zostało sprawdzone.
- **Reguła**: Przed `expo export` zatrzymaj `wrangler dev` i procesy `workerd`. Po przebudowie
  **potwierdź, że zmiana faktycznie jest w artefakcie** (np. `grep` po `dist/server/`), zanim
  uznasz jakikolwiek wynik testu za dowód.
- **Dotyczy**: implement, impl-review

## `azp` porównywane jest jako łańcuch znaków — `localhost` to nie `127.0.0.1`

- **Kontekst**: każde uwierzytelnione żądanie z przeglądarki do własnego API, lokalnie i na produkcji.
- **Problem**: `src/server/auth.ts` sprawdza roszczenie `azp` przez `AUTHORIZED_PARTIES.includes(azp)`,
  czyli **dosłownym porównaniem tekstu**. Lista zawiera `http://localhost:8787`. Przeglądarka
  otwarta pod `http://127.0.0.1:8787` wysyła `azp: "http://127.0.0.1:8787"` i dostaje **401 bez
  żadnej wskazówki**: logowanie przechodzi, bramka sesji wpuszcza, a ekran pokazuje „Serwer
  odrzucił żądanie (401)". Wygląda jak zepsuta autoryzacja, jest literówką w adresie.
- **Reguła**: Harness, przeglądarka i klient natywny muszą używać **dokładnie** tego adresu, który
  stoi w `AUTHORIZED_PARTIES` — `localhost`, nie `127.0.0.1`. Diagnozując 401 przy działającym
  `/api/health`, sprawdź origin **przed** sekretem i tokenem.
- **Dotyczy**: implement, impl-review, research

## Ref o czasie życia komponentu nie może współpracować z flagą z domknięcia efektu

- **Kontekst**: efekty typu „jedno żądanie na wejście" ze strażnikiem `useRef` — wzorzec użyty
  w `index.tsx` i `profile.tsx`.
- **Problem**: `fetchedForFocus` (ref) żyje przez cały czas życia komponentu, a `cancelled`
  (flaga z domknięcia) żyje przez jeden przebieg efektu. Gdy tożsamość zależności zmieni się
  w locie, cleanup poprzedniego przebiegu ustawia `cancelled = true`, nowy przebieg widzi
  `ref === true` i **nie startuje żądania**, więc odpowiedź w locie zostaje odrzucona.
  Ekran zostaje w stanie `loading` **na zawsze**. Wersja bez `cancelled` tego trybu awarii nie
  miała — dołożenie flagi „dla bezpieczeństwa" go wprowadziło.
- **Reguła**: Jeśli o „raz" decyduje ref o czasie życia komponentu, nieaktualność odpowiedzi też
  musi mieć ten czas życia — użyj **licznika przebiegów** (`const run = ++runId.current`,
  `if (run !== runId.current) return`), nie flagi `cancelled` z cleanupu. Nigdy nie mieszaj tych
  dwóch czasów życia w jednym efekcie.
- **Dotyczy**: implement, impl-review, plan-review

## Odpowiedź pobierania początkowego nie może nadpisywać tego, co użytkownik już wpisał

- **Kontekst**: każdy ekran formularza, który wypełnia pola danymi z `GET` przy wejściu —
  profil, preferencje, każdy kolejny ekran edycji.
- **Problem**: formularz renderuje się od razu, a odpowiedź `GET` stosuje się bezwarunkowo.
  Na wolnym łączu użytkownik zaczyna pisać, zanim odpowiedź dojdzie — i traci wpisane znaki.
  Drugi przebieg jest gorszy: `PUT` wraca przed zaległym `GET`, po czym stary profil nadpisuje
  świeżo zapisane wartości, a ekran pokazuje **nieaktualne liczby pod komunikatem „Zapisano"**,
  czyli kłamie o stanie bazy. W testach objawiało się losową czerwienią raz na trzy przebiegi.
- **Reguła**: Ekran wypełniany z `GET` trzyma ref `touched` ustawiany przy pierwszej zmianie
  dowolnego pola **i przy zapisie**; odpowiedź `GET` stosuje się wyłącznie, gdy formularz jest
  nietknięty. W testach nie omijaj tego wyścigu `waitForTimeout` — czekaj na odpowiedź.
- **Dotyczy**: implement, impl-review, plan
