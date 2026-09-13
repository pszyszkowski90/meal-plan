# Brief: Moduł 3, Lekcja 5 — debugowanie ze zbieżnością dowodów

> Brief pisany **po** przejściu pełnej pętli na realnym defekcie (ustalenie F5 przeglądu fazy 3),
> 13.09.2026.
>
> **Sprostowanie z tego samego dnia.** Pierwsza wersja tego briefu twierdziła, że „treści lekcji
> nie ma lokalnie". **To była nieprawda** — materiał leżał w katalogu tymczasowym **poprzedniej**
> sesji (`scratchpad/lessons/m3l5-final.json`) i znalazłem go dopiero przy zadaniu grupy D.
> Sekcja „co lekcja wprowadza" jest poniżej **uzupełniona o rzeczywistą treść**, a to, co napisałem
> z praktyki, zostaje — zgadza się z materiałem.

## Co lekcja wprowadza

Debugowanie nie jako zgadywanie, tylko jako **zbieżność niezależnych źródeł dowodu**. Jedno
źródło mówiące „tu jest problem" to hipoteza. Dwa niezależne źródła wskazujące to samo miejsce
to diagnoza. Domknięciem jest zamiana defektu w **czerwony test**, a dopiero potem poprawka —
żeby to, co naprawione, zostało naprawione na stałe.

Pętla: reprodukcja → czerwony test → poprawka → zielony → **próba celowego zepsucia**.

**Uzupełnione z treści lekcji** (po znalezieniu materiału):

- Lekcja nazywa **cztery** źródła dowodu: monitoring produkcyjny (Sentry), logi aplikacji,
  reprodukcja w Playwrighcie i sam kod. Moja ocena, że mamy tu **trzy** z czterech, była trafna —
  brakuje dokładnie monitoringu.
- **„Jeden przepływ, cztery wejścia"**: niezależnie od tego, czy sygnał pojawi się najpierw
  w monitoringu, w logu, w chwiejnym teście E2E, czy w stacktrace — droga jest ta sama. To wyjaśnia,
  dlaczego moje wejście „od raportu przeglądu i kodu" nie było odstępstwem, tylko piątym wariantem
  tego samego startu.
- **Tryb awarii, którego nie opisałem, a który jest sednem lekcji: połknięte błędy** — puste bloki
  `catch`, zignorowane odrzucenia obietnic (OWASP A10:2025, awarie logowania i monitoringu).
  Połknięty błąd niszczy **dokładnie ten dowód**, którego debugowanie potrzebuje. To repo wypada
  tu dobrze i warto wiedzieć dlaczego: każdy `catch` w `profile.tsx` **rozgałęzia się** na
  `OfflineError`, `NotSignedInError` i resztę, a `internalError` w trasie **loguje** przed
  zwróceniem 500. Nie ma ani jednego pustego `catch`.
- Lekcja **nie dowozi własnego artefaktu** — dziedziczy cały łańcuch narzędzi Modułu 3. Dlatego
  nie przyszedł z nią żaden skill i dlatego jej „wykonanie" musi być zmierzone realnym defektem,
  a nie obecnością pliku.

## Ile źródeł naprawdę mamy w tym projekcie

Lekcja zakłada bogatszy zestaw, niż ten projekt posiada. **Sentry ani żadnego monitoringu błędów
klienta tu nie ma** i nie udaję, że jest. Zostają trzy:

| Źródło | Co widzi | Co dało przy F5 |
|---|---|---|
| Kod i raport przeglądu | strukturę warunku renderowania | **sygnał pierwszy** — cały defekt |
| Harness E2E (Playwright) | zachowanie w przeglądarce | potwierdzenie i test regresji |
| `wrangler tail` / log `wrangler dev` | ruch i błędy po stronie serwera | **nic — i to jest ustalenie** |

### Które źródło dało sygnał jako pierwsze

**Raport przeglądu i kod, nie obserwacja działającego produktu.** F5 był już opisany
w `impl-review-phase-3.md:102-116` jako PENDING; ja go jedynie zlokalizowałem w kodzie do jednej
linii — `const overrideKcal = target?.overrideKcal ?? null`, a potem warunek
`{target && overrideKcal !== null ? …}`. Wystarczyło przeczytać, że `target` gaśnie przy błędzie
**któregokolwiek** pola, żeby wiedzieć, że wyjście z nadpisania znika w najgorszym możliwym
momencie.

To jest uczciwa kolejność i warto ją nazwać, bo jest odwrotna do tej, którą sugeruje słowo
„debugowanie": **nie zaczęło się od objawu zgłoszonego przez użytkownika, tylko od czytania kodu
z pytaniem „co jeszcze gasi ten warunek".**

### Źródło, które milczało — i dlaczego to nie jest porażka

`wrangler tail` i log `wrangler dev` nie pokazały **niczego** związanego z F5, bo defekt jest
w całości po stronie klienta: żaden błędny stan nigdy nie dociera do Workera. Log pokazywał
wyłącznie start i przeładowanie serwera.

