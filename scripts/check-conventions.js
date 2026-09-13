/**
 * Deterministyczna bramka reguł tego repozytorium — te z `CLAUDE.md`, których nie złapie
 * ani `eslint`, ani `tsc`, bo nie są regułami języka, tylko decyzjami architektonicznymi
 * (granica SQL-a, jedno miejsce na `globalThis`, zakaz `../`, parzystość zakładek).
 *
 * Uruchamiana w trzech warstwach, każda tańsza od pomyłki, którą łapie:
 *   1. hook `PostToolUse` po każdej edycji pliku    → `node scripts/check-conventions.js <plik>`
 *   2. `hooks/pre-commit` na plikach z indeksu      → to samo, lista plików
 *   3. `hooks/pre-push` na całym drzewie            → `npm run check-conventions`
 *
 * Bez argumentów sprawdza całe `src/` plus reguły całego repozytorium (parzystość zakładek,
 * pary migracji, położenie routera). Z argumentami sprawdza wyłącznie podane pliki — wtedy
 * reguły repozytorium uruchamiają się tylko, gdy dotyczy ich któryś z podanych plików.
 *
 * Kod wyjścia: 0 = czysto, 1 = znaleziono naruszenia (wypisane na stderr).
 *
 * Nowa reguła: dopisz wpis do `FILE_RULES` (na plik) albo `REPO_RULES` (na repozytorium).
 * Warunek przyjęcia: **całe obecne drzewo musi ją przechodzić**. Reguła czerwona w dniu
 * dodania jest szumem, nie bramką — albo napraw drzewo, albo wpisz wyjątek z powodem.
 */
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const rel = (p) => path.relative(repoRoot, p).split(path.sep).join('/');

/**
 * Zamienia komentarze na spacje, zachowując numerację linii i **zostawiając stringi**
 * (reguła o surowych kolorach czyta właśnie stringi).
 *
 * Skaner, nie regex, bo naiwny `grep` kłamie w obie strony: `profile+api.ts` ma w komentarzu
 * zdanie „Zero `prepare(`", a wszystkie trzy wystąpienia `useCallback` w tym repo żyją
 * wyłącznie w komentarzach tłumaczących, czemu ich nie ma. Bez tego kroku bramka byłaby
 * czerwona na czystym drzewie.
 */
