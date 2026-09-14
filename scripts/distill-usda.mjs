/**
 * Destyluje zbiorczy plik USDA do małego, WERSJONOWANEGO `seed/usda-subset.json`.
 *
 * Po co destylat, skoro można wołać API: przy 35 składnikach `DEMO_KEY` USDA (30 zapytań na
 * godzinę) nie starcza nawet na jeden przebieg, a klucz osobisty wprowadziłby poświadczenie tam,
 * gdzie ma go nie być. Zbiorczy plik jest deterministyczny, pobiera się raz i bez klucza, a jego
 * destylat da się zacommitować i przejrzeć — makra składników przestają być czymś, co trzeba
 * przyjąć na słowo.
 *
 * Uruchomienie (plik źródłowy pobiera CZŁOWIEK, raz — patrz `seed/PROMPT.md`):
 *
 *   curl -L -o .usda/sr-legacy.zip \
 *     https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
 *   cd .usda && unzip -q sr-legacy.zip && cd ..
 *   npm run distill:usda
 *
 * `.usda/` jest w `.gitignore`: rozpakowany zbiór ma 38 MB, z czego 36 MB to jedna tabela
 * `food_nutrient.csv`. Do repozytorium trafia wyłącznie destylat — 35 wierszy.
 *
 * **Najważniejsze zabezpieczenie tego skryptu to sprawdzenie OPISU.** `seed/ingredients.json`
 * zapisuje przy każdym `fdcId` opis z tabeli USDA, a destylacja przerywa, gdy opis w zbiorze się
 * z nim nie zgadza. Bez tego pomyłka w jednej cyfrze `fdcId` podmieniłaby składnik na zupełnie
 * inny produkt — po cichu, bo makra dalej byłyby „jakieś" i przeszłyby sito Atwatera. To jest
 * główny nośnik ryzyka rezydualnego tej zmiany (plan F-01, faza 3 §2).
 *
 * Bez zależności: parser CSV jest tutaj, świadomie, i obsługuje wyłącznie to, czego używa USDA —
 * pola w cudzysłowach z podwojonym cudzysłowem w środku.
 */
import fs from 'node:fs';
import path from 'node:path';

const RepoRoot = path.resolve(import.meta.dirname, '..');
const MappingFile = path.join(RepoRoot, 'seed', 'ingredients.json');
const OutputFile = path.join(RepoRoot, 'seed', 'usda-subset.json');
const DatasetDir = path.join(RepoRoot, '.usda', 'FoodData_Central_sr_legacy_food_csv_2018-04');

/**
 * Identyfikatory składników odżywczych w tabeli `nutrient`. Cztery, bo tyle trzyma `ingredient`
 * i tyle potrzebuje guardrail ±10%. `1062` (energia w kJ) jest świadomie pominięte — druga
 * jednostka tej samej wielkości to zaproszenie do rozjazdu.
 */
const Nutrients = {
  1008: 'kcal',
  1003: 'protein',
  1005: 'carbs',
  1004: 'fat',
};

/** Jeden wiersz CSV → tablica pól. Obsługuje cudzysłowy i `""` jako znak cudzysłowu. */
function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (inQuotes) {
      if (char !== '"') {
        field += char;
      } else if (line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = false;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }

  fields.push(field);
  return fields;
}

function* csvRows(file) {
  const text = fs.readFileSync(file, 'utf8');
  let first = true;

  for (const line of text.split('\n')) {
    if (first) {
      first = false;
      continue;
    }
    if (line.trim() === '') {
      continue;
    }
    yield parseCsvLine(line.endsWith('\r') ? line.slice(0, -1) : line);
  }
}

function fail(message, details = []) {
  console.error(`distill-usda: ${message}`);
  for (const detail of details) {
    console.error(`  - ${detail}`);
  }
  process.exit(1);
}

function main() {
  if (!fs.existsSync(DatasetDir)) {
    fail(
      `nie ma rozpakowanego zbioru USDA w ${path.relative(RepoRoot, DatasetDir)} — instrukcja ` +
        'pobrania jest w komentarzu na górze tego pliku.',
    );
  }

  const mapping = JSON.parse(fs.readFileSync(MappingFile, 'utf8'));
  const wanted = new Map(mapping.ingredients.map((item) => [String(item.fdcId), item]));

  // --- opisy, czyli sprawdzenie tożsamości ---

  const descriptions = new Map();
  for (const row of csvRows(path.join(DatasetDir, 'food.csv'))) {
    const [fdcId, , description] = row;
    if (wanted.has(fdcId)) {
      descriptions.set(fdcId, description);
    }
  }

  const problems = [];
  for (const [fdcId, item] of wanted) {
    const actual = descriptions.get(fdcId);
    if (actual === undefined) {
      problems.push(`„${item.name}": fdcId ${fdcId} nie istnieje w tym zbiorze USDA.`);
    } else if (actual !== item.usdaDescription) {
      problems.push(
        `„${item.name}": fdcId ${fdcId} opisuje „${actual}", a mapowanie mówi ` +
          `„${item.usdaDescription}".`,
      );
    }
  }
  if (problems.length > 0) {
    fail('mapowanie nie zgadza się ze zbiorem USDA — destylat NIE powstał:', problems);
  }

  // --- makra ---

  const macros = new Map([...wanted.keys()].map((fdcId) => [fdcId, {}]));
  for (const row of csvRows(path.join(DatasetDir, 'food_nutrient.csv'))) {
    const [, fdcId, nutrientId, amount] = row;
    if (!macros.has(fdcId)) {
      continue;
    }
    const key = Nutrients[Number(nutrientId)];
    if (key) {
      macros.get(fdcId)[key] = Number(amount);
    }
  }

  const missing = [];
  for (const [fdcId, item] of wanted) {
    for (const key of Object.values(Nutrients)) {
      if (typeof macros.get(fdcId)[key] !== 'number' || !Number.isFinite(macros.get(fdcId)[key])) {
        missing.push(`„${item.name}" (fdcId ${fdcId}): brak wartości „${key}".`);
      }
    }
  }
  if (missing.length > 0) {
    fail('w zbiorze brakuje makr — destylat NIE powstał:', missing);
  }

  // Kolejność po `fdcId`, nie po kolejności z mapowania: destylat ma być stabilny, żeby jego
  // diff pokazywał zmianę DANYCH, a nie przestawienie wierszy w pliku autorskim.
  const items = [...wanted.keys()]
    .sort((a, b) => Number(a) - Number(b))
    .map((fdcId) => ({
      fdcId: Number(fdcId),
      description: descriptions.get(fdcId),
      per100g: {
        kcal: macros.get(fdcId).kcal,
        protein: macros.get(fdcId).protein,
        carbs: macros.get(fdcId).carbs,
        fat: macros.get(fdcId).fat,
      },
    }));

  const output = {
    source: mapping.source,
    note:
      'WYGENEROWANE przez scripts/distill-usda.mjs — nie edytuj ręcznie. Wartości na 100 g ' +
      'produktu w stanie opisanym w `description`.',
    items,
  };

  // `writeFileSync`, nigdy przekierowanie powłoki: PowerShell dokłada BOM i psuje polskie znaki.
  fs.writeFileSync(OutputFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(
    `distill-usda: ${items.length} składników → ${path.relative(RepoRoot, OutputFile)}`,
  );
}

main();