Wniosek, który zabieram: **„zbieżność dowodów" nie znaczy „zbierz wszystkie źródła".** Znaczy
„wiedz, które źródło może mieć zdanie na temat tej klasy defektu". Dla błędu warunku renderowania
log serwera jest strukturalnie ślepy i czekanie na sygnał z niego byłoby marnowaniem czasu.
Dwa źródła, które mogły coś wiedzieć, wskazały to samo miejsce — i to jest cała zbieżność,
jaka była tu do uzyskania.

## Co naprawiłem

**F5 — wyjście z nadpisania znikało dokładnie wtedy, gdy było potrzebne.**

Wiersz „Wróć do wyliczenia" był warunkowany na `target`, a `target` jest `null`, gdy walidacji
nie przechodzi **którekolwiek** pole. Skutek: użytkownik z zapisanym nadpisaniem 2200, który
wyczyścił wiek, tracił jedyny przycisk kasujący nadpisanie — i nie miał jak wrócić do wyliczenia
inaczej niż ręcznie czyszcząc pole, o czym ekran nie mówił ani słowem.

Poprawka rozdziela dwie rzeczy, które nigdy nie powinny być związane: **wartość wpisana w pole**
istnieje niezależnie od tego, czy profil **jako całość** się liczy. Wiersz warunkuje się teraz na
`typedOverride !== null`, a liczba wyliczona pokazuje się tylko wtedy, gdy naprawdę jest policzona.

Dwa testy regresji w [`profile-screen.spec.ts`](../tests/e2e/profile-screen.spec.ts):
niepoprawne **inne** pole i niepoprawne **samo** nadpisanie. Drugi przypadek jest subtelniejszy —
`500` przechodzi przez `parseNumberInput` (jest liczbą), ale leży poniżej granicy 1000, więc gasi
`target` mimo że pole wygląda na wypełnione poprawnie.

## Próba celowego zepsucia — i co przy niej wyszło

Przywróciłem `{target && typedOverride !== null ? …}`, przebudowałem, uruchomiłem. **Oba testy
zaczerwieniły się osobno** (drugi trzeba było uruchomić własnym `--grep`, bo tryb `serial`
zatrzymuje zestaw po pierwszej porażce). Potem przywrócenie poprawki i pełny zestaw: **23/23**.

Przy okazji trafił się przypadek wprost z `lessons.md`: jeden przebieg wrócił z `1 failed,
2 did not run`, gdzie poległo **logowanie**, a nie testy F5. Gdybym policzył to jako „czerwone po
zepsuciu", miałbym dowód, którego nie było — bo testy F5 w ogóle się nie wykonały. To jest ta sama
klasa pomyłki, co `FAIL eslint (0.0s)` przy `EINVAL` i EBUSY przy `expo export`: **„narzędzie nie
wystartowało" wygląda w raporcie podobnie do „narzędzie znalazło problem".** Przebieg powtórzyłem.

Osobno, profilaktycznie: przed każdym `expo export` ubijałem `wrangler dev` i `workerd`, a po
przebudowie sprawdzałem, że **nowy kod naprawdę jest w artefakcie**. Tu wyszła drobna pułapka
narzędziowa — `grep` po `dist/` nie znajdował polskich napisów („Wróć", „Uzupełnij"), bo bundler
zapisuje znaki spoza ASCII inaczej, niż szuka powłoka. Fałszywy alarm „zmiany nie ma w buildzie"
wyglądał dokładnie jak realna awaria. Rozstrzygnął dopiero probe w Node porównujący **wzorzec
czysto ASCII**, który odróżnia nową formę (`" kcal (wyliczone "` ze spacją, z template literal)
od starej (tekst JSX). Wniosek: **dobierz sondę do kodowania artefaktu, nie do tego, jak kod
wygląda w edytorze.**

## Czego NIE zrobiłem

**F4 zostaje PENDING — świadomie, i to nie jest to samo co „zabrakło czasu".**

F4 („abc" w polu nadpisania znika bez komunikatu) i F5 są **sprzężone w jedną stronę**: naprawa
F4 polegałaby na odróżnieniu „puste" od „niepoprawne" i pokazaniu błędu — co **zgasiłoby `target`**
i tym samym uruchomiło dokładnie ten tryb awarii, który opisuje F5. Innymi słowy: naprawa
„prostszego" F4 przed F5 **pogorszyłaby** produkt.

Teraz, po F5, F4 da się naprawić bezpiecznie — wyjście z nadpisania przetrwa błąd walidacji.
To jest ustalenie warte zapamiętania poza tym jednym przypadkiem: **kolejność naprawiania ustaleń
przeglądu bywa wymuszona, a „prostsze" nie znaczy „pierwsze".**

## Co zabieram do dalszej pracy

1. **Nazwij źródła, które mogą mieć zdanie, zanim zaczniesz zbierać dowody.** Log serwera przy
   defekcie renderowania to nie jest słaby dowód — to brak dowodu, i trzeba to powiedzieć wprost.
2. **Sprawdzaj, czy przebieg testów w ogóle doszedł do tych testów.** `did not run` w raporcie to
   nie jest wynik.
3. **Sonda po artefakcie musi pasować do kodowania artefaktu**, inaczej sama produkuje fałszywe
   awarie.
4. **Sprzężenie ustaleń przeglądu wyznacza kolejność napraw.** Sprawdź je, zanim wybierzesz
   „łatwiejsze".
