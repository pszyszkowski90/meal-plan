# Brief: Moduł 5, Lekcja 2 — pierwszy agent zespołowy z SDK

> **Lekcja świadomie nieprzerobiona na MealPlanie** — ale jej warunek wykluczenia **częściowo
> odpadł dzisiaj**, i to jest odnotowane niżej. Treść lekcji dostępna.

## Co lekcja wprowadza

Złożenie **agenta do przeglądu kodu** z SDK zamiast kupienia gotowego. Oś decyzyjna dzieli każdy
agentowy SDK na dwie kategorie:

- **gotowe agenty z całą uprzężą** — Claude Agent SDK, Codex SDK, Cursor SDK;
- **zestawy do samodzielnego złożenia**, gdzie pętlę i narzędzia podpinasz sam — Vercel AI SDK,
  OpenRouter Agent SDK.

Lekcja buduje **tego samego** minimalnego recenzenta obiema drogami — diff na wejściu,
ustrukturyzowany werdykt JSON na wyjściu, uruchamiany lokalnie przez `git diff | npx tsx review.ts`
— na wspólnym schemacie zod i wspólnym prompcie systemowym.

Oś „gotowe kontra składane" wyjaśnia potem **każdą dalszą cechę**: kto jest właścicielem pętli
narzędziowej, czy agent utrwala i wznawia sesje, czy dziedziczy konfigurację repo (`CLAUDE.md`,
skille, uprawnienia), która ścieżka uwierzytelniania rządzi prywatnością danych i uczeniem, oraz
jak wygląda kontrola kosztów (`total_cost_usd`, twarde limity budżetu).

## Dlaczego nie daje się jej przerobić na MealPlanie

Lekcja buduje **osobny artefakt**, a nie zmianę w tym produkcie. Wynikiem jest skrypt recenzenta
żyjący obok repozytorium, z własnymi zależnościami — a MealPlan ma twardą regułę, że `npm install`
psuje tu lockfile na Windowsie i dlatego nawet Playwright mieszka **poza** `package.json`.
Dołożenie SDK, zoda i `tsx` do zależności projektu złamałoby dokładnie tę regułę.

Drugi powód jest zakresowy: to repo ma MVP zablokowane na puli dań i generatorze planu. Agent
recenzujący jest narzędziem dla zespołu, który robi dużo przeglądów — tutaj przeglądy robi jedna
osoba i jest ich jedenaście w całej historii projektu.

## Co musiałoby być prawdą, żeby się nadawała

Zespół, w którym przegląd jest wąskim gardłem, **oraz** miejsce, w którym agent ma się wpiąć.
Kolejka zapisała ten warunek jako „sensowne dopiero razem z B1".

**Warunek częściowo się spełnił 13.09.2026:** B1 wykonane — [bramka jakości w GHA](../.github/workflows/quality-gate.yml)
działa na pushu i PR do `main`. Jest więc już miejsce, w które taki agent by się wpiął: krok
po `npm ci`, czytający `git diff` i oddający JSON. **Nadal tego nie robię**, bo drugi warunek —
zespół i realne wąskie gardło przeglądu — nie zaszedł, a sama możliwość wpięcia nie jest powodem.

## Co z niej zabieram mimo to

1. **Oś „gotowe kontra składane" opisuje wybór, który w tym projekcie już zapadł — po stronie
   gotowego.** Ta sesja to Claude Code: dziedziczy `CLAUDE.md`, skille i uprawnienia, utrwala
   sesję, ma własną pętlę narzędziową. Lekcja nazywa cenę tej wygody: **nie jestem właścicielem
   pętli**, więc nie mogę wpiąć własnego kroku między odczyt a decyzję.
2. **Ustrukturyzowany werdykt zamiast prozy.** Recenzent z lekcji oddaje JSON według schematu zod.
   To samo robi kontrakt `/10x-impl-review`: ustalenie ma **ID, ważność, wpływ, wymiar, lokalizację
   i decyzję** — pola, nie akapit. Dzięki temu da się je sortować i wznowić triaż; raport w prozie
   trzeba by czytać od nowa.
3. **Kontrola kosztów jako cecha projektowa, nie doraźna.** Lekcja stawia twardy limit budżetu
   obok schematu wyjścia. Przekładam to na regułę pracy: **odroczenie z nazwanym momentem**
   (jak indeks `dish_ingredient` odłożony do fazy 4) jest tańsze niż praca „przy okazji".
