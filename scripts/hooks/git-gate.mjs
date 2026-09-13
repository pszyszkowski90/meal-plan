/**
 * Warstwy 2 i 3 lokalnych bramek jakości — treść hooków `hooks/pre-commit` i `hooks/pre-push`.
 *
 * Logika siedzi w Node, a nie w `sh`, z jednego powodu: to repo jest rozwijane na Windowsie,
 * a `node` jest tu jedyną powłoką, która zachowuje się tak samo wszędzie. Pliki w `hooks/` to
 * dwie linijki, które wołają ten moduł.
 *
 * Podział pracy między warstwami — każda łapie to, co przepuściła poprzednia:
 *   warstwa 1 (hook Claude Code, po edycji) — reguły repo na jednym pliku, ~0,14 s
 *   warstwa 2 (`pre-commit`, tylko indeks)  — reguły repo + `eslint` na plikach z indeksu,
 *                                             `npm test` gdy ruszony `src/lib/`, `check-lock`
 *                                             gdy ruszone zależności; ~10 s
 *   warstwa 3 (`pre-push`, całe drzewo)     — `tsc --noEmit`, `npm test`, reguły repo,
 *                                             `check-lock`; ~12 s
 *
 * Żadna z nich nie zastępuje CI (Workers Builds na `main`) — stoją przed nim, żeby czerwony
 * build był rzadkością, a nie sposobem dowiadywania się o literówce.
 *
 * Instalacja: `npm run hooks:install` (ustawia `core.hooksPath` na `hooks/`).
 * Wyłączenie jednorazowe: `git commit --no-verify` / `git push --no-verify`.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');
const mode = process.argv[2];

const failures = [];

/**
 * Uruchamia krok bramki, wypisuje wynik z czasem i zapamiętuje niepowodzenie.
 *
 * `spawn` odróżnia dwa rodzaje porażki i **musi** je rozróżniać na wyjściu: kod ≠ 0 znaczy
 * „narzędzie znalazło problem", a `result.error` znaczy „narzędzie w ogóle się nie uruchomiło".
 * Bez tego rozróżnienia bramka pokazuje FAIL w 0,0 s i wygląda jak znaleziony błąd, choć
 * niczego nie sprawdziła — czyli kłamie w najgorszą stronę.
 */
function gate(label, command, args, { shell = false } = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell,
    encoding: 'utf8',
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (result.error) {
    process.stdout.write(` BŁĄD  ${label} — nie udało się uruchomić: ${result.error.code}\n`);
    failures.push(`${label} (nie uruchomiono)`);
    return false;
  }

  const ok = result.status === 0;
  process.stdout.write(`${ok ? '  ok  ' : ' FAIL '} ${label} (${seconds}s)\n`);
  if (!ok) failures.push(label);
  return ok;
}

/**
 * Krok uruchamiany przez powłokę. Node 25 na Windowsie odmawia `spawn` na plikach `.cmd`
 * bez `shell: true` (EINVAL po poprawce CVE-2024-27980), a `npm` i `npx` są tam właśnie
 * `.cmd`-ami. Jeden gotowy łańcuch zamiast tablicy argumentów, żeby nie budzić DEP0190.
 */
const shellGate = (label, commandLine) => gate(label, commandLine, undefined, { shell: true });

/** Cudzysłowy wokół ścieżki — katalog tego repo ma spację w nazwie. */
const quote = (file) => `"${file}"`;

/** Ścieżki z indeksu (dodane/skopiowane/zmodyfikowane/przeniesione — bez usuniętych). */
function stagedFiles() {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return (result.stdout || '').split('\0').filter(Boolean);
}

const isSourceFile = (f) => /^src\/.*\.(ts|tsx)$/.test(f);

if (mode === 'pre-commit') {
  const staged = stagedFiles();
  if (staged.length === 0) process.exit(0);

  process.stdout.write(`\nBramka pre-commit — ${staged.length} plików w indeksie\n`);

  gate('reguły repo', process.execPath, ['scripts/check-conventions.js', ...staged]);

  const sources = staged.filter(isSourceFile);
  // `--max-warnings=0`, bo domyślnie `eslint` kończy się zerem mimo ostrzeżeń — bramka,
  // która widzi problem i przepuszcza commit, jest gorsza niż jej brak. Całe `src/` przechodzi
  // dziś bez ani jednego ostrzeżenia, więc ten próg nic nie blokuje wstecz.
  if (sources.length > 0)
    shellGate('eslint', ['npx eslint --max-warnings=0', ...sources.map(quote)].join(' '));

  if (staged.some((f) => f === 'package.json' || f === 'package-lock.json')) {
    gate('spójność lockfile', process.execPath, ['scripts/check-lockfile.js']);
  }

  // Testy jednostkowe obejmują wyłącznie czyste moduły z `src/lib/` — poza nimi nic nie wnoszą,
  // a 1,6 s na każdym commicie dokumentacji byłoby podatkiem bez pokrycia.
  if (staged.some((f) => f.startsWith('src/lib/'))) {
    shellGate('testy jednostkowe', 'npm test');
  }
} else if (mode === 'pre-push') {
  process.stdout.write('\nBramka pre-push — całe drzewo\n');
  gate('reguły repo', process.execPath, ['scripts/check-conventions.js']);
  shellGate('typy', 'npx tsc --noEmit');
  shellGate('testy jednostkowe', 'npm test');
  gate('spójność lockfile', process.execPath, ['scripts/check-lockfile.js']);
} else {
  process.stderr.write(`git-gate: nieznany tryb "${mode}" (oczekiwane: pre-commit | pre-push)\n`);
  process.exit(1);
}

if (failures.length > 0) {
  process.stderr.write(
    `\nBramka zatrzymała operację: ${failures.join(', ')}.\n` +
      `Napraw albo — świadomie — pomiń przez --no-verify.\n`,
  );
  process.exit(1);
}

process.stdout.write('Bramka przeszła.\n');
