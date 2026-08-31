/**
 * Sprawdza, czy package-lock.json jest wewnętrznie spójny — dokładnie to samo, co robi `npm ci`
 * przed instalacją. Istnieje, bo `npm install` na Windowsie produkuje lock, który przechodzi
 * lokalnie i pada na Linuksie: npm zapisuje wpisy pakietów `*-wasm32*` (np. `@img/sharp-wasm32`,
 * `@unrs/resolver-binding-wasm32-wasi`), ale pomija ich zależności `@emnapi/*`, bo `cpu: ["wasm32"]`
 * nie pasuje do hosta. `npm ci` na Linuksie przerywa wtedy z EUSAGE i build w Workers Builds nie
 * dochodzi nawet do `expo export`.
 *
 * Naprawa niespójności: wygeneruj lock na Linuksie, zasiewając go obecnym lockiem, żeby nie
 * zdryfowały wersje ani nie zginęły sumy kontrolne:
 *
 *   docker run --rm -v "<repo>":/src:ro -v "<tmp>":/out node:24 sh -c \
 *     'mkdir /w && cp /src/package.json /src/package-lock.json /w/ && cd /w \
 *      && npm install --package-lock-only && cp package-lock.json /out/'
 *
 * Potem `npm ci` (nie `npm install`) lokalnie, żeby nie nadpisać poprawki.
 */
const fs = require('node:fs');
const path = require('node:path');

const lockPath = process.argv[2] || path.join(__dirname, '..', 'package-lock.json');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const pkgs = lock.packages;

/** Rozwiązuje nazwę pakietu regułami hoistingu npm: od katalogu pakietu w górę do korzenia. */
function resolve(fromPath, name) {
  let base = fromPath;
  for (;;) {
    if (`${base ? `${base}/` : ''}node_modules/${name}` in pkgs) return true;
    if (!base) return false;
    const i = base.lastIndexOf('/node_modules/');
    base = i === -1 ? '' : base.slice(0, i);
  }
}

const missing = [];
for (const [p, meta] of Object.entries(pkgs)) {
  const deps = { ...(meta.dependencies || {}), ...(meta.optionalDependencies || {}) };
  for (const [name, range] of Object.entries(deps)) {
    if (!resolve(p, name)) missing.push({ from: p || '(root)', name, range });
  }
}

const withoutIntegrity = Object.entries(pkgs).filter(
  ([p, m]) => p !== '' && !m.integrity && !m.link
).length;

if (missing.length) {
  console.error(`package-lock.json NIESPÓJNY: ${missing.length} nierozwiązywalnych zależności`);
  for (const m of missing) console.error(`  Missing: ${m.name}@${m.range} — wymagane przez ${m.from}`);
  console.error('\n`npm ci` padnie na Linuksie. Naprawa: patrz komentarz w tym pliku.');
  process.exit(1);
}

console.log(`package-lock.json spójny — ${Object.keys(pkgs).length} pakietów, ` +
  `${withoutIntegrity} bez sumy kontrolnej`);
