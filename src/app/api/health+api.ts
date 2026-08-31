import { getWorkerEnv } from '@/server/env';

/**
 * Smoke test wdrożenia, nie funkcja produktowa: potwierdza, że adapter workerd obsługuje trasy
 * API i że binding D1 dochodzi do trasy. `select 1` działa na pustej bazie — schemat należy do
 * zmiany „auth", nie do wdrożenia.
 */
export async function GET(): Promise<Response> {
  const row = await getWorkerEnv().DB.prepare('select 1 as ok').first<{ ok: number }>();

  return Response.json({ ok: true, d1: row?.ok === 1, at: new Date().toISOString() });
}
