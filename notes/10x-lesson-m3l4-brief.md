# Brief: Moduł 3, Lekcja 4 — Testy E2E

> **E2E Tests: Playwright, MCP, and Multimodal Scenarios**
> Brief pisany po zbudowaniu harnessu `tests/e2e/` tą umiejętnością (noc 12/13.09.2026).

## Co lekcja wprowadza

Łapie awarie, których nie widzą testy jednostkowe i hooki: dane, które nie przeżywają pełnej
ścieżki użytkownika, zepsuta nawigacja, regresje istniejące wyłącznie w wyrenderowanym UI.
Agent ogląda aplikację przez **drzewo dostępności** (migawka YAML z rolami, nazwami i stanami),
nie przez piksele — więc naturalnie pisze `getByRole`, a nie selektory CSS.

Rdzeń: **nie generuj testów E2E od zera.** Zacznij od 2–3 ryzyk przeglądarkowych z `test-plan.md`
i steruj wynikiem dwiema dźwigniami — **testem-wzorcem** (`seed.spec.ts`) i **plikiem reguł E2E**.
Prompt dostarcza tylko to, czego te dwie nie zakodują: konkretne ryzyko, przepływ, granice
prawdziwe kontra mockowane. Pętla: PLANUJ → GENERUJ → PRZEGLĄDAJ (pięć anty-wzorców) → WERYFIKUJ
(zielony, a potem **próba celowego zepsucia**).

## Co z tego dotyczy MealPlana

Powstało 20 testów w [`tests/e2e/`](../tests/e2e/). Lekcja sprawdziła się w całości, ale **cztery
rzeczy w tym repo wyszły inaczej, niż zakłada materiał**:

1. **`getByRole` nie działa na połowie aplikacji.** React Native Web renderuje pola bez `id`,
   `name`, `placeholder` i `aria-label`, a przyciski jako `div` z `tabindex` bez `role="button"`.
   Drzewo dostępności — czyli to, na czym cała lekcja stoi — pokazuje „cztery nienazwane pola
   edycji". Obejścia (`autocomplete`, `inputMode`, pozycja) zamknąłem w jednym pliku
   [`support/sign-in.ts`](../tests/e2e/support/sign-in.ts), a lukę zgłosiłem jako wadę produktu.
   **Wniosek ogólny: jakość drzewa dostępności jest warunkiem wstępnym tej lekcji, nie jej efektem.**
2. **Playwright nie mógł wejść do `package.json`.** `npm install` psuje tu lockfile na Windowsie,
   więc harness (konfiguracja + `node_modules` + poświadczenia) mieszka poza repo, a `testDir`
   celuje z powrotem w `tests/e2e/`. Cena: `NODE_PATH` przy każdym uruchomieniu i wyłączenie
   `tests/` z `tsconfig.json`. Lekcja zakłada instalację w projekcie.
3. **Próba celowego zepsucia raz „przeszła na zielono" — i to było kłamstwo.** `wrangler dev`
   trzyma otwarte `dist/client`, więc `expo export` padł na EBUSY, a testy pojechały przeciw
   **staremu** buildowi. Zepsucie nigdy nie dotarło na serwer. To najważniejsza rzecz, jakiej
   nauczyła mnie ta lekcja w praktyce: **weryfikuj, że zepsucie faktycznie jest w artefakcie**
   (u mnie `grep` po `dist/`), zanim uznasz zielony wynik za dowód czegokolwiek.
4. **Anty-wzorzec #5 (brak sprzątania) ma wersję serwerową.** Mój stan nie leżał w przeglądarce,
   tylko w D1 — profil zapisany przez jeden test wracał do formularza w następnym przebiegu.
   Sprzątanie musiało trafić do helpera ustalającego **pełny** stan wejściowy.

## Co warto zastosować i gdzie

- **Próba celowego zepsucia to jedyny sposób odróżnienia testu od dekoracji.** Zadziałała cztery
  razy: odmowa tożsamości zamieniona na 200 zapaliła 8 z 10 testów; przesunięcie wzoru o 7 kcal —
  testy celu (2759 kontra 2766); usunięcie nagłówka `Authorization` — bramkę sesji; usunięcie
  strażnika formularza — test regresji („Expected 44, Received 30"). Bez tego kroku miałbym
  20 zielonych asercji i zero wiedzy, czy któraś cokolwiek chroni.
- **Problem wyroczni jest realny i tani do uniknięcia.** Liczby 1780, 1,55, 2759, 2200 wzięły się
  z kryteriów planu, nie z uruchomienia modułu liczącego. Test przepisujący wartość z implementacji
  zatwierdziłby każdy błąd — w tym repo guardrail ±10% zależy właśnie od tych stałych.
- **`retries` maskują wyścigi.** Zestaw sypał się losowo raz na dwa-trzy przebiegi. Ponowienia
  ukryłyby to; zamiast nich znalazłem przyczynę (jedno konto testowe = wiersz w D1 jest zasobem
  współdzielonym; plus odpowiedź `GET` nadpisująca wpisane wartości). **Druga z tych przyczyn
  okazała się defektem aplikacji, nie testu** — harness zarobił na siebie w pierwszą noc.
- **CLI kontra MCP** to w tym repo wybór rozstrzygnięty przez koszt: CLI (~27K tokenów na
  scenariusz) wygrywa z MCP (~114K, 30+ narzędzi w kontekście) wszędzie tam, gdzie nie trzeba
  oglądać strony w trakcie pisania testu.

## Czego lekcja NIE robi

Nie instaluje Playwrighta i nie konfiguruje CI. Nie zastępuje debugowania: test E2E, który nie
przechodzi, to zadanie diagnostyczne, nie generacyjne. Wizja (`--caps=vision`) jest **uzupełnieniem**
dla ryzyk czysto wizualnych, nie domyślnym trybem — migawki DOM weryfikują funkcję taniej.
Granica auto-naprawy: wolno jej poprawiać dryf selektorów, nigdy „naprawiać" zmienioną logikę
biznesową, bo wtedy maskuje dokładnie tę regresję, którą test miał złapać.
