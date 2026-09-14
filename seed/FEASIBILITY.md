<!-- WYGENEROWANA CZĘŚĆ pochodzi z `npm run check:pool -- --local`.
     Wnioski pod raportem pisze człowiek prowadzący zadanie. -->

# Wykonalność puli — pomiar końcowy

**Data: 14.09.2026. Pula: 56 dań (faza 4 F-01, pula docelowa).**

Poprzedni pomiar — pilotażowy, na 20 daniach — pokazał, że pula nie sięga górnej połowy celów:
3200 kcal było **nieosiągalne w każdym scenariuszu**, a 2800 wychodziło tylko przy sześciu
posiłkach i w 2–12% złożeń. Ten raport jest sprawdzeniem, czy faza 4 to naprawiła.

---

# Raport wykonalności puli (local)

Dań w puli: **56**.
Dzień = śniadanie + obiad + kolacja + przekąski (3/4/5/6 posiłków).
Guardrail: suma dnia w ±10% celu.

## Scenariusz: bez filtrów

Dań ocalałych: **56** z 56.

| Pora | Dań | Zakres kcal |
| --- | ---: | --- |
| breakfast | 20 | 246–788 |
| lunch | 27 | 388–877 |
| dinner | 31 | 388–877 |
| snack | 15 | 223–454 |

**Odsetek dni w ±10% celu** (w nawiasie liczba złożeń):

| Cel | 3 posiłków | 4 posiłków | 5 posiłków | 6 posiłków |
| ---: | ---: | ---: | ---: | ---: |
| 1600 kcal | 41.2% (6898) | 8.4% (21028) | 0.2% (2830) | 0.0% (6) |
| 2000 kcal | 39.2% (6555) | 52.4% (131571) | 17.4% (305119) | 1.0% (72678) |
| 2400 kcal | 6.3% (1048) | 39.4% (98907) | 61.3% (1077453) | 28.5% (2169951) |
| 2800 kcal | 0.1% (9) | 6.5% (16430) | 38.9% (684345) | 67.8% (5166714) |
| 3200 kcal | 0.0% (0) | 0.1% (320) | 6.5% (113813) | 38.0% (2894096) |

## Scenariusz: limit 30 min

Dań ocalałych: **39** z 56.

| Pora | Dań | Zakres kcal |
| --- | ---: | --- |
| breakfast | 20 | 246–788 |
| lunch | 10 | 388–874 |
| dinner | 14 | 388–874 |
| snack | 15 | 223–454 |

**Odsetek dni w ±10% celu** (w nawiasie liczba złożeń):

| Cel | 3 posiłków | 4 posiłków | 5 posiłków | 6 posiłków |
| ---: | ---: | ---: | ---: | ---: |
| 1600 kcal | 43.3% (1213) | 14.1% (5905) | 0.5% (1466) | 0.0% (6) |
| 2000 kcal | 32.3% (904) | 52.4% (21998) | 24.9% (73291) | 2.2% (27414) |
| 2400 kcal | 4.8% (135) | 31.5% (13243) | 59.3% (174282) | 36.6% (466888) |
| 2800 kcal | 0.1% (4) | 5.3% (2212) | 31.4% (92435) | 63.9% (813833) |
| 3200 kcal | 0.0% (0) | 0.2% (64) | 5.1% (14946) | 30.8% (391845) |

## Scenariusz: limit 30 min + 4 wykluczenia

Dań ocalałych: **35** z 56.

| Pora | Dań | Zakres kcal |
| --- | ---: | --- |
| breakfast | 18 | 246–788 |
| lunch | 8 | 388–874 |
| dinner | 12 | 388–874 |
| snack | 15 | 223–454 |

**Odsetek dni w ±10% celu** (w nawiasie liczba złożeń):

| Cel | 3 posiłków | 4 posiłków | 5 posiłków | 6 posiłków |
| ---: | ---: | ---: | ---: | ---: |
| 1600 kcal | 40.9% (706) | 13.4% (3465) | 0.7% (1220) | 0.0% (6) |
| 2000 kcal | 35.4% (611) | 49.7% (12894) | 23.0% (41719) | 2.4% (19208) |
| 2400 kcal | 6.4% (111) | 34.3% (8890) | 57.2% (103834) | 33.9% (266315) |
| 2800 kcal | 0.2% (4) | 6.7% (1737) | 34.6% (62775) | 62.7% (492931) |
| 3200 kcal | 0.0% (0) | 0.2% (64) | 6.5% (11762) | 33.9% (266856) |

---

## Co się zmieniło względem pilota

