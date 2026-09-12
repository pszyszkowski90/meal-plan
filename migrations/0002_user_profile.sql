-- Migration number: 0002 	 2026-09-12T20:01:35.752Z
--
-- Profil użytkownika (S-02): WEJŚCIA wzoru Mifflin-St Jeor plus opcjonalne nadpisanie celu.
-- Jeden wiersz na konto — stąd `user_id` jako klucz główny, bez osobnego `id`.
--
-- Czego tu ŚWIADOMIE nie ma: wyliczonego zapotrzebowania. Cel liczy się przy odczycie modułem
-- `src/lib/calorie-target.ts`, tym samym, którego użyje generator planu (S-04). Utrwalenie
-- wyniku obok wejść stworzyłoby dwa źródła prawdy, które rozjadą się przy pierwszej korekcie
-- stałych wzoru.
--
-- `target_kcal_override` NULL znaczy „obowiązuje wyliczenie" — to jedyne kodowanie tego stanu.
--
-- `REFERENCES app_user(id)` domyka obietnicę z komentarza `0001`. D1 wymusza klucze obce
-- domyślnie, więc zapis profilu dla konta, które nigdy nie dotknęło `app_user`, poleci na
-- `FOREIGN KEY constraint failed` — dlatego trasa `PUT /api/profile` woła `ensureAppUser` PRZED
-- `saveUserProfile`. To nie jest ostrożność, to warunek działania.
--
-- `ON DELETE CASCADE`, bo tożsamość jest właścicielem profilu: gdy zniknie wiersz `app_user`,
-- profil nie ma czyj być. Bez tego usunięcie konta padałoby na klucz obcy, dopóki ktoś nie
-- skasowałby profilu ręcznie i w odpowiedniej kolejności. Usuwanie konta jest poza zakresem M-01,
-- ale ta decyzja kosztuje dziś jedno słowo, a po pierwszym wierszu na produkcji kosztowałaby
-- migrację przebudowującą tabelę. Preferencje (S-03) i plany (S-04) mają się dowiązać tak samo.
--
-- Ograniczenia `CHECK` są tu WYŁĄCZNIE wyliczeniowe (`sex`, `activity_level`) i mają jedno
-- zadanie: domykają rzutowania `as Sex` i `as ActivityLevel` w `user-profile.ts`, które bez nich
-- byłyby kłamstwem typu — baza jest jedynym miejscem, które może zagwarantować, że nie ma tam
-- innej wartości.
--
-- Zakresów liczbowych (wiek, waga, wzrost, własny cel) tu ŚWIADOMIE nie ma. Ich jedynym źródłem
-- prawdy jest `ProfileBounds` w `src/lib/calorie-target.ts`, a `saveUserProfile` jest jedyną
-- drogą zapisu, więc każda wartość przechodzi przez `validateProfile`. Kopia granic w DDL
-- rozjechałaby się przy pierwszej ich korekcie, a rozjazd wychodzi użytkownikowi jako 500
-- `internal` zamiast 400 z błędem pod polem — nierozróżnialnie od awarii D1. Do tego SQLite nie
-- ma `ALTER TABLE … DROP CONSTRAINT`, więc zmiana granicy kosztowałaby przebudowę tabeli.
--
-- Migracja wstecz leży w `migrations/down/0002_user_profile.down.sql`. Kolejność cofania to
-- `0002`, potem `0001` — odwrotna jest niemożliwa, bo klucz obcy nie pozwoli usunąć `app_user`
-- przy istniejących wierszach profilu.

CREATE TABLE user_profile (
  user_id TEXT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  age INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  height_cm INTEGER NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('female', 'male')),
  activity_level INTEGER NOT NULL CHECK (activity_level BETWEEN 1 AND 5),
  target_kcal_override INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
