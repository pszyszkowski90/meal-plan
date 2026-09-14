/**
 * Generuje SQL zasiewający DANIA z plików `seed/dishes/*.json`.
 *
 * Uruchomienie — skrypt PISZE PLIK, nie stosuje go:
 *
 *   node ./scripts/seed-dishes.mjs --local    # → .wrangler/dishes.sql
 *   npx wrangler d1 execute mealplan --local  --file .wrangler/dishes.sql
 *
 *   node ./scripts/seed-dishes.mjs --remote   # wymaga `reviewedBy` przy KAŻDYM daniu
 *   npx wrangler d1 execute mealplan --remote --file .wrangler/dishes.sql
 *
 * **Dlaczego plik, a nie stdout** — w odróżnieniu od `import-usda.mjs`. Wynik ma polskie znaki
 * w każdej nazwie i każdym kroku, a przekierowanie powłoki na Windowsie dokłada BOM i psuje
 * kodowanie. `fs.writeFileSync(..., 'utf8')` jest jedyną drogą, która tego nie robi — przy okazji
 * omija pułapkę z nagłówkiem `npm run`, opisaną w `import-usda.mjs`.
 *
 * **Walidacja jest POŻYCZONA, nie przepisana.** Skrypt woła `validateDish` z `src/lib/` — ten sam
 * moduł, który zna progi Atwatera, energii porcji i gęstości. Kopia progów w skrypcie rozjechałaby
 * się przy pierwszej korekcie i zasiała dania, których walidator nie przyjmuje. Import relatywny
 * z jawnym `.ts`, bo Node zdejmuje typy, ale nie zna aliasu `@/` (tak samo jak `npm test`).
 *
 * **Przy jakimkolwiek błędzie nie powstaje NIC.** Nie „zasiejemy 18 z 20 i wypiszemy dwa błędy":
 * pula z dziurą jest gorsza niż brak puli, bo generator planu (S-04) nie ma jak zauważyć, że
 * czegoś brakuje, a guardrail ±10% liczy się z tego, co zastał.
 */
import fs from 'node:fs';
import path from 'node:path';

import { validateDish } from '../src/lib/dish-validation.ts';

const RepoRoot = path.resolve(import.meta.dirname, '..');
const DishesDir = path.join(RepoRoot, 'seed', 'dishes');
const MappingFile = path.join(RepoRoot, 'seed', 'ingredients.json');
const SubsetFile = path.join(RepoRoot, 'seed', 'usda-subset.json');
const OutputFile = path.join(RepoRoot, '.wrangler', 'dishes.sql');

/**
 * Rozjazd deklaracji autora od wyliczenia z USDA, powyżej którego danie jest ODRZUCANE.
 *
 * Nie „zaokrąglane w dół" i nie „do ręcznego sprawdzenia" — odrzucane. Przy progu ±10% na dzień
 * danie rozjeżdżające się o jedną piątą jest błędem gramatury albo błędem mapowania składnika,
 * a jedno i drugie psuje plan w sposób, którego użytkownik nie zobaczy.
 */
const HintTolerance = 0.2;

/** Apostrof w nazwie zamykałby literał SQL — jedyne miejsce, które tu czegokolwiek dotyka. */
function quote(text) {
  return `'${String(text).replace(/'/g, "''")}'`;
}

function fail(message, details = []) {
  console.error(`seed-dishes: ${message}`);
  for (const detail of details) {
    console.error(`  - ${detail}`);
  }
  process.exit(1);
}

function readJson(file, hint) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`nie dało się przeczytać ${path.relative(RepoRoot, file)}:`, [error.message, hint]);
  }
}

function parseMode(argv) {
  const local = argv.includes('--local');
  const remote = argv.includes('--remote');

  if (local === remote) {
    fail('podaj dokładnie jeden tryb: --local albo --remote.');
  }
  return remote ? 'remote' : 'local';
}

/** Składniki znane bazie — z tych samych dwóch plików, z których zasiano tabelę `ingredient`. */
function knownIngredients() {
  const mapping = readJson(
    MappingFile,
    'To plik wersjonowany w repozytorium — jego brak zwykle znaczy zły katalog roboczy.',
  );
  const subset = readJson(SubsetFile, 'Destylat powstaje z `npm run distill:usda`.');
  const byFdcId = new Map(subset.items.map((item) => [item.fdcId, item.per100g]));

  return mapping.ingredients.map((item) => {
    const per100g = byFdcId.get(item.fdcId);
    if (!per100g) {
      fail(`składnik „${item.name}" nie ma makr w destylacie.`, [
        'Uruchom `npm run distill:usda`.',
      ]);
    }
    return { name: item.name, per100g };
  });
}

