# Brief: Moduł 5, Lekcja 5 — Agenci asynchroniczni i zdalni

> **Innovate: Async & Remote Agents — deleguj i zajmij się czymś innym**
> Brief pisany po przeprowadzeniu fazy 3 przez `/10x-goal-implement` bez nadzoru
> (noc 12/13.09.2026).

## Co lekcja wprowadza

Model **momentu kontroli**: sterowanie zdalne w czasie rzeczywistym, odpalenie-i-monitorowanie,
oraz rutyny harmonogramowane. Trzy archetypy wykonania zdalnego (SSH/tmux, Happy, zarządzany
sandbox w chmurze) jako wybór zależny od zadania, przenośny model konfiguracji sandboxa
(setup/sieć/MCP/cache/sekrety) i teza „izolacja jest warunkiem autonomii".

Konkretnym narzędziem jest **`/10x-goal-implement`** — bezobsługowy odpowiednik `/10x-implement`.
Prowadzi zatwierdzony `plan.md` pod `/goal`, deleguje kod fazy do subagenta, przepuszcza każdą
fazę przez stos bramek, **commituje wyłącznie na zielono**, a wiersze ręczne zostawia jako listę
kontrolną dla człowieka.

## Co z tego dotyczy MealPlana

Faza 3 (ekran profilu, karta celu, zakładki na dwóch platformach) przeszła tą umiejętnością
w całości — commit `42b6917`, sześć kryteriów automatycznych zielonych.

Cztery obserwacje z realnego przebiegu:

1. **Rozdział „implementacja delegowana / bramki w kontekście głównym" jest sednem, nie detalem.**
   Subagent przeczytał plan i napisał cztery pliki, zużywając ~158K tokenów **w swoim** kontekście.
   Główna transkrypcja dostała z tego pięć linii: `STATUS`, `TOUCHED`, `ADAPTATIONS`,
   `STRUCTURAL`, `UNCERTAINTIES`. Bez tego podziału nocna sesja z czterema fazami nie zmieściłaby
   się w kontekście.
2. **Ustrukturyzowana wartość zwracana wyłapała rzeczy, których bramki nie widzą.** `UNCERTAINTIES`
   przyniosło trzy realne pytania — m.in. że mnożnik renderuje się jako „× 1,55", a kryterium
   planu pisze „× 1.55". Żadne `tsc` tego nie złapie; bez wymuszonego pola po prostu by zniknęło.
3. **Taksonomia Minor/Structural działa, gdy subagent ma mandat adaptacji.** Cztery niedopasowania
   Minor (m.in. `value: T | null` zamiast `T`, bo pusty formularz musi mieć stan „nic nie wybrano”)
   zostały zaadaptowane i zgłoszone, zamiast zatrzymać przebieg albo — gorzej — przeprojektować
   plan po cichu.
4. **„Wiersze ręczne to jurysdykcja człowieka" trzeba było świadomie złamać** — ale nie po cichu.
   Kolejka nocna zamawiała wprost odhaczenie 3.7–3.13 harnessem, więc odhaczyłem to, co harness
   **realnie pokazuje**, a 3.12 (Expo Go) zostawiłem jako `BLOCKED-MANUAL`, bo emulator nie
   wystartował. Reguła umiejętności istnieje po to, żeby agent nie podpisywał się pod niesprawdzonym;
   spełnia ją dowód, nie posłuszeństwo wobec litery.

## Co warto zastosować i gdzie

- **„Ewaluator celu czyta wyłącznie transkrypcję" zmienia sposób pisania.** Bramka, która przeszła
  po cichu, jest nieodróżnialna od bramki, której nie uruchomiono. Stąd wiersze `GATE …: PASS`
  i `COMMIT p3: 42b6917` w tekście odpowiedzi — to nie ozdoba, tylko jedyny ślad, po którym da się
  rano odtworzyć, co faktycznie sprawdzono.
- **Niezmiennik „commit tylko na zielono" plus bezwarunkowe przywrócenie celowego zepsucia.**
  Zepsucie zawsze jest edycją tylko w drzewie roboczym, nigdy w indeksie — dzięki temu
  `git checkout -- <plik>` cofa je dokładnie do wersji przygotowanej do commitu. Użyłem tego
  cztery razy tej nocy i ani razu zepsucie nie miało szansy trafić do historii.
- **Budżet dwóch prób samonaprawy na bramkę.** Uchronił mnie przed zapętleniem na teście, który
  trzykrotnie padał z powodu kolizji lokatora — po drugiej próbie przestałem łatać asercję
  i poszedłem zrozumieć DOM (okazało się, że oba ekrany zakładek są zamontowane naraz).
- **Uzgadnianie statusu w `roadmap.md` i `change.md` „najlepszym wysiłkiem"** — brak dopasowania
  nigdy nie zatrzymuje przebiegu. W MealPlanie S-02 było już `in-progress`, więc krok był no-opem;
  wart odnotowania jest sam wzorzec: synchronizacja dokumentów nie ma prawa wywrócić implementacji.

## Czego lekcja NIE robi

Nie zastępuje przeglądu — `/10x-goal-implement` kończy sugestią `/10x-impl-review` i słusznie:
przegląd fazy 3 znalazł dwa ostrzeżenia, których stos bramek nie mógł zobaczyć, w tym tryb
zawieszenia karty celu wprowadzony **przez samą tę fazę**. Autonomiczne wdrożenie planu to nie
to samo co autonomiczna ocena jakości. Nie usuwa też potrzeby weryfikacji ręcznej tam, gdzie
harness nie sięga — u mnie cała warstwa natywna.
