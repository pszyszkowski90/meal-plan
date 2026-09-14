<!-- WYGENEROWANA CZĘŚĆ pochodzi z `npm run check:pool -- --local`.
     Wnioski pod raportem pisze człowiek prowadzący zadanie. -->

# Wykonalność puli — pomiar końcowy

**Data: 14.09.2026. Pula: 58 dań (faza 4 F-01, pula docelowa).**

Poprzedni pomiar — pilotażowy, na 20 daniach — pokazał, że pula nie sięga górnej połowy celów:
3200 kcal było **nieosiągalne w każdym scenariuszu**, a 2800 wychodziło tylko przy sześciu
posiłkach i w 2–12% złożeń. Ten raport jest sprawdzeniem, czy faza 4 to naprawiła.

---

# Raport wykonalności puli (local)

Dań w puli: **58**.
Dzień = śniadanie + obiad + kolacja + przekąski (3/4/5/6 posiłków).
Guardrail: suma dnia w ±10% celu.

## Scenariusz: bez filtrów

Dań ocalałych: **58** z 58.

| Pora | Dań | Zakres kcal |
| --- | ---: | --- |
| breakfast | 20 | 246–788 |
| lunch | 29 | 388–877 |
| dinner | 33 | 388–877 |
| snack | 15 | 223–454 |

**Odsetek dni w ±10% celu** (w nawiasie liczba złożeń):

| Cel | 3 posiłków | 4 posiłków | 5 posiłków | 6 posiłków |
| ---: | ---: | ---: | ---: | ---: |
| 1600 kcal | 41.2% (7881) | 7.6% (21816) | 0.1% (2830) | 0.0% (6) |
| 2000 kcal | 40.0% (7647) | 52.7% (151348) | 16.3% (327771) | 0.8% (73650) |
| 2400 kcal | 6.2% (1186) | 40.3% (115672) | 62.0% (1245129) | 27.4% (2386586) |
| 2800 kcal | 0.0% (9) | 6.4% (18374) | 39.7% (798072) | 68.7% (5985427) |
| 3200 kcal | 0.0% (0) | 0.1% (320) | 6.4% (128156) | 38.7% (3371178) |

## Scenariusz: limit 30 min

Dań ocalałych: **41** z 58.

| Pora | Dań | Zakres kcal |
| --- | ---: | --- |
| breakfast | 20 | 246–788 |
| lunch | 12 | 388–874 |
| dinner | 16 | 388–874 |
| snack | 15 | 223–454 |

**Odsetek dni w ±10% celu** (w nawiasie liczba złożeń):

| Cel | 3 posiłków | 4 posiłków | 5 posiłków | 6 posiłków |
| ---: | ---: | ---: | ---: | ---: |
| 1600 kcal | 43.9% (1686) | 11.3% (6503) | 0.4% (1466) | 0.0% (6) |
| 2000 kcal | 34.3% (1316) | 53.6% (30897) | 21.6% (86971) | 1.6% (28220) |
| 2400 kcal | 4.8% (183) | 34.3% (19740) | 61.4% (247648) | 33.4% (583075) |
| 2800 kcal | 0.1% (4) | 5.1% (2952) | 33.8% (136336) | 66.6% (1164404) |
| 3200 kcal | 0.0% (0) | 0.1% (64) | 5.1% (20425) | 33.0% (577285) |

## Scenariusz: limit 30 min + 4 wykluczenia

Dań ocalałych: **36** z 58.

| Pora | Dań | Zakres kcal |
| --- | ---: | --- |
| breakfast | 18 | 246–788 |
| lunch | 9 | 388–874 |
| dinner | 13 | 388–874 |
| snack | 15 | 223–454 |

**Odsetek dni w ±10% celu** (w nawiasie liczba złożeń):

| Cel | 3 posiłków | 4 posiłków | 5 posiłków | 6 posiłków |
| ---: | ---: | ---: | ---: | ---: |
| 1600 kcal | 41.1% (866) | 11.8% (3738) | 0.6% (1220) | 0.0% (6) |
| 2000 kcal | 36.4% (767) | 50.5% (15957) | 21.3% (47193) | 2.0% (19587) |
| 2400 kcal | 6.2% (131) | 35.8% (11297) | 58.5% (129444) | 32.3% (309863) |
| 2800 kcal | 0.2% (4) | 6.5% (2056) | 35.8% (79118) | 64.3% (616298) |
| 3200 kcal | 0.0% (0) | 0.2% (64) | 6.4% (14073) | 35.1% (336193) |

---

## Co się zmieniło względem pilota

| Cel | Pilot (20 dań) | Pula docelowa (58 dań) | Zmiana |
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

**Obiady i kolacje w limicie 30 minut.** Filtr czasu ścina obiady z 29 do 12, a kolacje z 33 do
16 — przekąski i śniadania przechodzą bez strat. Cztery wykluczenia zabierają jeszcze dwa obiady
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

Minima per pora posiłku z planu też: **20 śniadań** (min 12), **29 obiadów** (min 18),
**33 kolacje** (min 18), **15 przekąsek** (min 12).

Dwa z 58 dań powstały **po przeglądzie**, żeby zamknąć jego ustalenie: katalog miał dwa składniki,
których nie używało żadne danie — „oliwki czarne, z puszki" (dodane pod danie, które odpadło na
sicie) i „boczniaki, świeże" (leżące tak od pierwszego seeda, przeoczone i przez przegląd).
Od tej pory pilnuje tego ostrzeżenie w `seed-dishes.mjs`.

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
na to, że szacowanie się poprawiło. Pozostałe 47 dań ma deklaracje ślepe; największy rozjazd
wśród nich to 19%, czyli tuż pod progiem.

---