function loadDishes() {
  if (!fs.existsSync(DishesDir)) {
    fail(`nie ma katalogu ${path.relative(RepoRoot, DishesDir)}.`);
  }

  const files = fs.readdirSync(DishesDir).filter((file) => file.endsWith('.json')).sort();
  if (files.length === 0) {
    fail(`${path.relative(RepoRoot, DishesDir)} jest pusty — nie ma czego zasiać.`);
  }

  return files.map((file) => ({
    file,
    slug: path.basename(file, '.json'),
    raw: readJson(path.join(DishesDir, file), 'Plik dania jest w repozytorium.'),
  }));
}

/**
 * Orzeka o CAŁEJ puli naraz i zwraca pełną listę problemów.
 *
 * Akumulacja, nie pierwszy błąd: autor przepisów ma zobaczyć wszystko do poprawienia w jednym
 * przebiegu, a nie odkrywać po jednym błędzie na uruchomienie.
 */
function validateAll(dishes, ingredients, mode) {
  const problems = [];
  const accepted = [];
  const seenSlugs = new Set();

  for (const { file, slug, raw } of dishes) {
    const label = `${file}`;

    // Nazwa pliku JEST tożsamością dania. Rozjazd z polem `slug` znaczy, że ktoś skopiował plik
    // i zapomniał zmienić jedno z dwóch — a wtedy `on conflict(slug)` nadpisze cudze danie.
    if (raw.slug !== slug) {
      problems.push(`${label}: pole slug to „${raw.slug}", a nazwa pliku mówi „${slug}".`);
      continue;
    }
    if (seenSlugs.has(slug)) {
      problems.push(`${label}: slug „${slug}" powtarza się.`);
      continue;
    }
    seenSlugs.add(slug);

    /*
     * BRAMKA PRZEGLĄDU — jedyne miejsce, w którym decyzja D14 ma techniczne oparcie zamiast
     * dyscypliny. Lokalnie wolno seedować danie nieprzejrzane (praca w toku), na produkcję —
     * nigdy. `seed/REVIEW.md` zostaje narracją, ale przestaje być jedynym mechanizmem.
     */
    if (mode === 'remote') {
      if (typeof raw.reviewedBy !== 'string' || raw.reviewedBy.trim() === '') {
        problems.push(
          `${label}: brak pola „reviewedBy" — na produkcję idą wyłącznie dania przejrzane.`,
        );
      }
      if (typeof raw.reviewedAt !== 'string' || raw.reviewedAt.trim() === '') {
        problems.push(`${label}: brak pola „reviewedAt".`);
      }
    }

    const result = validateDish(raw, ingredients);
    if (!result.ok) {
      for (const error of result.errors) {
        problems.push(`${label}: ${error}`);
      }
      continue;
    }

    /*
     * Sito deklaracji. `modelKcalHint` NIE jest prawdą o daniu i nigdy nie trafia do D1 — jest
     * deklaracją autora, zapisaną zanim policzył to skrypt. Rozjazd z wyliczeniem z USDA znaczy
     * błąd gramatury albo błąd mapowania składnika, więc danie wypada z puli, a nie dostaje
     * poprawionej gramatury pod sito.
     */
    if (typeof raw.modelKcalHint === 'number' && raw.modelKcalHint > 0) {
      const deviation = Math.abs(result.value.macros.kcal - raw.modelKcalHint) / raw.modelKcalHint;
      if (deviation > HintTolerance) {
        problems.push(
          `${label}: deklarowane ${raw.modelKcalHint} kcal, a z gramatur wychodzi ` +
            `${result.value.macros.kcal} kcal — rozjazd ${Math.round(deviation * 100)}% ` +
            `przy dopuszczalnych ${Math.round(HintTolerance * 100)}%.`,
        );
        continue;
      }
    }

    accepted.push({ ...result.value, raw, deviationSource: raw.modelKcalHint });
  }

  if (problems.length > 0) {
    fail(`${problems.length} problemów — NIE powstał żaden SQL:`, problems);
  }

  return accepted;
}