function stripComments(src) {
  const n = src.length;
  const regexCanStart = (c) => c === '' || '(,=:[!&|?{};+-*%<>~^'.includes(c);
  let out = '';
  let i = 0;
  let prev = '';

  while (i < n) {
    const c = src[i];
    const d = src[i + 1];

    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && d === '*') {
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += '  ';
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      out += c;
      i++;
      while (i < n) {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += src[i];
        const end = src[i] === c;
        i++;
        if (end) break;
      }
      prev = c;
      continue;
    }
    if (c === '/' && regexCanStart(prev)) {
      out += c;
      i++;
      while (i < n) {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += src[i];
        const end = src[i] === '/' || src[i] === '\n';
        i++;
        if (end) break;
      }
      prev = '/';
      continue;
    }

    out += c;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

/** Numery linii (1-based) wszystkich trafień wzorca. */
function hits(code, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
  const re = new RegExp(pattern.source, flags);
  const found = [];
  let m;
  while ((m = re.exec(code)) !== null) {
    found.push({ line: code.slice(0, m.index).split('\n').length, text: m[0] });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return found;
}

const under = (relPath, dir) => relPath.startsWith(dir);

/** Reguły na pojedynczy plik. `skip` zwraca true dla udokumentowanych wyjątków. */
const FILE_RULES = [
  {
    id: 'import-parent',
    pattern: /(?:from|import|require\()\s*['"]\.\.\//,
    message: 'import przez `../` — użyj aliasu `@/…`',
  },
  {
    id: 'manual-memo',
    pattern: /\b(?:useMemo|useCallback|React\.memo)\s*\(/,
    message: 'ręczna memoizacja — `reactCompiler` robi to sam',
  },
  {
    id: 'color-scheme-import',
    // Wyjątki udokumentowane w CLAUDE.md: sam hook webowy i dwa komponenty, które go jeszcze nie używają.
    skip: (r) =>
      r === 'src/hooks/use-color-scheme.web.ts' ||
      r === 'src/components/app-tabs.tsx' ||
      r === 'src/components/web-badge.tsx',
    pattern: /import\s*\{[^}]*\buseColorScheme\b[^}]*\}\s*from\s*['"]react-native['"]/,
    message: '`useColorScheme` z `react-native` — weź z `@/hooks/use-color-scheme`',
  },
  {
    id: 'sql-outside-repository',
    skip: (r) => under(r, 'src/server/repository/') || r === 'src/app/api/health+api.ts',
    pattern: /\.prepare\s*\(/,
    message: 'SQL poza `src/server/repository/` — przenieś zapytanie do repozytorium',
  },
  {
    id: 'worker-env-in-route',
    applies: (r) => under(r, 'src/app/api/') && r !== 'src/app/api/health+api.ts',
    pattern: /\bgetWorkerEnv\s*\(/,
    message: '`getWorkerEnv()` w trasie API — bindingi bierze repozytorium',
  },
  {
    id: 'global-this',
    skip: (r) => r === 'src/server/env.ts',
    pattern: /\bglobalThis\b/,
    message: '`globalThis` poza `src/server/env.ts`',
  },
  {
    id: 'screen-fetch',
    applies: (r) => under(r, 'src/app/') || under(r, 'src/components/'),
    pattern: /(?<!authed)\bfetch\s*\(/,
    message: 'bezpośredni `fetch` w ekranie — użyj `useAuthedFetch()` / `src/lib/api.ts`',
  },
  {
    id: 'raw-color',
    // Dwa wyjątki to kod ze scaffoldu Expo (gradient splashu i kolor linku), nie nowy dług.
    skip: (r) =>
      r === 'src/constants/theme.ts' ||
      r === 'src/components/animated-icon.tsx' ||
      r === 'src/components/themed-text.tsx',
    pattern: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/,
    message: 'surowy kolor — weź z `useTheme()` / `Colors`',
  },
];

function checkFile(absPath) {
  const r = rel(absPath);
  if (!/\.(ts|tsx)$/.test(r) || !under(r, 'src/')) return [];
  const code = stripComments(fs.readFileSync(absPath, 'utf8'));
  const out = [];
  for (const rule of FILE_RULES) {
    if (rule.applies && !rule.applies(r)) continue;
    if (rule.skip && rule.skip(r)) continue;
    for (const hit of hits(code, rule.pattern)) {
      out.push({ file: r, line: hit.line, id: rule.id, message: rule.message });
    }
  }
  return out;
}

/** Reguły całego repozytorium — nie da się ich sprawdzić, patrząc na jeden plik. */
const REPO_RULES = [
  {
    id: 'tab-parity',
    touches: (files) => files.some((f) => f.startsWith('src/components/app-tabs')),
    run() {
      const nativePath = path.join(repoRoot, 'src/components/app-tabs.tsx');
      const webPath = path.join(repoRoot, 'src/components/app-tabs.web.tsx');
      if (!fs.existsSync(nativePath) || !fs.existsSync(webPath)) return [];
      const native = stripComments(fs.readFileSync(nativePath, 'utf8'));
      const web = stripComments(fs.readFileSync(webPath, 'utf8'));
      // Natywnie `name` to nazwa pliku trasy; `index` odpowiada trasie `/`.
      const nativeRoutes = hits(native, /<NativeTabs\.Trigger\s+name="([^"]+)"/).map((h) => {
        const name = /name="([^"]+)"/.exec(h.text)[1];
        return name === 'index' ? '/' : `/${name}`;
      });
      // Na webie `name` jest dowolne — trasę wiąże `href`.
      const webRoutes = hits(web, /<TabTrigger\b[^>]*href="([^"]+)"/).map(
        (h) => /href="([^"]+)"/.exec(h.text)[1],
      );
      const out = [];
      for (const route of nativeRoutes) {
        if (!webRoutes.includes(route)) {
          out.push({
            file: 'src/components/app-tabs.web.tsx',
            line: 1,
            id: 'tab-parity',
            message: `zakładka \`${route}\` istnieje natywnie, nie ma jej na webie`,
          });
        }
      }
      for (const route of webRoutes) {
        if (!nativeRoutes.includes(route)) {
          out.push({
            file: 'src/components/app-tabs.tsx',
            line: 1,
            id: 'tab-parity',
            message: `zakładka \`${route}\` istnieje na webie, nie ma jej natywnie`,
          });
        }
      }
      return out;
    },
  },
  {
    id: 'migration-pair',
    touches: (files) => files.some((f) => f.startsWith('migrations/')),
    run() {
      const dir = path.join(repoRoot, 'migrations');
      const downDir = path.join(dir, 'down');
      if (!fs.existsSync(dir)) return [];
      const up = fs.readdirSync(dir).filter((f) => f.endsWith('.sql'));
      const down = fs.existsSync(downDir)
        ? fs.readdirSync(downDir).filter((f) => f.endsWith('.sql'))
        : [];
      const out = [];
      for (const f of up) {
        const expected = f.replace(/\.sql$/, '.down.sql');
        if (!down.includes(expected)) {
          out.push({
            file: `migrations/${f}`,
            line: 1,
            id: 'migration-pair',
            message: `brak migracji wstecz \`migrations/down/${expected}\``,
          });
        }
      }
      for (const f of down) {
        const expected = f.replace(/\.down\.sql$/, '.sql');
        if (!up.includes(expected)) {
          out.push({
            file: `migrations/down/${f}`,
            line: 1,
            id: 'migration-pair',
            message: `migracja wstecz bez migracji w przód \`migrations/${expected}\``,
          });
        }
      }
      return out;
    },
  },
  {
    id: 'router-location',
    touches: () => true,
    run() {
      const strayDir = path.join(repoRoot, 'app');
      if (!fs.existsSync(strayDir)) return [];
      const stray = fs.readdirSync(strayDir).filter((f) => /\.(ts|tsx)$/.test(f));
      if (stray.length === 0) return [];
      return [
        {
          file: 'app/',
          line: 1,
          id: 'router-location',
          message: 'trasy w `app/` — router tego repo mieszka w `src/app/`',
        },
      ];
    },
  },
];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const args = process.argv.slice(2).filter((a) => a !== '--all');
const explicit = args.length > 0;
const files = explicit
  ? args
      .map((a) => path.resolve(repoRoot, a))
      .filter((p) => fs.existsSync(p) && fs.statSync(p).isFile())
  : walk(path.join(repoRoot, 'src'));

const relFiles = (explicit ? args.map((a) => rel(path.resolve(repoRoot, a))) : files.map(rel)).map(
  (f) => f.split(path.sep).join('/'),
);

const problems = [];
for (const f of files) problems.push(...checkFile(f));
for (const rule of REPO_RULES) {
  if (explicit && !rule.touches(relFiles)) continue;
  problems.push(...rule.run());
}

if (problems.length === 0) {
  if (!explicit) console.log(`check-conventions: czysto (${files.length} plików)`);
  process.exit(0);
}

problems.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
console.error('Naruszenia reguł z CLAUDE.md:\n');
for (const p of problems) console.error(`  ${p.file}:${p.line}  [${p.id}]  ${p.message}`);
console.error(
  `\n${problems.length} naruszeń. Reguły opisuje CLAUDE.md; definicje: scripts/check-conventions.js`,
);
process.exit(1);
