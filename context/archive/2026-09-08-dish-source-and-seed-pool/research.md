---
date: 2026-09-08T20:23:39+02:00
researcher: Paweł Szyszkowski (z Claude Code)
git_commit: 44dce3d8ccfcd9a7e3899220b4e80325227de38e
branch: main
repository: meal-plan
topic: "Skąd biorą się przepisy i makra (Open Question 1 i 2) oraz czy generator zmieści się w 10 ms CPU (Otwarte pytanie 6 mapy drogowej)"
tags: [research, codebase, external, dish-source, macros, d1, workers-cpu, fr-008, fr-009, fr-016]
status: complete
last_updated: 2026-09-08
last_updated_by: Paweł Szyszkowski (z Claude Code)
---

# Research: Źródło przepisów i makr dla puli dań (F-01)

**Date**: 2026-09-08 20:23 (+02:00)
**Researcher**: Paweł Szyszkowski (z Claude Code)
**Git Commit**: 44dce3d8ccfcd9a7e3899220b4e80325227de38e (drzewo robocze ma niezacommitowane zmiany —
odniesienia do plików są ścieżkami w repo, nie permalinkami)
**Branch**: main
**Repository**: meal-plan

## Research Question

Które ze źródeł rozważanych w PRD (generowanie przez model AI na żądanie, własna ręcznie zseedowana
pula dań, publiczna baza składników plus własne przepisy) spełnia kontrakt treści F-01: składniki
z ilościami i kategorią sklepową, makra oraz instrukcja rozbita na kroki — i co w obecnej bazie
kodu ogranicza każdą z opcji? Dodatkowo: czy generator planu (S-04) zmieści się w 10 ms CPU planu
darmowego Workers, czy trzeba przejść na plan Paid (Otwarte pytanie 6 mapy drogowej)?

Badanie łączy dwie warstwy zgodnie z lekcją M2L4 kursu: **wewnętrzną** (co baza kodu już robi
i czego nie ma) oraz **zewnętrzną** (dokumentacja Cloudflare, licencje baz danych, badania
dokładności makr generowanych przez modele językowe). Decyzja pozostaje po stronie właściciela
produktu — ten dokument dostarcza dowody, nie zastępuje decyzji.

## Summary

1. **Baza kodu nie przesądza żadnej opcji, ale każdą ogranicza w ten sam sposób.** D1 nie ma
   ani jednej tabeli, nie ma katalogu `migrations/`, ręczne typy D1 znają tylko `first<T>()`
   (bez `bind`/`run`/`all`), nie ma warstwy repozytorium, trasy z tokenem ani klienta `fetch`.
   Faza 3 zmiany `account-and-login`, która miała to wszystko wprowadzić, nie istnieje na dysku.
   F-01 będzie więc pierwszą zmianą piszącą schemat D1 — albo poczeka na S-01.
2. **Generowanie przez model na żądanie nie daje gwarancji ±10%.** Każde kontrolowane badanie
   z lat 2025–2026 uznaje kalorie i makra podawane przez model za niewiarygodne (słaba korelacja
   z analizą Edamam; 13 z 16 składników odżywczych z błędem powyżej 10%; MAPE energii ~36%).
   Guardrail sprawdzałby liczbę, która sama jest błędna. Do tego dochodzi niedeterminizm
   (80 różnych odpowiedzi na 1000 wywołań przy temperaturze 0), ok. 2 minuty ściennego czasu na
   tydzień planu i powtarzalność dań (55–68% tych samych obiadów tydzień do tygodnia).
3. **Zewnętrzne API przepisów odpadają na warunkach licencji, nie na technice.** Spoonacular
   zakazuje przechowywania składników, instrukcji i wartości odżywczych (tylko id/tytuł/obraz;
   cache ≤ 1 h) i ma treści wyłącznie po angielsku i niemiecku. Edamam ogranicza cache do id
   i nazwy oraz dopuszcza wyłącznie zapytania inicjowane przez człowieka. TheMealDB i Tasty nie
   mają makr, a instrukcję dają jednym blokiem tekstu — nie spełniają FR-016. Wymaganie offline
   (plan i lista dostępne bez sieci) jest z tymi warunkami niepogodzalne.
4. **Najsilniej poparta dowodami jest opcja hybrydowa:** model językowy autoryzuje przepisy
   **raz**, poza runtime (polskie nazwy, gramatury, kroki, czas przygotowania), człowiek je
   przegląda, a makra liczy skrypt deterministycznie z tabeli składników **USDA FoodData Central**
   (domena publiczna CC0, bez obowiązku share-alike). Cztery niezależne opisy tego wzorca
   (arXiv 2607.23273, Blinsinger, Forky, Tavichka) zbiegają się w tej samej architekturze
   i w tym samym ostrzeżeniu: przegląd ilości przez człowieka jest obowiązkowy. Koszt jednorazowy
   rzędu 0,50 USD; nakład 10–15 h zamiast 25–60 h ręcznego pisania 40–80 przepisów.
