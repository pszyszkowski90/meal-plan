/**
 * Hook `PostToolUse` Claude Code — warstwa 1 lokalnych bramek jakości.
 *
 * Odpala się po każdej edycji pliku (`Edit` / `Write` / `MultiEdit`) i sprawdza **tylko ten
 * plik** regułami z `scripts/check-conventions.js`. Kod wyjścia 2 jest umowny: Claude Code
 * wstrzykuje wtedy `stderr` z powrotem do kontekstu agenta, więc agent poprawia naruszenie
 * w następnej iteracji, zamiast dowiedzieć się o nim z czerwonego commita kilkanaście minut
 * później.
 *
 * Dlaczego tu nie ma `eslint` ani `tsc`: jedno uruchomienie `eslint` na pojedynczym pliku
 * trwa w tym repo ~8 s, a `tsc --noEmit` ~9 s. Hook blokuje agenta na czas działania, więc
 * ten koszt jest zepchnięty do warstwy 2 (`hooks/pre-commit`) i 3 (`hooks/pre-push`).
 * Ta warstwa ma być niezauważalna — cały `src/` przechodzi w ~0,14 s.
 *
 * Wejście: JSON na stdin (`{ tool_name, tool_input: { file_path } , … }`).
 * Wyjście: 0 = czysto albo plik spoza zakresu, 2 = naruszenie (opis na stderr).
 * Hook nigdy nie wywraca się na własnym błędzie — awaria narzędzia nie może blokować pracy.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

try {
  const raw = await readStdin();
  const payload = raw.trim() ? JSON.parse(raw) : {};
  const filePath = payload?.tool_input?.file_path;
  if (!filePath) process.exit(0);

  const relative = path.relative(repoRoot, path.resolve(filePath)).split(path.sep).join('/');
  // Poza `src/` (albo poza repo) nie ma czego sprawdzać tą warstwą.
  if (relative.startsWith('..') || !relative.startsWith('src/') || !/\.(ts|tsx)$/.test(relative)) {
    process.exit(0);
  }

  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, 'scripts', 'check-conventions.js'), relative],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  if (result.status === 0) process.exit(0);

  process.stderr.write(
    `${(result.stderr || result.stdout || '').trim()}\n\n` +
      'Popraw ten plik, zanim przejdziesz dalej. Reguły opisuje CLAUDE.md.\n',
  );
  process.exit(2);
} catch {
  // Awaria hooka nie ma prawa zatrzymać pracy — cichy sukces, bramka i tak powtórzy się
  // przed commitem i przed pushem.
  process.exit(0);
}