| Cel | Pilot (20 dań) | Pula docelowa (56 dań) | Zmiana |
| ---: | ---: | ---: | --- |
| 1600 kcal | 68% (4 posiłki) | 43% (3 posiłki) | dalej z zapasem, przesunęło się na mniej posiłków |
| 2000 kcal | 76% (5) | 52% (4) | z zapasem |
| 2400 kcal | 80% (6) | 61% (5) | z zapasem, i **niżej** w liczbie posiłków |
| 2800 kcal | **12%** (6) | **68%** (6) | z granicy do zapasu |
| 3200 kcal | **0% wszędzie** | **38%** (6) | **z nieosiągalnego do osiągalnego** |

**Główny problem pilota jest rozwiązany.** Sufit dnia podniósł się z 2791 do 2919+ kcal
(najcięższe: śniadanie 788, obiad 877, kolacja 877, trzy przekąski po 454 do 377). Cel 3200 kcal
jest osiągalny przy sześciu posiłkach — także **po odfiltrowaniu wykluczeń** (34%).

Odsetki przy 1600–2400 kcal spadły i to jest **oczekiwane, nie regresja**: mianownik urósł
wielokrotnie (z 4158 do ponad dwóch milionów złożeń przy sześciu posiłkach), bo doszły dania
cięższe, które dla niskich celów są nietrafione. Liczba trafień w kategoriach bezwzględnych
wzrosła wszędzie — z 2115 do 21 028 dla 1600 kcal przy czterech posiłkach.

## Co dalej wąskie

**Obiady i kolacje w limicie 30 minut.** Filtr czasu ścina obiady z 27 do 10, a kolacje z 31 do
14 — przekąski i śniadania przechodzą bez strat. Cztery wykluczenia zabierają jeszcze dwa obiady
i dwie kolacje. To ta sama obserwacja co w pilocie i nie zniknęła: **wąskim gardłem jest pora
obiadowa przy limicie czasu**, nie wykluczenia. Dania szybkie i jednocześnie kaloryczne są
najrzadszą kombinacją w tej puli.

Nie jest to dziś blokada — przy limicie 30 minut i czterech wykluczeniach każdy z pięciu celów
ma trafienia. Jest to natomiast **pierwsza rzecz do dołożenia**, gdy pula będzie rosła dalej.

## Warunki kompozycji z decyzji fazy 3 — spełnione

| Warunek | Wymagane | Jest |
| --- | ---: | ---: |
| śniadania powyżej 600 kcal | 4 | 5 |
| przekąski powyżej 400 kcal | 4 | 5 |
| obiady powyżej 700 kcal | 6 | 9 |
| kolacje powyżej 700 kcal | 6 | 9 |

Minima per pora posiłku z planu też: **20 śniadań** (min 12), **27 obiadów** (min 18),
**31 kolacji** (min 18), **15 przekąsek** (min 12).

## Trzy dania odrzucone i dlaczego

Sito `modelKcalHint` odrzuciło trzy dania, których deklaracja rozjeżdżała się z wyliczeniem
powyżej 20%:

| Danie | Deklarowane | Wyliczone | Rozjazd |
| --- | ---: | ---: | ---: |
| sałatka grecka z kurczakiem | 700 kcal | 511 kcal | 27% |
| sałatka z tuńczykiem i awokado | 500 kcal | 367 kcal | 27% |
| kanapki z fetą i oliwkami | 600 kcal | 469 kcal | 22% |

Wszystkie trzy to dania **warzywne**, w których systematycznie przeszacowałem energię. Zgodnie
z regułą z `notes/pool-queue.md` §P4 zostały **odrzucone**, a nie poprawione gramaturą pod sito —
nawet jeśli przyczyną było złe oszacowanie autora, a nie zły przepis. Reguła jest mechaniczna
właśnie po to, żeby „to była tylko moja pomyłka w szacunku" nie stało się furtką.

## Uwaga metodologiczna do `modelKcalHint`

W pilocie deklaracje były **ślepymi oszacowaniami** — i sito złapało trzy chybione. W fazie 4
jedenaście dań powstało **porcjowanych do pasma kalorycznego**, bo tego wymagała decyzja fazy 3
(sufit dnia był za niski). Dla nich `modelKcalHint` jest **celem projektowym**, nie niezależnym
oszacowaniem, i ich zerowy rozjazd nie jest dowodem trafności szacowania.

Sito dalej robi tam użyteczną robotę — łapie danie, którego gramatura nie dowozi zamierzonego
pasma — ale to inna własność niż w pilocie. Zapisane, żeby nikt nie odczytał raportu jako dowodu
na to, że szacowanie się poprawiło. Pozostałe 45 dań ma deklaracje ślepe; największy rozjazd
wśród nich to 19%, czyli tuż pod progiem.

---