5. **Otwarte pytanie 6: plan Paid nie jest potrzebny, jeśli wyszukiwanie jest przycinane.**
   Oczekiwanie na `fetch`/D1 nie liczy się do CPU (dokumentacja Cloudflare), a zachłanne albo
   losowe przeszukiwanie kilku tysięcy kombinacji nad ~60 daniami mieści się poniżej 1 ms w V8.
   Naiwna pełna enumeracja (C(60,4) × 7 dni ≈ 3,4 mln sprawdzeń) mogłaby przebić 10 ms — to
   decyzja projektowa w S-04, nie w F-01. Pomiar CPU najgorszego przypadku, którego wymaga rejestr
   ryzyka, nadal nie istnieje.

## Detailed Findings

### 1. Stan bazy kodu: czego F-01 nie odziedziczy

- **D1 jest pusta po obu stronach.** Brak `migrations/`, brak jakiegokolwiek `.sql` w repo;
  lokalny stan miniflare zawiera tylko `_cf_METADATA`, bez tabeli `d1_migrations`. Binding
  `DB` → baza `mealplan` ([wrangler.jsonc:40-46](../../../wrangler.jsonc#L40-L46)), `migrations_dir`
  i `migrations_pattern` nieustawione (domyślne).
- **Typy D1 są celowo minimalne.** `D1PreparedStatement` ma wyłącznie `first<T>()`
  ([env.ts:16-18](../../../src/server/env.ts#L16-L18)); `D1Database` tylko `prepare`
  ([env.ts:20-22](../../../src/server/env.ts#L20-L22)). Każdy `INSERT` z parametrami (seed puli,
  zapis profilu) nie przejdzie `npx tsc --noEmit`, dopóki interfejs nie zyska `bind`/`run`/`all`.
  `@cloudflare/workers-types` jest wykluczone decyzją z planu S-01
  ([plan.md:468-470](../account-and-login/plan.md#L468-L470)) — drugi zestaw globalnych typów obok
  React Native.
- **Jedyna trasa API to smoke test.** [health+api.ts:8-11](../../../src/app/api/health+api.ts#L8-L11)
  robi `select 1` bez autoryzacji, bez ciała żądania, bez 4xx. Nie ma wzorca czytania ciała,
  walidacji wejścia ani zapisu do D1.
- **Warstwa repozytorium, `requireUserId`, `authedFetch`, `@clerk/backend` — nie istnieją.**
  Faza 1 planu `account-and-login` (ekrany, `ClerkProvider`, bramka `(app)/_layout.tsx`) jest
  napisana, ale niezacommitowana; fazy 2 i 3 nie mają ani jednego pliku na dysku
  ([plan.md:806-825](../account-and-login/plan.md#L806-L825), wszystkie kroki 3.x otwarte).
- **Brak bibliotek, na których dałoby się oparć:** żadnego SDK AI (`ai`, `openai`,
  `@anthropic-ai/sdk`), żadnego ORM/query buildera, `zod` wyłącznie tranzytywnie, brak
  `expo-sqlite` i AsyncStorage (offline nie ma fundamentu), brak runnera testów
  ([package.json:5-41](../../../package.json#L5-L41)). Każda nowa zależność podlega
  `npm run check-lock` i limitowi rozmiaru skryptu.
- **Limit rozmiaru skryptu wyklucza bundlowanie puli w Workerze.** Reguły
  [wrangler.jsonc:24-33](../../../wrangler.jsonc#L24-L33) istnieją po to, żeby domyślne reguły
  `**/*.bin` / `**/*.wasm` nie zamiatały 8,9 MB z `node_modules`. Dane puli w bundlu konkurowałyby
  o ten sam budżet; `find_additional_modules` widzi tylko `dist/server/**`. Seed powinien iść przez
  `wrangler d1 execute` / migracje, nie przez bundel.
- **Brak ścieżki pracy w tle.** Żadnego `ctx.waitUntil`, `scheduled`/cron ani streamingu
  ([worker.ts:7-13](../../../worker.ts#L7-L13)); `setWorkerEnv(env)` pisze do `globalThis` przy
  każdym żądaniu — kanał dla bindingów i sekretów, nie dla stanu per żądanie.
- **Sekret do modelu (gdyby był potrzebny)** ma już ustaloną drogę: wyłącznie `wrangler secret put`,
  nigdy `EXPO_PUBLIC_*`, `.dev.vars` w `.gitignore`
  ([infrastructure.md:288](../../foundation/infrastructure.md#L288)); odczyt przez `getWorkerEnv()`
  ([CLAUDE.md:62-64](../../../CLAUDE.md#L62-L64)).

### 2. Ograniczenia platformy (dokumentacja Cloudflare, stan na lipiec–sierpień 2026)

- **Workers Free:** 100 000 żądań/dzień, **10 ms CPU** na wywołanie, 50 subrequestów, 6 równoległych
  połączeń wychodzących. Cytat: „Waiting on network requests (such as `fetch()` calls, KV reads,
  or database queries) does not count toward CPU time." Przeciętny Worker zużywa ok. 2,2 ms;
  cięższe (auth, SSR, duże payloady) 10–20 ms. Czas trwania żądania HTTP: bez limitu, dopóki klient
  jest połączony. <https://developers.cloudflare.com/workers/platform/limits/>
- Wpis o cenniku (2023-09-28) używa wprost przypadku LLM: żądanie trwające 2000 ms z powodu
  inferencji kosztuje tyle samo, bo płaci się za CPU.
  <https://blog.cloudflare.com/workers-pricing-scale-to-zero/>
- **D1 Free:** 5 mln odczytanych wierszy/dzień, 100 000 zapisanych/dzień, 500 MB/baza, 50 zapytań
  na wywołanie Workera. „Query execution and result serialization run within the Workers platform
  CPU and memory limits" — pełny skan liczy każdy wiersz.
  <https://developers.cloudflare.com/d1/platform/limits/>,
  <https://developers.cloudflare.com/d1/platform/pricing/>

### 3. Opcja A — generowanie przez model na żądanie

**Dowody**

- Workers AI (cennik z 2026-08-07): 0,011 USD / 1 000 neuronów, **10 000 neuronów dziennie za
  darmo**; `llama-3.3-70b-instruct-fp8-fast` ≈ 0,29 / 2,25 USD za mln tokenów (wej./wyj.),
  `llama-3.1-8b-instruct-fp8-fast` ≈ 0,045 / 0,38 USD.
  <https://developers.cloudflare.com/workers-ai/platform/pricing/>
- Workers AI JSON Mode (2026-04-21): `response_format` z `json_schema`, ale „Workers AI can't
  guarantee that the model responds according to the requested JSON Schema… an error `JSON Mode
  couldn't be met` is returned and must be handled"; bez streamingu.
  <https://developers.cloudflare.com/workers-ai/features/json-mode/>
- Anthropic structured outputs: `output_config.format` z `json_schema`, gwarancja zgodności ze
  schematem przez constrained decoding (Haiku 4.5, Sonnet 4.6/5, Opus 4.x).
  <https://platform.claude.com/docs/en/build-with-claude/structured-outputs>. Cennik: Haiku 4.5
  1 / 5 USD za mln tokenów, Sonnet 5 2 / 10 USD. <https://platform.claude.com/docs/en/about-claude/pricing>
- Przepustowość Haiku 4.5: ~85–95 tokenów/s. <https://artificialanalysis.ai/models/claude-4-5-haiku>
- **Dokładność makr podawanych przez modele:**
  - „Using AI as a Chef" (ACM, 2026-06-01): przepisy z czterech LLM-ów porównane z analizą Edamam
    — „the estimated nutritional values of LLM-generated recipes were unreliable and correlated
    only weakly with validated data", a użytkownicy i tak im ufali.
    <https://doi.org/10.1145/3774935.3806157>
  - PMC 2025-02-07 (ChatGPT-4, 114 posiłków): energia w agregacie 0,1% błędu, ale „poor agreement
    for 10 of the 16 nutrients… >10% for 13 nutrients".
    <https://pmc.ncbi.nlm.nih.gov/articles/PMC11858203/>
  - PMC 2025-09-10 (GPT-4o / Claude 3.5 / Gemini 1.5, zdjęcia): MAPE energii 35,8% (GPT/Claude),
    64–110% (Gemini); systematyczne niedoszacowanie rosnące z porcją.
    <https://pmc.ncbi.nlm.nih.gov/articles/PMC12513282/>
  - Nutrients 2025-11-19 (ChatGPT-5, 195 dań): dokładność wyraźnie rośnie, gdy model **dostaje**
    listę składników z ilościami — jest lepszy w arytmetyce nad podanymi liczbami niż w zgadywaniu.
    <https://www.mdpi.com/2072-6643/17/22/3613>
  - NutriBench (arXiv 2407.12843): GPT-4o 66,8% w granicy 7,5 g węglowodanów na opisach tekstowych
    — porównywalnie z dietetykami, nie lepiej niż tabela. <https://arxiv.org/pdf/2407.12843>
- **Niedeterminizm:** Thinking Machines (09.2025) — 1 000 wywołań przy temperaturze 0 dało 80
  różnych odpowiedzi, bo rozmiar batcha na serwerze zmienia wyniki; potwierdzone na NeurIPS 2025.
  <https://proceedings.neurips.cc/paper_files/paper/2025/file/f80094a824ba5912d4a2de169c404a40-Paper-Conference.pdf>
- **Polszczyzna:** benchmarki 2026 (Promptowy, Oxido/Jeleśniański) stawiają modele komercyjne
  wysoko, a modele otwarte klasy Llama 8B (czyli tani tier Workers AI) daleko z tyłu; PLCC
  (arXiv 2503.00995): Llama-3.1-8b 22,7%. <https://arxiv.org/html/2503.00995>
- **Powtarzalność:** Recipy (2026-07-10, źródło vendorowe) — każdy testowany planer AI powtarzał
  55–68% obiadów tydzień do tygodnia. <https://recipyapp.com/blog/ai-meal-plan-repeat-same-dinners-2026>

**Dopasowanie do czterech twardych ograniczeń:** ±10% kcal — **brak gwarancji** (sama liczba kcal
jest niewiarygodna, potrzebna byłaby niezależna tabela makr, czyli i tak opcja C); wykluczenia —
tylko przez walidację po fakcie i retry; czas przygotowania — deklaracja modelu, nieweryfikowalna;
kroki — **tak**, structured output daje `steps[]` i gramatury o dobrym *kształcie*, nie o dobrej
*wartości*.

**Dopasowanie do Workers/D1:** CPU w porządku (I/O); ścienny czas problematyczny — tydzień to
≈ 28 przepisów × ~350 tokenów ≈ 10 000 tokenów ≈ **~2 minuty** w jednym wywołaniu; limit 6
równoległych połączeń ogranicza zrównoleglenie. Darmowe 10 000 neuronów/dzień ≈ 4–5 tygodniowych
planów dziennie na modelu 70B.

**Koszt:** 0,01–0,10 USD za plan tygodniowy. **Nakład:** najmniej kodu, ale pętla
walidacja-retry i reguła „nie da się → błąd, bez planu częściowego" są trudne do uczciwego
zrealizowania na źródle stochastycznym.

### 4. Opcja B — własna ręcznie zseedowana pula w D1

**Dowody**

- Wielkość rotacji (blogi konsumenckie, zbieżne): 12–16 obiadów na 3–4 tygodnie; 15–20 przepisów
  „w nieskończoność"; 20–28 na cykl 4-tygodniowy bez powtórki.
  <https://thetavola.ai/blog/weekly-dinner-rotation/>
- Kurczenie pod ograniczeniami: Recipy — przy filtrze „≤ 30 min, bez owoców morza, cel białkowy"
  przeżyło ~25 z ich ocenionych dań; „The remaining gap is corpus size, not algorithm."
- Wzrost liczby składników jest podliniowy: dopasowanie prawa Heapsa na 233 przepisach
  (arXiv 2607.23273, 2026-07-25) — ~60 przepisów to ok. 100–120 różnych składników do
  zaopatrzenia w makra. <https://arxiv.org/html/2607.23273v1>
- Nakład autorski: zawodowiec pisze 8–12 przepisów dziennie bez testowania, 4–6 z testowaniem;
  samo napisanie to 30–45 min, testowanie ×3 dominuje.
  <https://countertalk.co.uk/career-advice/im-a-recipe-developer-heres-what-you-should-know>

**Dopasowanie:** wszystkie cztery ograniczenia **deterministyczne i sprawdzalne** — makra
z gramatury × tabela na 100 g, wykluczenia jako join po id składnika, czas jako kolumna, kroki
jako wiersze. Naturalnie realizuje „wyczerpano przestrzeń → błąd, bez planu częściowego".
**Workers/D1:** 60 dań × ~8 składników ≈ 500 wierszy; odczyt całej puli na plan to kilkaset
wierszy wobec 5 mln/dzień. **Koszt runtime:** 0. **Nakład:** 40–80 przepisów z ważonymi
składnikami i mapowaniem do tabeli ≈ **25–60 h** solo bez gotowania — 1–2 z 4 tygodni budżetu.
**Ryzyko:** za mała pula pod wykluczeniami, zmęczenie autorskie.

### 5. Opcja C — publiczne bazy składników (warstwa makr pod pulę)

- **USDA FoodData Central:** domena publiczna **CC0 1.0** („No permission is needed", prośba
  o atrybucję); 1 000 żądań/h na IP. Pobrania (kwiecień 2026): Foundation Foods CSV 3,7 MB zip,
  **SR Legacy CSV 6,7 MB zip** (najszerszy zestaw produktów generycznych, ostatnia aktualizacja
  2018). <https://fdc.nal.usda.gov/api-guide>, <https://fdc.nal.usda.gov/download-datasets>
- **Open Food Facts:** baza na **ODbL** (atrybucja, **share-alike każdej pochodnej bazy**), treści
  na DbCL; regulamin wyklucza odpowiedzialność za dokładność. To dane produktów **z kodem
  kreskowym** — opiekunowie odsyłają po surowe produkty do USDA; propozycja importu generyków
  (issue #5259) otwarta od 2021. <https://world.openfoodfacts.org/terms-of-use>,
  <https://forum.openfoodfacts.org/t/is-the-raw-food-allowed/185>
- **Polskie tabele (NIZP PZH-PIB, wyd. IV 2017):** 1 045 produktów **i potraw**, na 100 g części
  jadalnych z % odpadków — ale „udostępniana jest na podstawie umowy licencyjnej w formacie pliku
  .XLSX", formularz rozróżnia licencję niekomercyjną i komercyjną, cena niepublikowana. **Nie ma
  otwartej, maszynowej wersji.** <https://www.pzh.gov.pl/uslugi/tabele-wartosci-odzywczej-produktow/baza-danych-wersja-pelna/>
- **OpenNutrition** (2026-06-04): darmowy TSV na ODbL, 5 287 produktów generycznych + 3 836 potraw
  zmiksowanych z USDA/AUSNUT/FRIDA/CNF z uzupełnieniami AI; makra opisane jako wiarygodne,
  mikroelementy jako szacunki. <https://runany.dev/blog/open-nutrition-database/>

**Najlepiej pasuje USDA SR Legacy / Foundation (CC0)**, ręcznie skurowane do ~100–150 wierszy
z polskimi nazwami (kasza gryczana → „Buckwheat groats, roasted, dry", twaróg → „Cheese, cottage…"),
w gramach. Bez obowiązków licencyjnych na naszej D1. OFF ma zły kształt (produkty markowe) i wnosi
share-alike na bazę pochodną. Tabele PZH pasują kulturowo najlepiej (polskie potrawy, % odpadków),
ale to płatna, zamknięta licencja — warte maila, nie zależności.

### 6. Opcja D — zewnętrzne API przepisów

| API | Kroki | Makra | Polski | Przechowywanie | Wynik |
|-----|-------|-------|--------|----------------|-------|
| Spoonacular (Free 50 pkt/dzień; Cook 29 USD/mc) | tak, `analyzedInstructions[].steps[]` | tak, per porcja | **nie** (en/de) | **zakaz** poza id/tytuł/obraz; cache ≤ 1 h za pisemną zgodą | odpada: offline + polski |
| Edamam (od 9 USD/mc) | tylko ~20 tys. przepisów własnych | tak | niezweryfikowany | cache tylko id + nazwa; „only human, end user driven requests" | odpada: offline, brak kroków w większości |
| TheMealDB (10 USD jednorazowo) | **nie** — `strInstructions` jednym blokiem | **brak** | nie | — | odpada: FR-009, FR-016 |
| Tasty (RapidAPI) | tak | **brak** ustrukturyzowanych | nie | wrapper strony trzeciej | odpada: FR-009 |

Źródła: <https://spoonacular.com/food-api/terms>, <https://www.edamam.com/terms/api/>,
<https://www.themealdb.com/>, <https://foodashi.com/blog/recipe-api-comparison-2026/>.

### 7. Opcja E — hybryda: model autoryzuje raz, baza serwuje w runtime

- arXiv 2607.23273 (2026-07-25) opisuje dokładnie ten podział: „the LLM only to construct
  ingredient records… consumed by deterministic computational nutrition models. The generative
  cost is therefore incurred once, at collection time"; pojedyncze przebiegi „unreliable and can
  introduce silent errors"; wielokrotne próbkowanie z testami niezmienników zbiło MAPE stosunków
  odżywczych z 31,9% do 10,1%; modele proszone o samonaprawę „reach for a numerically consistent
  arrangement over an accurate one".
- Blinsinger (2026-02-22, 60 tys. linii składników): agent zwraca **tylko** tożsamość produktu
  i gramy — „the nutrient data comes from the database rather than an LLM that might hallucinate
  `0 calories` for olive oil"; 85% linii nie trafia do modelu.
  <https://rob-blinsinger-blog.pages.dev/posts/2026-02-22-parsing-recipe-ingredients>
- Forky AI: „let the model do the lookup, let our code do the arithmetic"; nierozwiązane
  „garść" → drugi przebieg ze słownikiem gramatur. <https://forkyai.com/blog/forky-recipe-import-pipeline/>
- Tavichka (GitHub, 2026-04-28, kuchnia bułgarska): „It does not use an LLM at runtime to
  hallucinate calories"; USDA + lokalne nadpisania tam, gdzie USDA jest „kulturowo błędne";
  audyty anomalii. <https://github.com/damyan-deshev/tavichka>

**Dopasowanie:** właściwości runtime identyczne z opcją B (deterministyczne, wszystkie cztery
ograniczenia w SQL/JS, uczciwa ścieżka błędu). **Seed:** lokalny skrypt Node + `wrangler d1
execute` (limit importu 5 GB; 100 000 zapisów/dzień wystarcza na ~1 000 wierszy). **Koszt
jednorazowy:** 60 przepisów × ~600 tokenów ≈ 40 000 tokenów ≈ 0,20 USD (Haiku 4.5) lub 0,40 USD
(Sonnet 5) — model komercyjny, nie 8B z Workers AI, ze względu na polszczyznę. **Nakład:** kilka
godzin promptowania + **obowiązkowy przegląd**: wiarygodność ilości, mapowanie każdego składnika
do wiersza USDA, gęstość kcal na porcję, ugotowanie próby. Razem ~10–15 h. **Ryzyko:** halucynowane
ilości i nierealne czasy przechodzą bez przeglądu; kulturowo błędne dopasowania USDA (tabela
nadpisań jak w Tavichce); „polskie" dania, których nikt nie je.

### 8. Otwarte pytanie 6 — czy generator zmieści się w 10 ms CPU

- Dokumentacja Cloudflare: czekanie na `fetch`/D1 **nie liczy się** do CPU. Opcja A jest więc
  bezpieczna dla CPU, a niebezpieczna dla czasu ściennego.
- Dla opcji B/E: filtrowanie ~60 dań na slot i łączenie 3–5 slotów w okno kcal. V8 wykonuje prostą
  iterację pętli w ~1–20 ns (<https://github.com/kgryte/v8-perf>), więc **zachłanne lub losowe
  przeszukiwanie kilku tysięcy kandydatów mieści się grubo poniżej 1 ms**. Tylko naiwna pełna
  enumeracja (C(60,4) ≈ 488 tys. kombinacji × 7 dni ≈ 3,4 mln sprawdzeń ≈ dziesiątki–setki ms)
  zagraża limitowi — to wybór algorytmu w S-04, nie własność źródła danych.
- Zapytania D1 też wchodzą w budżet CPU (serializacja wyników) — pulę należy czytać raz na plan,
  nie per slot; 50 zapytań na wywołanie to twardy sufit planu darmowego.
- **Nadal brak pomiaru.** Rejestr ryzyka ([infrastructure.md:278](../../foundation/infrastructure.md#L278))
  żąda zmierzenia najgorszego przypadku (maks. wykluczeń, 5 posiłków) przed uznaniem generatora za
  gotowy; `/api/health` nic o tym nie mówi ([deploy-plan.md:292-294](../../deployment/deploy-plan.md#L292-L294)).

### 9. Tabela porównawcza

| | A. Model na żądanie | B. Ręczna pula | C. Baza składników (USDA) | D. API przepisów | E. Hybryda |
|---|---|---|---|---|---|
| ±10% kcal egzekwowalne | nie (kcal niewiarygodne) | tak | n/d (warstwa składników) | częściowo, nie da się przechować | tak |
| Wykluczenia | walidacja po fakcie + retry | tak (join) | n/d | tak (tagi) | tak |
| Czas przygotowania | niezweryfikowany | tak | n/d | `readyInMinutes` | tak (po przeglądzie) |
| Kroki (FR-016) | tak (schemat) | tak | n/d | Spoonacular tak; inne nie | tak |
| Offline po wygenerowaniu | tak | tak | tak | **nie** (cache 1 h) | tak |
| Polski | modele komercyjne dobre; 8B słabe | tak | nazwy do zmapowania | en/de | tak |
| CPU na planie Free | OK (I/O) | OK przy przycinaniu | OK | OK | OK |
| Czas ścienny | ~2 min / tydzień | ms | — | s | ms |
| Koszt | 0,01–0,10 USD / plan | 0 | 0 (CC0) | 0–29 USD/mc | ~0,50 USD raz |
| Nakład solo (4 tyg.) | mało kodu, trudna walidacja | 25–60 h pisania | 5–10 h kuracji | mało, blokada licencyjna | ~10–15 h |
| Deterministyczne / testowalne | nie | tak | tak | w większości | tak |

## Code References

- `src/server/env.ts:16-22` — ręczne typy D1 (`first<T>()` tylko); do rozszerzenia o `bind`/`run`/`all`
- `src/server/env.ts:28-36` — `setWorkerEnv` / `getWorkerEnv`, jedyny kanał bindingów i sekretów
- `src/app/api/health+api.ts:8-11` — jedyna trasa API, wzorzec `Response.json`, bez auth i bez zapisu
- `worker.ts:5-13` — handler adaptera; brak `waitUntil`, cron, streamingu
- `wrangler.jsonc:24-33` — reguły modułów chroniące limit rozmiaru skryptu (argument przeciw bundlowaniu puli)
- `wrangler.jsonc:40-46` — binding D1 `DB` → `mealplan`; brak `migrations_dir`/`migrations_pattern`
- `package.json:5-41` — brak SDK AI, ORM, `zod` (tylko tranzytywnie), `expo-sqlite`, runnera testów
- `context/changes/account-and-login/plan.md:494-527` — konwencja migracji (`migrations/`, `down/`,
  wyłącznie addytywne, `0001`) i kontrakt repozytorium z `userId` w pierwszym argumencie, które F-01
  powinno przyjąć dla tabel dań (tabele referencyjne bez `userId`, tabele użytkownika z `userId`)

## Architecture Insights

- **Kształt danych F-01 jest jednocześnie kontraktem dla S-03, S-05 i S-07.** Wykluczenia
  składnikowe („nie jem grzybów") wymagają znormalizowanych identyfikatorów składników; agregacja
  listy zakupów wymaga jednostek, które da się dodać („2 łyżki" + „30 g" nie zsumują się —
  [roadmap.md:274-277](../../foundation/roadmap.md#L274-L277)); kategorie sklepowe są w PRD tylko
  przykładowe („warzywa, mięso, nabiał i dalsze"). Żaden dokument nie definiuje kanonicznego
  słownika składników, jednostek ani kategorii — to F-01 musi go wprowadzić, a opcje B/E robią to
  naturalnie (składnik = wiersz z id, gramatura w gramach, kategoria jako enum).
- **„Dwa poziomy wykluczeń, jedna lista"** — PRD wymaga jawnego rozdzielenia poziomu
  składnikowego i daniowego (FR-004) oraz jednej listy zasilanej z dwóch miejsc (FR-011). Dokumenty
  nigdzie nie zapisują, jak to pogodzić; naturalna interpretacja to jedna tabela wykluczeń
  z kolumną typu (`ingredient_id` **albo** `dish_id`), a generator sprawdza obie relacje.
  To najbardziej prawdopodobne miejsce błędu schematu między F-01 a S-03.
- **Seed jest operacją poza runtime.** Skrypt Node → plik SQL/CSV → `wrangler d1 execute` (lub
  migracja z danymi). Nie przez bundel Workera (rozmiar skryptu), nie przez trasę API (100 000
  zapisów/dzień i 10 ms CPU), nie przez CI (migracje są krokiem ręcznym wg planu S-01).
- **Runtime generatora bez sieci zewnętrznej** (opcje B/E) oznacza, że guardrail ±10% jest
  własnością arytmetyki nad naszymi danymi — sprawdzalną lokalnie w `wrangler dev`, mimo braku
  runnera testów. Opcja A przenosi tę własność na dostawcę i czyni ją niesprawdzalną offline.
- **`has_ai: false` w `tech-stack.md`** jest świadome i pozostaje prawdziwe przy opcjach B/C/E
  (model użyty raz w skrypcie deweloperskim nie jest częścią runtime). Opcja A wymagałaby
  aktualizacji tech-stacku i drugiego dostawcy obok Cloudflare.

## Historical Context (from prior changes)

- `context/foundation/prd.md:219-225` — Open Questions 1 i 2; blokują FR-008 i guardrail ±10%.
- `context/foundation/roadmap.md:117-141` — F-01: kontrakt treści, „pula wystarczająca na tydzień
  i ani trochę większa", ryzyko trzech zupełnie różnych planów implementacyjnych.
- `context/foundation/roadmap.md:327-345` — Otwarte pytania mapy drogowej 1–6. **Uwaga na numerację:**
  PRD ma 5 pytań, mapa drogowa 6; PRD OQ4 (rozdzielenie wykluczeń) = roadmap OQ3, a roadmap OQ6
  (Workers Paid) nie ma odpowiednika w PRD. Cytując, zawsze podawaj dokument.
- `context/foundation/infrastructure.md:184-188, 223-226, 278-289` — limity planu darmowego jako
  „urwiska", zamknięta furtka do TCP Postgresa, rejestr ryzyka (CPU generatora, sekret AI, zapisy D1).
- `context/foundation/infrastructure.md:203` — pre-mortem: „Nigdy nie rozstrzygnąłeś Open Question 1;
  cała robota poszła w hydraulikę pod przepisy, których nie było."
- `context/foundation/tech-stack.md:18, 35-37` — `has_ai: false` świadomie, bo generowanie przez model
  jest opcją, nie zakresem.
- `context/changes/account-and-login/change.md:49-50` — plan Workers Paid przestał być wymaganiem
  auth i wraca wyłącznie przy generatorze.
- `context/changes/account-and-login/plan.md:431-590` — faza 3 (schemat, migracje, repozytorium,
  `requireUserId`, `authedFetch`) — kontrakt istnieje wyłącznie w prozie.
- `notes/idea.md:15-17` — pierwotne sformułowanie: „Nie wiem, czy są może jakieś zeskrapowane bazy…
  z instrukcjami przyrządzenia, z makrosami".

## Related Research

- `context/changes/profile-and-calorie-target/research.md` — cel kaloryczny jako wejście
  ograniczenia ±10% oraz podział celu na posiłki (wg NCEŻ), którego generator potrzebuje jako
  budżetów per slot.
- `context/foundation/infrastructure.md` — badanie platformy (2026-08-28) z rejestrem ryzyka,
  z którego pochodzi Otwarte pytanie 6.

## Open Questions

Do rozstrzygnięcia przez właściciela produktu (badanie ich nie zamyka):

1. **Wybór źródła.** Dowody wskazują na hybrydę (E) z USDA (C) pod spodem; alternatywą o tych
   samych własnościach runtime jest ręczna pula (B) za cenę 25–60 h. Opcja A wymagałaby świadomej
   rezygnacji z gwarancji ±10% albo i tak dołożenia tabeli makr; opcja D odpada na licencjach.
2. **Wielkość puli pod realnymi wykluczeniami.** Jedyny punkt odniesienia (~25 dań przeżywa
   ciasny filtr) pochodzi od jednego vendora. Ile dań na slot (śniadanie / obiad / kolacja /
   przekąska) uznajemy za minimum, żeby tydzień nie powtarzał obiadów?
3. **Czy pytać PZH o licencję na tabele** (polskie potrawy z % odpadków), czy zostać przy USDA
   z ręcznym mapowaniem polskich nazw? Cena i warunki dla aplikacji hobbystycznej nie są
   publikowane.
4. **Model dwóch poziomów wykluczeń w jednej liście** — do zapisania w planie F-01 razem
   z identyfikatorami składników, bo S-03 dziedziczy ten schemat.
5. **Kanoniczny słownik jednostek i kategorii sklepowych** — gram jako jedyna jednostka
   przechowywana (z ewentualną jednostką prezentacji), enum kategorii do ustalenia.
6. **Kolejność wobec S-01.** F-01 nie zależy od `userId` (tabele referencyjne), ale dzieli
   z S-01 konwencję migracji i rozszerzenie typów D1. Kto pisze `migrations/0001`?
7. **Eksperyment potwierdzający (~1 wieczór):** 20 polskich przepisów ze structured output
   (gramy, kroki, minuty) → mapowanie do USDA SR Legacy skryptem → porównanie kcal podanych
   przez model z kcal wyliczonymi (oczekiwana rozbieżność > 10% na istotnej części — dowód, że
   źródłem prawdy ma być tabela) → zachłanny budowniczy dnia nad 20 daniami w `wrangler dev`
   z odczytem CPU z Workers Logs. Zamyka jednocześnie OQ1, OQ2 i roadmap OQ6.

Czego dowody **nie** rozstrzygają: dokładności modeli dla polskich dań domowych (wszystkie
badania na posiłkach US/UK/TR/SE); realnego kosztu CPU naszego wyszukiwania (mikrobenchmarki V8
i średnia Cloudflare, nie pomiar MealPlan); czy Edamam ma polski; limitów rozmiaru schematu
w structured outputs dla 28 przepisów w jednym wywołaniu.
