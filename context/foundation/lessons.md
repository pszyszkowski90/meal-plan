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

## Odróżnij „narzędzie znalazło problem" od „narzędzie się nie uruchomiło"

- **Kontekst**: każda bramka odpalająca zewnętrzne narzędzie — hooki `pre-commit` / `pre-push`,
  skrypty weryfikacyjne, kroki CI.
- **Problem**: `spawnSync('npx.cmd', […])` na Windowsie pod Node 25 kończy się `EINVAL` — plików
  `.cmd` nie wolno uruchomić bez `shell: true` (skutek poprawki CVE-2024-27980). Kod wyjścia jest
  wtedy `null`, nie `0`, więc bramka wypisała `FAIL eslint (0.0s)` i wyglądała na taką, która
  złapała błąd, choć **nie sprawdziła niczego**. Ten sam błąd trafiający w drugą stronę — na
  `exit 0` — meldowałby zieleń tygodniami. To ta sama klasa awarii, co EBUSY przy `expo export`:
  dowód, którego nie było, wygląda jak dowód pozytywny.
- **Reguła**: Każdy krok bramki sprawdza **osobno** `result.error` (nie uruchomiło się) i
  `result.status` (uruchomiło się i znalazło problem), i wypisuje te dwa przypadki innym
  komunikatem. Nowej bramki nie uznawaj za działającą, zanim nie zobaczysz jej **czerwonej po
  celowym zepsuciu** — zielony przebieg na czystym drzewie nie dowodzi, że cokolwiek się wykonało.
  Osobno: `eslint` domyślnie kończy się zerem mimo ostrzeżeń — w bramce zawsze `--max-warnings=0`.
- **Dotyczy**: implement, impl-review, test-plan

## Kryterium, które przechodzi niezależnie od tego, czy rzecz działa, nie jest kryterium

- **Kontekst**: pisanie kryteriów sukcesu w planie fazy — zwłaszcza dla ograniczeń zakresowych
  (`BETWEEN`), granic walidacji i wszystkiego, co ma „działać dla pojęcia X".
- **Problem**: kryterium bywa sformułowane tak, że **spełnia je zarówno stan zaplanowany, jak
  i stan wdrożony, który się od niego różni** — albo tak, że da się je zaliczyć tylko przez
  założenie wiedzy, której miało dowieść. Dwa przypadki zmierzone tego samego dnia:
  - **F-01, kryterium 1.5**: plan chciał `prep_minutes` `CHECK BETWEEN 5 AND 120`, wdrożono
    `> 0`. Kryterium testowało wartość **0** — odrzucaną przez oba ograniczenia. Przeszło na
    zielono, a zaplanowanego zakresu nie ma: `prep_minutes = 999` wchodzi do bazy bez słowa.
  - **S-03, kryterium 1.7**: żądało wykluczenia „grzyby" i sprawdzenia, że odsiane zostaje
    „risotto z borowikami". Model danych tej samej zmiany wskazuje `ingredient_id`, a wiersza
    „grzyby" nie ma i nie będzie. Jedyny sposób zaliczenia to wykluczyć wprost borowiki — czyli
    **założyć wiedzę, której kryterium miało dowieść**. Test przeszedłby, dowodząc jedynie, że
    `JOIN` łączy.
- **Reguła**: Kryterium zakresu musi trafiać w **oba końce i tuż za nie** (0, 4, 5, 120, 121),
  nigdy w jedną wartość spełniającą kilka różnych ograniczeń naraz. Kryterium zdolności („da się
  wyrazić X") musi startować z **tego samego wejścia, co użytkownik**, a nie z identyfikatora,
  który ktoś już wcześniej rozwiązał za niego. Pisząc kryterium, zadaj pytanie: **czy istnieje
  świat, w którym to przechodzi, a funkcja nie działa?** Jeśli tak — kryterium jest do przepisania.
- **Dotyczy**: plan, plan-review, implement, impl-review

