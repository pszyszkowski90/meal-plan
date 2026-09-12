/**
 * Jedyne miejsce z SQL-em do tabeli `user_profile`. Reguła warstwy — `userId` pierwszym
 * argumentem każdej funkcji i filtr po nim w SQL-u, bo D1 nie ma RLS — jest opisana raz,
 * w nagłówku `app-users.ts`; tutaj obowiązuje bez zmian i bez powtórzenia.
 *
 * Kształt profilu (`ProfileInput`) przychodzi z `src/lib/calorie-target.ts` i nie jest tu
 * redefiniowany: ta sama definicja waliduje ciało `PUT`, zasila podgląd w formularzu i opisuje
 * wiersz w bazie. Wyliczonego celu tabela NIE trzyma — liczy się przy odczycie tym samym modułem.
 *
 * Ten plik jako pierwszy w repo interpoluje coś do napisu w `prepare(` (`SELECT_COLUMNS`), więc
 * reguła wprost: interpolować wolno WYŁĄCZNIE identyfikatory ze stałych tego modułu, nigdy
 * wartości — te wchodzą przez `bind(...)` bez wyjątku. Inaczej grep za `${` wewnątrz `prepare(`
 * przestaje być wiarygodnym sygnałem alarmowym w katalogu, który nie ma testów.
 */
import type { ActivityLevel, ProfileInput, Sex } from '@/lib/calorie-target';
import { getWorkerEnv } from '@/server/env';

export interface UserProfile extends ProfileInput {
  createdAt: string;
  updatedAt: string;
}

interface UserProfileRow {
  age: number;
  weight_kg: number;
  height_cm: number;
  sex: string;
  activity_level: number;
  target_kcal_override: number | null;
  created_at: string;
  updated_at: string;
}

const SELECT_COLUMNS = `age, weight_kg, height_cm, sex, activity_level, target_kcal_override, created_at, updated_at`;

/**
 * Mapowanie snake_case → camelCase, jak `toAppUser`. Rzutowania na `Sex` i `ActivityLevel` są
 * bezpieczne dzięki ograniczeniom `CHECK` z migracji `0002`: do tabeli nie wejdzie ani inna płeć,
 * ani poziom spoza 1–5, a innej drogi zapisu niż `saveUserProfile` nie ma.
 */
function toUserProfile(row: UserProfileRow): UserProfile {
  return {
    age: row.age,
    weightKg: row.weight_kg,
    heightCm: row.height_cm,
    sex: row.sex as Sex,
    activityLevel: row.activity_level as ActivityLevel,
    targetKcalOverride: row.target_kcal_override,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const row = await getWorkerEnv()
    .DB.prepare(`select ${SELECT_COLUMNS} from user_profile where user_id = ?1`)
    .bind(userId)
    .first<UserProfileRow>();

  return row ? toUserProfile(row) : null;
}

/**
 * Wstawia albo nadpisuje profil — jedno zapytanie, jedna runda do D1.
 *
 * W przeciwieństwie do `touchAppUser` NIE ma tu progu świeżości: zapis profilu jest jawną akcją
 * użytkownika (kliknięcie „Zapisz"), a nie efektem ubocznym odczytu, więc pętla renderów po stronie
 * klienta nie ma jak go wywołać. Tyle i tylko tyle to rozumowanie obejmuje — WŁASNY klient.
 * Klient skryptowy z ważnym tokenem woła `PUT /api/profile` w pętli i płaci dwa zapisy za żądanie
 * (`touchAppUser` plus ten upsert), a limit zapisów D1 jest wspólny dla wszystkich kont, więc jedno
 * konto może wyczerpać dobę pozostałym. Rate-limit jest świadomie odłożony: MVP nie ma bindingu
 * Rate Limiting, a przy obecnej liczbie kont koszt nadzoru przewyższa ryzyko. Gdyby dokładać
 * ogranicznik, najtańszy jest tutaj — pominięcie upsertu, gdy nadesłany `ProfileInput` jest
 * identyczny z wierszem w bazie.
 *
 * `created_at` przetrwa konflikt (kolumna nie jest w `DO UPDATE SET`), `updated_at` idzie na teraz.
 * `RETURNING` przy `DO UPDATE` BEZ predykatu `WHERE` zawsze oddaje wiersz — stąd brak odczytu
 * awaryjnego, którego wymaga `touchAppUser`.
 *
 * Wywołujący musi wcześniej zapewnić wiersz w `app_user` (`touchAppUser`), inaczej klucz obcy
 * odrzuci zapis dla konta, które nigdy nie dotknęło tamtej tabeli.
 */
export async function saveUserProfile(userId: string, input: ProfileInput): Promise<UserProfile> {
  const nowIso = new Date().toISOString();

  const row = await getWorkerEnv()
    .DB.prepare(
      `insert into user_profile (user_id, age, weight_kg, height_cm, sex, activity_level, target_kcal_override, created_at, updated_at)
       values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
       on conflict(user_id) do update set
         age = ?2,
         weight_kg = ?3,
         height_cm = ?4,
         sex = ?5,
         activity_level = ?6,
         target_kcal_override = ?7,
         updated_at = ?8
       returning ${SELECT_COLUMNS}`
    )
    .bind(
      userId,
      input.age,
      input.weightKg,
      input.heightCm,
      input.sex,
      input.activityLevel,
      input.targetKcalOverride,
      nowIso
    )
    .first<UserProfileRow>();

  if (!row) {
    throw new Error('Zapis profilu nie oddał wiersza — nieoczekiwany stan D1.');
  }

  return toUserProfile(row);
}
