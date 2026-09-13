# Frame Brief: wykluczenia składnikowe — czy „wyszukiwarka po `ingredient`" jest odpowiedzią na właściwe pytanie

> Etap ramowania przed /10x-plan. Ten dokument przedstawia, co *faktycznie*
> jest problemem, oddzielone od tego, co początkowo zakładano.
>
> Powstał **po** [research.md](research.md), jako reakcja na to, co badanie odsłoniło. Uruchomiony
> świadomie, nie dla kompletu: plan S-03 przedstawia obserwację i rozwiązanie jako jeden fakt,
> a badanie pokazało, że rozwiązanie nie adresuje obserwacji. To jest dokładnie kształt, do
> którego ta umiejętność służy.

## Zgłoszona obserwacja

Dosłownie, z planu S-03 (`plan.md`, sekcja „Otwarte ryzyka i założenia", brzmienie sprzed
poprawek z 13.09.2026):

> „Użytkownik myśli »nie jem grzybów«, a w `ingredient` są »pieczarki, świeże« i »borowiki,
> suszone«. Bez warstwy synonimów albo kategorii wykluczenie będzie dziurawe."

## Początkowe ramy (zachowane)

- **Podana przyczyna:** nazwy w `ingredient` są zbyt szczegółowe względem tego, jak myśli
  użytkownik; brakuje warstwy synonimów albo kategorii.
