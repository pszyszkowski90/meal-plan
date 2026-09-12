# Brief: Moduł 3, Lekcja 1 — Plan testów z AI

> **Test Plan with AI: Risk Map, Testing Guide and Quality Gates**
> Brief pisany po użyciu `/10x-test-plan` w tym repo (noc 12/13.09.2026), nie ze streszczenia.

## Co lekcja wprowadza

Zamienia „napisz testy do tego pliku" na **trwały kontrakt jakości oparty na ryzyku**.
`/10x-test-plan` wydobywa z PRD, mapy drogowej i zarchiwizowanych fragmentów 5–7 ryzyk
biznesowych, a potem mapuje każde na dwie warstwy: klasyczne typy testów (jednostkowe,
integracyjne, kontraktowe, e2e, wizualne, dymne) i formy AI-natywne (hooki po edycji,
multimodalne e2e, MCP do sterowania przeglądarką). Efektem jest `test-plan.md` — dokument, który
czyta każda kolejna sesja agenta, zanim dotknie testów.

Zasada nośna, wokół której zbudowana jest cała umiejętność: **ryzyka to scenariusze, nie
lokalizacje w kodzie**. Plan mówi *co może zawieść* i *dlaczego to prawdopodobne*; nie twierdzi,
która linia jest winna. Tę wiedzę produkuje dopiero `/10x-research`.

## Co z tego dotyczy MealPlana

Bezpośrednio — dokument powstał: [`context/foundation/test-plan.md`](../context/foundation/test-plan.md),
siedem ryzyk, tabela odpowiedzi na ryzyko, cztery fazy wdrożenia, bramki jakości.

Trzy rzeczy okazały się dla tego repo ważniejsze, niż sugeruje opis lekcji:

1. **Kolumna „Źródło" jako dyscyplina, nie biurokracja.** Zakaz kotwic `plik:linia` wymusza
   pytanie „skąd wiem, że to ryzyko jest realne". W MealPlanie najmocniejszym dowodem okazały się
   **przeglądy implementacji**, nie PRD: ustalenie F1 przeglądu fazy 1 („hasło w postaci jawnej
   i 19 artefaktów E2E w commicie") to zapis realnego sparzenia. Ryzyko #5 wzięło się wprost
   stamtąd i **ukształtowało projekt harnessu** — poświadczenia wylądowały poza repozytorium,
   więc tego błędu nie da się powtórzyć.
2. **Sekcja „Czego świadomie nie testujemy" jest warta tyle, co mapa ryzyk.** Zapisanie, że nie
   testujemy wewnętrznych mechanizmów Clerka ani warstwy natywnej, zdejmuje z kolejnych sesji
   pokusę „dorzućmy jeszcze kilka testów".
3. **Profil bazy testowej zmienia pytania.** Repo było `sparse` (jeden plik testowy), więc pytanie
   „co wydaje się niedostatecznie przetestowane" nie miało sensu — wszystko.

## Co warto zastosować i gdzie

- **Ledger świeżości działa tylko, gdy ma wyzwalacz.** W `test-plan.md` §8 wpisane jest wprost:
  mapa ryzyk odświeża się, **gdy zapadnie decyzja o źródle przepisów** — bo dopiero ona odblokuje
  ryzyka wokół generatora planu i guardraila ±10%. Data „za 3 miesiące" nikogo nie obudzi; zdarzenie
  projektowe tak.
- **Umiejętność jest orkiestratorem — i trzeba o tym wiedzieć przed uruchomieniem.** Po zapisaniu
  dokumentu chce prowadzić każdą fazę wdrożenia przez `/10x-new` → `/10x-research` → `/10x-plan`
  → `/10x-implement`, zatrzymując się na przekazaniach do człowieka. W nocnej sesji zjadłoby to
  całą noc, więc świadomie zatrzymałem ją po zapisie dokumentu (decyzja D8). **Jeśli chcesz tylko
  mapy ryzyk — powiedz to od razu.**
- **Wywiad da się zastąpić dokumentami, ale trzeba to odnotować.** Bez człowieka przy klawiaturze
  źródłem „gdzie się sparzyliśmy" były `CLAUDE.md` (sekcja Pułapki) i przeglądy implementacji.
  To mocniejszy materiał niż odpowiedź z pamięci, ale zamyka drogę obawom, których nikt nie zapisał.

## Czego lekcja NIE robi

Nie konfiguruje hooków, MCP ani CI YAML — to późniejsze lekcje modułu. Nie pisze kodu testów.
Nie czyta bazy kodu „po wiedzę" (graf wywołań, schematy) — wyłącznie po sygnał (zmienność
w historii gita, profil bazy testowej, manifest).
