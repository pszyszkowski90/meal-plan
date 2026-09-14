/**
 * Generuje SQL zasiewający SKŁADNIKI i GRUPY WYKLUCZENIOWE z destylatu USDA.
 *
 * **Zastąpił `scripts/seed-ingredients.mjs`**, który trzymał makra wpisane w kodzie. Tamte liczby
 * pochodziły z pamięci modelu, nie z tabeli USDA, i **osiem z trzydziestu pięciu nie zgadzało się
 * z żadnym wierszem** — najgorzej boczek (541 kcal wobec 393) i krewetki (20,1 g białka wobec
 * 13,6). Przeszły sito Atwatera, bo były wewnętrznie spójne; sito łapie błędy mapowania rzędu
 * ×10, nie liczby wymyślone konsekwentnie. Dwa źródła makr w repo znaczyłyby, że następne
 * uruchomienie starego skryptu po cichu przywraca te wartości — dlatego zostało jedno.
 *
 * Uruchomienie — skrypt PISZE NA STDOUT, niczego sam nie stosuje:
 *
 *   npm run distill:usda                                # gdy zmieniło się mapowanie
 *   npm run --silent import:usda > .wrangler/ingredients.sql
 *   npx wrangler d1 execute mealplan --local  --file .wrangler/ingredients.sql
 *   npx wrangler d1 execute mealplan --remote --file .wrangler/ingredients.sql
 *
 * **`--silent` nie jest ozdobą.** Bez niego `npm run` dokłada na STDOUT własny nagłówek
 * („> meal-plan@1.0.0 import:usda"), który ląduje w pliku `.sql` jako pierwsze dwie linie
 * i wywraca całość na `near ">": syntax error at offset 1`. Zmierzone 14.09.2026 — i gorsze,
 * niż wygląda: przy `2>/dev/null` błąd nie jest widoczny, więc przebieg wygląda na udany.
 * Wywołanie wprost przez `node ./scripts/import-usda.mjs` jest wolne od tej pułapki.
 *
 * Rozdzielenie generowania od stosowania jest celowe: wynik da się przeczytać przed wysłaniem
 * na produkcję, a skrypt nie potrzebuje żadnych poświadczeń.
 *
 * **Idempotentnie, ale NIE „or ignore" na makrach.** Składnik jest identyfikowany nazwą;
 * `on conflict(name) do update` nadpisuje makra, `usda_fdc_id` i kategorię. Poprzednik używał
 * `INSERT OR IGNORE`, więc korekta makr nigdy by nie doszła do bazy, która już ma ten wiersz —
 * a to jest dokładnie ta operacja, dla której ten skrypt powstał.
 *
 * **Sito Atwatera jest REALNE, nie przepisane.** Skrypt importuje `atwaterWithinTolerance`
 * i `DishBounds` z `src/lib/` — te same, których użyje walidacja dania. Kopia progu rozjechałaby
 * się przy pierwszej korekcie i zasiała składniki, których walidator nie przyjmie.
 */
import fs from 'node:fs';
import path from 'node:path';

import { atwaterKcal, atwaterWithinTolerance } from '../src/lib/dish-macros.ts';
import { DishBounds } from '../src/lib/dish-validation.ts';

const RepoRoot = path.resolve(import.meta.dirname, '..');
const MappingFile = path.join(RepoRoot, 'seed', 'ingredients.json');
const SubsetFile = path.join(RepoRoot, 'seed', 'usda-subset.json');

/** Apostrof w nazwie zamykałby literał SQL — jedyne miejsce, które tu czegokolwiek dotyka. */
function quote(text) {
  return `'${String(text).replace(/'/g, "''")}'`;
}

function fail(message, details) {
  console.error(`import-usda: ${message}`);
  for (const detail of details) {
    console.error(`  - ${detail}`);
  }
  process.exit(1);
}

/**
 * Przerywa generowanie, gdy którykolwiek wiersz nie domyka się na współczynnikach Atwatera,
 * wskazuje nieistniejącą grupę albo nie ma makr w destylacie. Seed z błędem mapowania jest
 * gorszy niż brak seeda, bo makra są wejściem guardraila ±10%.
 */