function generate(dishes) {
  const lines = [
    '-- WYGENEROWANE przez scripts/seed-dishes.mjs — nie edytuj ręcznie.',
    `-- Dań: ${dishes.length}. Makra NIE są zapisywane: liczy je src/lib/dish-macros.ts przy odczycie.`,
    '',
  ];

  for (const dish of dishes) {
    lines.push(
      `-- ${dish.name} — ${dish.macros.kcal} kcal`,
      'INSERT INTO dish (slug, name, prep_minutes, created_at)',
      `VALUES (${quote(dish.slug)}, ${quote(dish.name)}, ${dish.prepMinutes}, ` +
        `strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
      'ON CONFLICT(slug) DO UPDATE SET name = excluded.name, prep_minutes = excluded.prep_minutes;',
    );

    /*
     * Tabele potomne PRZEPISUJEMY W CAŁOŚCI, a nie dokładamy do nich.
     *
     * Bez `delete` usunięcie składnika z JSON-a zostawiłoby osierocony wiersz w `dish_ingredient`,
     * a danie po cichu zachowałoby stare, błędne kalorie — dokładnie ten tryb awarii, przed którym
     * chroni cała ta zmiana. Kaskada z `0003` jest tu normalną ścieżką, nie sytuacją awaryjną.
     */
    const dishId = `(SELECT id FROM dish WHERE slug = ${quote(dish.slug)})`;
    lines.push(
      `DELETE FROM dish_meal_slot WHERE dish_id = ${dishId};`,
      `DELETE FROM dish_ingredient WHERE dish_id = ${dishId};`,
      `DELETE FROM dish_step WHERE dish_id = ${dishId};`,
    );

    for (const slot of dish.mealSlots) {
      lines.push(
        `INSERT INTO dish_meal_slot (dish_id, meal_slot) VALUES (${dishId}, ${quote(slot)});`,
      );
    }

    for (const item of dish.ingredients) {
      lines.push(
        'INSERT INTO dish_ingredient (dish_id, ingredient_id, grams) VALUES (',
        `  ${dishId},`,
        `  (SELECT id FROM ingredient WHERE name = ${quote(item.ingredientName)}),`,
        `  ${item.grams}`,
        ');',
      );
    }

    for (const [index, step] of dish.steps.entries()) {
      lines.push(
        `INSERT INTO dish_step (dish_id, position, text) VALUES (${dishId}, ${index + 1}, ` +
          `${quote(step)});`,
      );
    }

    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function report(dishes) {
  const bySlot = {};
  for (const dish of dishes) {
    for (const slot of dish.mealSlots) {
      bySlot[slot] = (bySlot[slot] ?? 0) + 1;
    }
  }

  console.error(`seed-dishes: ${dishes.length} dań przyjętych.`);
  console.error(
    `  pory posiłku: ${Object.entries(bySlot)
      .map(([slot, count]) => `${slot} ${count}`)
      .join(', ')}`,
  );

  // Szeregowanie po ROZJEŹDZIE, nie po nazwie — to jest jedyny powód istnienia `modelKcalHint`.
  const withHint = dishes
    .filter((dish) => typeof dish.deviationSource === 'number' && dish.deviationSource > 0)
    .map((dish) => ({
      slug: dish.slug,
      kcal: dish.macros.kcal,
      hint: dish.deviationSource,
      deviation: Math.abs(dish.macros.kcal - dish.deviationSource) / dish.deviationSource,
    }))
    .sort((a, b) => b.deviation - a.deviation);

  if (withHint.length > 0) {
    console.error('  największe rozjazdy deklaracji autora (do przeglądu w pierwszej kolejności):');
    for (const entry of withHint.slice(0, 5)) {
      console.error(
        `    ${entry.slug}: deklarowane ${entry.hint}, wyliczone ${entry.kcal} ` +
          `(${Math.round(entry.deviation * 100)}%)`,
      );
    }
  }
}

function main() {
  const mode = parseMode(process.argv.slice(2));
  const dishes = validateAll(loadDishes(), knownIngredients(), mode);

  fs.mkdirSync(path.dirname(OutputFile), { recursive: true });
  fs.writeFileSync(OutputFile, generate(dishes), 'utf8');

  report(dishes);
  console.error(`  tryb: ${mode} → ${path.relative(RepoRoot, OutputFile)}`);
}

main();
