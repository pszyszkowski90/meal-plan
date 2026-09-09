-- Migration number: 0001 	 2026-09-08T20:58:28.817Z
--
-- Lokalna tożsamość użytkownika. `id` to identyfikator z Clerka (roszczenie `sub` tokenu) i jest
-- jedynym łącznikiem między naszymi danymi a kontem. ŻADNYCH danych tożsamościowych: e-mail
-- i hash hasła zostają u Clerka i nie są tu duplikowane — tak stanowi granica z `CLAUDE.md`.
--
-- Wiersz powstaje leniwie, przy pierwszym uwierzytelnionym żądaniu (`touchAppUser`); nie ma
-- webhooka synchronizującego użytkowników z Clerka.
--
-- Do tej tabeli dowiążą się profil (S-02), preferencje (S-03) i plany (S-04) — przez
-- `REFERENCES app_user(id)`.
--
-- Migracja wstecz leży w `migrations/down/0001_app_user.down.sql`. Wrangler czyta wyłącznie pliki
-- `.sql` z najwyższego poziomu `migrations/`, więc nie zejdzie do `down/` — pod warunkiem, że
-- `migrations_pattern` pozostanie nieustawiony.

CREATE TABLE app_user (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
