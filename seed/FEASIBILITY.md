<!-- WYGENEROWANA CZĘŚĆ pochodzi z `node ./scripts/check-pool-feasibility.mjs --local`.
     Wnioski pod raportem pisze człowiek prowadzący zadanie. -->

# Wykonalność puli — pomiar pilotażowy

**Data: 14.09.2026. Pula: 20 dań (pilot, faza 3 F-01).**

To jest pomiar, dla którego istnieje faza pilotażowa: odpowiedź liczbą na pytanie, czy kierunek
się trzyma — **zanim** powstanie reszta puli i zanim ktokolwiek przejrzy kolejne 40 przepisów.

---

# Raport wykonalności puli (local)

Dań w puli: **20**.
Dzień = śniadanie + obiad + kolacja + przekąski (3/4/5/6 posiłków).
Guardrail: suma dnia w ±10% celu.

## Scenariusz: bez filtrów

Dań ocalałych: **20** z 20.

| Pora | Dań | Zakres kcal |
| --- | ---: | --- |
| breakfast | 7 | 246–503 |
| lunch | 9 | 388–641 |
| dinner | 11 | 388–641 |
| snack | 6 | 223–441 |

**Odsetek dni w ±10% celu** (w nawiasie liczba złożeń):

| Cel | 3 posiłków | 4 posiłków | 5 posiłków | 6 posiłków |
| ---: | ---: | ---: | ---: | ---: |
| 1600 kcal | 56.0% (388) | 50.9% (2115) | 5.8% (601) | 0.0% (6) |
| 2000 kcal | 0.0% (0) | 36.1% (1502) | 75.8% (7875) | 25.3% (3500) |
| 2400 kcal | 0.0% (0) | 0.2% (10) | 22.3% (2314) | 79.7% (11050) |
| 2800 kcal | 0.0% (0) | 0.0% (0) | 0.0% (3) | 12.0% (1666) |
| 3200 kcal | 0.0% (0) | 0.0% (0) | 0.0% (0) | 0.0% (0) |

## Scenariusz: limit 30 min

Dań ocalałych: **15** z 20.

| Pora | Dań | Zakres kcal |
| --- | ---: | --- |
| breakfast | 7 | 246–503 |
| lunch | 4 | 388–555 |
| dinner | 6 | 388–555 |
| snack | 6 | 223–441 |

**Odsetek dni w ±10% celu** (w nawiasie liczba złożeń):

| Cel | 3 posiłków | 4 posiłków | 5 posiłków | 6 posiłków |
| ---: | ---: | ---: | ---: | ---: |
| 1600 kcal | 32.1% (54) | 64.8% (653) | 13.1% (330) | 0.2% (6) |
| 2000 kcal | 0.0% (0) | 18.8% (190) | 76.0% (1916) | 41.2% (1383) |
| 2400 kcal | 0.0% (0) | 0.0% (0) | 9.8% (247) | 67.7% (2276) |
| 2800 kcal | 0.0% (0) | 0.0% (0) | 0.0% (0) | 3.8% (127) |
| 3200 kcal | 0.0% (0) | 0.0% (0) | 0.0% (0) | 0.0% (0) |

## Scenariusz: limit 30 min + 4 wykluczenia

Dań ocalałych: **13** z 20.

| Pora | Dań | Zakres kcal |
| --- | ---: | --- |
| breakfast | 6 | 246–503 |
| lunch | 3 | 388–555 |
| dinner | 5 | 388–555 |
| snack | 6 | 223–441 |

**Odsetek dni w ±10% celu** (w nawiasie liczba złożeń):

| Cel | 3 posiłków | 4 posiłków | 5 posiłków | 6 posiłków |
| ---: | ---: | ---: | ---: | ---: |
| 1600 kcal | 23.3% (21) | 68.0% (367) | 19.3% (261) | 0.3% (6) |
| 2000 kcal | 0.0% (0) | 12.8% (69) | 70.6% (953) | 50.3% (906) |
| 2400 kcal | 0.0% (0) | 0.0% (0) | 6.4% (87) | 58.3% (1049) |
| 2800 kcal | 0.0% (0) | 0.0% (0) | 0.0% (0) | 2.3% (41) |
| 3200 kcal | 0.0% (0) | 0.0% (0) | 0.0% (0) | 0.0% (0) |