function verify(mapping, macrosByFdcId) {
  const knownGroups = new Set(mapping.groups.map((group) => group.slug));
  const problems = [];

  for (const item of mapping.ingredients) {
    const macros = macrosByFdcId.get(item.fdcId);

    if (!macros) {
      problems.push(
        `${item.name}: fdcId ${item.fdcId} nie ma w destylacie — uruchom \`npm run distill:usda\`.`,
      );
      continue;
    }

    if (!atwaterWithinTolerance(macros, DishBounds.atwaterTolerance, DishBounds.atwaterFloorKcal)) {
      problems.push(
        `${item.name}: ${macros.kcal} kcal, a z makr wychodzi ${atwaterKcal(macros).toFixed(1)} kcal`,
      );
    }

    for (const slug of item.groups) {
      if (!knownGroups.has(slug)) {
        problems.push(`${item.name}: nieznana grupa „${slug}"`);
      }
    }
  }

  const names = mapping.ingredients.map((item) => item.name);
  if (new Set(names).size !== names.length) {
    problems.push('powtórzona nazwa składnika — `ingredient.name` jest UNIQUE');
  }

  const ids = mapping.ingredients.map((item) => item.fdcId);
  if (new Set(ids).size !== ids.length) {
    problems.push('dwa składniki wskazują ten sam `fdcId` — to zawsze pomyłka w mapowaniu');
  }

  if (problems.length > 0) {
    fail('wiersze nie do zasiania:', problems);
  }
}

function generate(mapping, macrosByFdcId, descriptionByFdcId) {
  const lines = [
    '-- WYGENEROWANE przez scripts/import-usda.mjs — nie edytuj ręcznie.',
    '-- Makra: USDA FoodData Central SR Legacy 2018-04, na 100 g produktu w stanie z `description`.',
    `-- Składników: ${mapping.ingredients.length}, grup wykluczeniowych: ${mapping.groups.length}.`,
    '',
  ];

  for (const group of mapping.groups) {
    lines.push(
      `INSERT OR IGNORE INTO exclusion_group (slug, name) VALUES (${quote(group.slug)}, ${quote(group.name)});`,
    );
  }
  lines.push('');

  /*
   * Zmiana nazwy idzie PRZED wstawieniem i jest osobnym krokiem, bo nazwa jest tożsamością
   * składnika. Bez tego przemianowany składnik wjechałby jako NOWY wiersz, a stary — z błędnymi
   * makrami i cudzymi wykluczeniami wskazującymi jego `id` — zostałby w bazie na zawsze.
   * Dwie pozycje przeszły przez to 14.09.2026: „twaróg półtłusty" nazywał produkt, którego
   * w USDA nie ma (wiersz opisuje serek typu cottage), a „tuńczyk w wodzie, z puszki" nie mówił,
   * że wiersz dotyczy odsączonych kawałków.
   */
  const renames = mapping.ingredients.filter((item) => item.previousNames?.length);
  if (renames.length > 0) {
    lines.push('-- Zmiany nazw: nazwa jest tożsamością składnika, więc idą PRZED wstawieniem.');
    for (const item of renames) {
      for (const previous of item.previousNames) {
        lines.push(
          `UPDATE OR IGNORE ingredient SET name = ${quote(item.name)} WHERE name = ${quote(previous)};`,
        );
      }
    }
    lines.push('');
  }

  for (const item of mapping.ingredients) {
    const macros = macrosByFdcId.get(item.fdcId);
    lines.push(
      `-- ${descriptionByFdcId.get(item.fdcId)}`,
      'INSERT INTO ingredient (name, usda_fdc_id, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, category)',
      `VALUES (${quote(item.name)}, ${item.fdcId}, ${macros.kcal}, ${macros.protein}, ${macros.carbs}, ${macros.fat}, ${quote(item.category)})`,
      'ON CONFLICT(name) DO UPDATE SET',
      '  usda_fdc_id = excluded.usda_fdc_id,',
      '  kcal_per_100g = excluded.kcal_per_100g,',
      '  protein_per_100g = excluded.protein_per_100g,',
      '  carbs_per_100g = excluded.carbs_per_100g,',
      '  fat_per_100g = excluded.fat_per_100g,',
      '  category = excluded.category;',
    );
  }
  lines.push('');

  // Podzapytania zamiast wpisanych na sztywno identyfikatorów: `ingredient.id` jest
  // AUTOINCREMENT i różni się między środowiskiem lokalnym a produkcją.
  for (const item of mapping.ingredients) {
    for (const slug of item.groups) {
      lines.push(
        'INSERT OR IGNORE INTO ingredient_group (ingredient_id, group_id) VALUES (',
        `  (SELECT id FROM ingredient WHERE name = ${quote(item.name)}),`,
        `  (SELECT id FROM exclusion_group WHERE slug = ${quote(slug)})`,
        ');',
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const mapping = JSON.parse(fs.readFileSync(MappingFile, 'utf8'));
  const subset = JSON.parse(fs.readFileSync(SubsetFile, 'utf8'));

  const macrosByFdcId = new Map(subset.items.map((item) => [item.fdcId, item.per100g]));
  const descriptionByFdcId = new Map(subset.items.map((item) => [item.fdcId, item.description]));

  verify(mapping, macrosByFdcId);
  process.stdout.write(generate(mapping, macrosByFdcId, descriptionByFdcId));
}

main();
