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
-- `FOREIGN KEY constraint failed` — dlatego trasa `PUT /api/profile` woła `touchAppUser` PRZED
-- `saveUserProfile`. To nie jest ostrożność, to warunek działania.
--
-- Ograniczenia `CHECK` są DRUGĄ linią obrony, za `validateProfile` z modułu wzoru, nie zamiast
-- niej: komunikaty pod polami formularza rodzą się tam, a tutaj chronimy bazę przed zapisem
-- z pominięciem trasy. Zakres wagi może mówić 30–300, bo walidacja normalizuje wartość do 0,1 kg
-- przed sprawdzeniem granic, więc do zapisu nigdy nie trafi liczba spoza przedziału.
--
-- Migracja wstecz leży w `migrations/down/0002_user_profile.down.sql`. Kolejność cofania to
-- `0002`, potem `0001` — odwrotna jest niemożliwa, bo klucz obcy nie pozwoli usunąć `app_user`
-- przy istniejących wierszach profilu.

CREATE TABLE user_profile (
  user_id TEXT PRIMARY KEY REFERENCES app_user(id),
  age INTEGER NOT NULL CHECK (age BETWEEN 18 AND 100),
  weight_kg REAL NOT NULL CHECK (weight_kg BETWEEN 30 AND 300),
  height_cm INTEGER NOT NULL CHECK (height_cm BETWEEN 100 AND 250),
  sex TEXT NOT NULL CHECK (sex IN ('female', 'male')),
  activity_level INTEGER NOT NULL CHECK (activity_level BETWEEN 1 AND 5),
  target_kcal_override INTEGER CHECK (target_kcal_override IS NULL OR target_kcal_override BETWEEN 1000 AND 6000),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