---

## Co z tego wynika

### Wniosek główny: pula nie sięga górnej połowy celów

| Cel | Najlepszy scenariusz | Werdykt |
| ---: | --- | --- |
| 1600 kcal | 68% przy 4 posiłkach | z zapasem |
| 2000 kcal | 76% przy 5 posiłkach | z zapasem |
| 2400 kcal | 80% przy 6 posiłkach | wystarcza, ale **tylko przy sześciu posiłkach** |
| 2800 kcal | 12% przy 6 posiłkach | **na granicy** |
| 3200 kcal | 0% wszędzie | **nieosiągalne** |

Powód jest arytmetyczny, nie statystyczny. Najbardziej kaloryczny możliwy dzień z tej puli to
503 (śniadanie) + 641 (obiad) + 641 (kolacja) + trzy najcięższe przekąski (441 + 319 + 246) =
**2791 kcal**. Cel 3200 kcal nie jest „mało prawdopodobny" — jest poza zasięgiem, i żadna liczba
dodatkowych dań w tych samych gramaturach tego nie zmieni.

To nie jest hipotetyczny użytkownik: konto testowe ma wyliczony cel **2790 kcal**, czyli dokładnie
na tej granicy.

### Wniosek drugi: liczba posiłków jest parametrem, nie szczegółem

Ta sama pula daje 0% przy trzech posiłkach i 80% przy sześciu dla celu 2400 kcal. Raport policzony
na jednej, arbitralnie wybranej liczbie posiłków odpowiedziałby „nie da się" na pytanie, na które
odpowiedź brzmi „da się, ale nie przy czterech". Generator (S-04) musi traktować `mealsPerDay`
jako wejście doboru, a nie jako podział celu po równo.

### Wniosek trzeci: filtry przerzedzają OBIADY, nie przekąski

Limit 30 minut ścina obiady z 9 na 4, a kolacje z 11 na 6 — przekąski i śniadania przechodzą bez
strat. Cztery wykluczenia zabierają jeszcze jeden obiad i jedną kolację. Wąskim gardłem jest więc
**pora obiadowa przy limicie czasu**, a nie wykluczenia.

## Decyzja o fazie 4 (agent, upoważnienie właściciela 14.09.2026)

**Skalujemy do puli docelowej, ale z poprawioną kompozycją.** Minima z planu (≥ 12 śniadań,
≥ 18 obiadów, ≥ 18 kolacji, ≥ 12 przekąsek) zostają, bo raport nie pokazuje potrzeby puli
trzykrotnie większej — pokazuje potrzebę **innego rozkładu kalorii**. Do minimów dochodzą więc
trzy warunki treści:

1. **Co najmniej cztery śniadania powyżej 600 kcal** i cztery przekąski powyżej 400 kcal.
   Dziś najcięższe śniadanie ma 503 kcal, a przekąska 441 — to one wyznaczają sufit dnia.
2. **Co najmniej sześć obiadów i sześć kolacji powyżej 700 kcal**, przy czym część z nich musi
   mieścić się w 30 minutach — inaczej limit czasu dalej będzie ścinał pulę o połowę.
3. **Cel 3200 kcal zostaje nieosiągalny do czasu, aż powstaną te dania.** Zapisane świadomie:
   to nie jest usterka generatora, tylko brak treści, i tak ma brzmieć komunikat, gdy S-04 nie
   ułoży planu.

Nie eskaluję tego do właściciela: `notes/pool-queue.md` §4 rezerwuje eskalację dla sytuacji,
w której z raportu wychodzi potrzeba puli rzędu trzykrotnie większej. Tutaj liczba dań się broni,
a zmienia się rozkład gramatur — to jest parametr treści, odwracalny plikiem JSON.

---

