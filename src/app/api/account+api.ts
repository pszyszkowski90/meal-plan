import { requireUserId } from '@/server/auth';
import { touchAppUser } from '@/server/repository/app-users';

/**
 * Trasa odniesienia dla granicy danych, **nie funkcja produktowa**. Istnieje z dwóch powodów:
 * żeby izolację między kontami dało się sprawdzić ręcznie przed S-02, i żeby trasy profilu,
 * preferencji i planu miały z czego powstać.
 *
 * Dlatego nie dokładaj tu pól — wiek, waga, cel kaloryczny należą do S-02 i mają własną trasę.
 *
 * Kształt, który się powtarza: `requireUserId` → funkcja repozytorium z `userId` w pierwszym
 * argumencie → JSON. Zero SQL-a i zero `getWorkerEnv()` w tym pliku.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await requireUserId(request);
  if (auth instanceof Response) {
    return auth;
  }

  const user = await touchAppUser(auth.userId);

  return Response.json({ userId: user.id, createdAt: user.createdAt, lastSeenAt: user.lastSeenAt });
}