- **Proponowany kierunek:** ekran dostaje **wyszukiwarkę składników** z wyborem z listy zamiast
  pola tekstowego (`plan.md`, „Krytyczne szczegóły implementacji"), a samo ryzyko zostaje
  „do rozstrzygnięcia w fazie 2, ewentualnie przez wykluczanie na poziomie `ingredient.category`".
- **Zawężenie przed wysyłką:** *sesja autonomiczna — pytań zawężających nie zadano człowiekowi.*
  Mandat decyzyjny pochodzi z `notes/lesson-queue.md` („Decyzje: masz mandat"). Zamiast pytań
  do właściciela uruchomiono **niezależną kontrolę krzyżową** (Krok 5), której promptowi
  **nie podano wiodącej hipotezy** — po to, żeby zawężenie nie było potwierdzaniem własnego
  wniosku. To jest słabsza forma niż odpowiedź człowieka i tak ją tu traktuję; rozstrzygnięcie
  wariantu i tak zostaje przy właścicielu.

## Mapa wymiarów

Obserwacja może pochodzić z któregokolwiek z tych wymiarów łańcucha
*autorstwo przepisu → schemat → wejście użytkownika → zapytanie odsiewające → jadłospis*:

1. **A. Autorstwo danych** — nazwy składników powstają bez kontrolowanego słownika, więc jedno
   pojęcie kulinarne rozsypuje się na wiele wierszy (gatunek × stan).
2. **B. Schemat** — w `ingredient` nie ma niczego, co wyraża pojęcie szerokie; `category` wygląda
   na wyjście awaryjne.
3. **C. Wejście użytkownika** — jednostką myślenia użytkownika jest pojęcie, a jednostką zapisu
   pojedynczy `ingredient_id`; między nimi nie ma warstwy. ← **początkowe ramy celują tutaj,
   ale w narzędzie (wyszukiwarka), nie w brakującą warstwę**
4. **D. Zapytanie odsiewające** — `listAllowedDishes` mogłoby dopasowywać po nazwie zamiast po
   identyfikatorze.
5. **E. Druga furtka guardrailu** — podmiana dania (FR-010/FR-011, S-05) omija listę wykluczeń.
6. **F. Dowód** — kryterium, które ma tego wszystkiego dowieść, przechodzi niezależnie od tego,
   czy produkt działa.

## Badanie hipotez

| Hipoteza | Dowody | Werdykt |
| --- | --- | --- |
| **A. Autorstwo bez kanonicznego słownika** | Brak słownika zgłoszony **przed** F-01 jako zadanie dla F-01, którego F-01 nie wykonał (`../dish-source-and-seed-pool/research.md:321-323`). `seed/ingredients.json` to mapa nazwa→`fdcId`, nie słownik pojęć. Łagodzi: pula jednoautorska z bramką `reviewedBy`. | SŁABE (przyczyna wtórna) |
| **B. Schemat — `category` jako koło ratunkowe** | Enum to 11 **kategorii sklepowych** (`migrations/0003_dish_pool.sql:50-53`). Grzyby → `warzywa`, orzechy → `suche`: wykluczenie po kategorii wycięłoby wszystkie warzywa albo wszystkie produkty suche. `nabial` i `ryby` zadziałają — czyli wygląda na działające. USDA `food_category` zawodzi identycznie. | SILNE, ale **jako obalenie**, nie jako źródło |
| **C. Brak warstwy pojęć między zdaniem użytkownika a zapisem** | `ingredient.name` **musi** nieść stan, bo ryż surowy kontra ugotowany to różnica ~180% kcal — wielokrotność całego budżetu ±10% (`0003:23-27`). Wyszukiwanie podłańcucha „grzyb" **nie trafia** ani w „pieczarki", ani w „borowiki", więc wyszukiwarka nie pokaże nawet kandydatów. Zbiór identyfikatorów jest migawką, a pula ma rosnąć (`../dish-source-and-seed-pool/plan.md:342-345`). | **SILNE** |
| **D. Dopasowanie po nazwie w zapytaniu** | Zakazane wprost (`../dish-source-and-seed-pool/options.md:92-96`), a kontrakt to złączenie po `dish_ingredient` (`plan.md`, faza 1 §3). Cztery niezależne źródła zewnętrzne mówią, że to **właściwy** mechanizm (`research.md` §3.2). | BRAK |
| **E. Podmiana dania omija listę** | `context/foundation/prd.md:186-187` wymaga, by podmiana też nie wprowadzała wykluczeń. Kodu nie ma — ryzyko strukturalne, należy do S-05. | BRAK (dziś) |
| **F. Kryterium 1.7 przechodzi niezależnie od działania produktu** | Kryterium żąda wykluczenia „grzyby" (`plan.md:151-152`, `:247`), a model wskazuje `ingredient_id`; wiersza „grzyby" nie ma i nie będzie. Zaliczyć da się je tylko wykluczając wprost „borowiki, suszone", co zakłada wiedzę, której kryterium ma dowieść. Tabele są puste, fixture pisze autor asercji. | **SILNE** |

## Sygnały zawężające

Decydujące obserwacje, które zawęziły przestrzeń hipotez:

- **Kontrola krzyżowa, bez podanej hipotezy, niezależnie wskazała wymiar C jako najsłabsze ogniwo**
  i niezależnie wypunktowała wymiar F, którego jej prompt w ogóle nie wymieniał. Zbieżność dwóch
  niezależnych przebiegów podnosi pewność.
- **Ta sama kontrola obaliła moje pierwotne nazwanie problemu** (patrz niżej) — co jest mocniejszym
  sygnałem jakości niż gdyby tylko przytaknęła.
- **`ingredient.name` niesie stan z powodu makr, nie z powodu estetyki.** To wyklucza całą klasę
  „rozwiązań" polegających na rozluźnieniu nazewnictwa: nazwy są nośne dla guardrailu ±10%.
  Cokolwiek wejdzie, musi być **dodatkową osią**, nie kompromisem na nazwach.
- **Wyszukiwarka podłańcuchowa nie jest częściowym rozwiązaniem — jest żadnym.** „grzyb" nie
  występuje jako podłańcuch w „pieczarki, świeże". To zamyka początkowe ramy jako kierunek.

## Konwencja między systemami

Klasę „użytkownik wyklucza pojęcie, baza trzyma nazwy" obsługuje się **warstwą rodzin pokarmowych
zdefiniowanych pod regułę**, nie listą synonimów — bo synonimy zawsze są w tyle za rzeczywistością
(kanoniczny przykład: reguła bezglutenowa z listą wheat/barley/rye nie łapie farro, orkiszu,
kamutu). Konwencja żąda też trzeciego stanu: „nie znaleziono" ≠ „bezpieczne". Pełne cytaty
i źródła: [research.md](research.md) §3.2.

**Czy wiodąca hipoteza pasuje do konwencji?** Tak — wymiar C to dokładnie brak tej warstwy.
Początkowe ramy (wyszukiwarka) pasują do konwencji **tylko połowicznie**: wybór z listy zamiast
wolnego tekstu jest zgodny z konwencją i zostaje, ale sam nie tworzy warstwy pojęć.

## Przeformułowane sformułowanie problemu

> **Rzeczywisty problem do zaplanowania to**: FR-004 obiecuje wykluczanie **potraw i składników**,
> a użytkownik mówi **pojęciami** — i to jest luka wymagań, nie defekt implementacji.

Trzy zdania wyjaśnienia:

1. **Guardrail nie jest łamany.** PRD definiuje go względem **zapisanej listy** („Żaden posiłek …
   nie zawiera pozycji z listy wykluczeń", `context/foundation/prd.md:82`, podobnie `:62`).
   Wykluczenie „pieczarki, świeże" i podanie dania z borowikami **nie łamie** tego zdania. Łamie
   zdanie użytkownika „nie jem grzybów", którego PRD nigdy nie obiecał reprezentować. To przesuwa
   pierwszy artefakt do zmiany z migracji na **PRD i Otwarte pytanie 4** (`prd.md:229-231`).
2. **Waga jest niższa, niż wyglądała.** `prd.md:203-205` wyklucza z zakresu alergie kliniczne
   i diety lecznicze, więc kosztem przeoczonego grzyba jest **zaufanie, nie bezpieczeństwo**.
   Nadal poważne — „jedno takie danie niszczy zaufanie do całego planu" (`prd.md:62-63`) — ale
   nie jest to ograniczenie tej samej klasy co ±10%.
3. **Co by się zmieniło po rozwiązaniu:** użytkownik mógłby wyrazić „nie jem grzybów" jednym
   wpisem, który obejmuje też składniki dodane do puli **później**. Dziś, nawet przy idealnej
   wyszukiwarce, musiałby wyliczyć każdy wiersz z osobna — i nie miałby jak ich znaleźć, bo
   wyszukiwanie po nazwie ich nie zwraca.

**Początkowe ramy nie utrzymały się w całości, ale nie zostają odrzucone.** Wybór z listy zamiast
wolnego tekstu jest poprawny i zostaje w planie. Odrzucone zostaje **umiejscowienie** (faza 2
zamiast fazy 1), **nazwanie** (defekt UX zamiast luki wymagań) oraz **koło ratunkowe**
(`ingredient.category`, które nie działa).

## Pewność

**WYSOKA** — dla przeformułowania i dla wymiaru F.

Uzasadnienie: silne dowody w bazie kodu (`0003:23-27`, `0003:50-53`, `plan.md:151-152`), zgodność
z konwencją międzysystemową potwierdzoną czterema niezależnymi źródłami, oraz decydujący sygnał
zawężający — niezależny przebieg bez podanej hipotezy doszedł do tego samego ogniwa i sam zgłosił
wymiar F.

**Zastrzeżenie:** wysoka pewność dotyczy **diagnozy**, nie **wyboru wariantu**. Który z wariantów
(a)/(b)/(c) wejdzie, jest decyzją właściciela i pozostaje otwarty — dowody przechylają się ku (a),
bo (b) przecieka przy rosnącej puli, ale (c) jest uczciwą odpowiedzią MVP pod warunkiem nazwania
dziury w PRD.

## Co zmienia się dla /10x-plan

Plan S-03 przestaje być planem „ekranu z wyszukiwarką", a staje się planem, którego **faza 1
rozstrzyga granulację wykluczeń**, a faza 2 buduje pod nią ekran. Kolejność decyzji to
**PRD → schemat → ekran**, nie odwrotnie. Niezależnie od wybranego wariantu do naniesienia od razu
idzie jedna rzecz: **przeredagowanie kryterium 1.7**, które dziś przechodzi bez względu na to, czy
produkt działa.

## Referencje

- Pliki źródłowe: `migrations/0003_dish_pool.sql:23-27`, `:42-55`, `:50-53`;
  `context/foundation/prd.md:62`, `:82`, `:117`, `:186-187`, `:203-205`, `:229-231`;
  `context/changes/dietary-preferences/plan.md:151-152`, `:247`;
  `context/changes/dish-source-and-seed-pool/options.md:92-96`;
  `context/changes/dish-source-and-seed-pool/plan.md:342-345`;
  `context/changes/dish-source-and-seed-pool/research.md:321-323`;
  `notes/night-decisions.md:290-292`; `context/foundation/lessons.md`
- Powiązane badanie: [`research.md`](research.md) — §3.2 (konwencja), §4.1–§4.3 (poprawki),
  Otwarte pytania 1 i 4
- Zadania badawcze: cztery przebiegi podagentów z 13.09.2026 (wzorzec trasy i repozytorium;
  ekran i prymitywy; historia decyzji; **niezależna kontrola krzyżowa bez podanej hipotezy**).
  `TaskCreate` nie użyto — sesja autonomiczna, stan trzymany w `notes/lesson-queue.md`.
