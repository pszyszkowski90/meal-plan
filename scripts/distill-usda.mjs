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
 * Bez zależności: parser CSV jest tutaj, świadomie, i obsługuje **dokładnie tyle, ile trzeba dla
 * tego zbioru** — pola w cudzysłowach z podwojonym cudzysłowem w środku, w wierszach BEZ znaku
 * nowej linii. Podział na wiersze idzie przed parsowaniem cudzysłowów, więc pole wielowierszowe
 * zostałoby rozbite; SR Legacy takich nie ma, a gdyby miał, zauważy to sprawdzenie liczby pól
 * w `csvRows`.
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

/**
 * Początki nagłówków obu tabel. Sprawdzamy PREFIKS, nie całość: USDA dokłada kolumny na końcu
 * między wydaniami, a to jest zmiana nieszkodliwa dla odczytu pozycyjnego.
 */
const Headers = {
  food: ['fdc_id', 'data_type', 'description'],
  foodNutrient: ['id', 'fdc_id', 'nutrient_id', 'amount'],
};

/**
 * Wiersze pliku CSV, po SPRAWDZENIU NAGŁÓWKA.
 *
 * Kolumny czytamy pozycyjnie (`const [, fdcId, nutrientId, amount] = row`), więc ich kolejność
 * jest założeniem — a ciche założenie o układzie kolumn jest tutaj groźniejsze niż gdzie indziej.
 * Przestawienie kolumn w `food.csv` złapałoby jeszcze sito opisu, ale przestawienie ich
 * w `food_nutrient.csv` **nie zostałoby złapane przez nic**: skrypt policzyłby wiarygodnie
 * wyglądające, błędne makra. To dokładnie ten tryb awarii, przed którym cała ta zmiana ma chronić,
 * więc założenie jest SPRAWDZANE, a nie komentowane.
 *
 * Liczba pól w wierszu też jest sprawdzana — to przy okazji jedyne miejsce, które zauważyłoby
 * pole ze znakiem nowej linii w środku, rozbite przez podział wierszy przed parsowaniem.
 */
function* csvRows(file, expectedHeader) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');

  const header = parseCsvLine((lines[0] ?? '').replace(/\r$/, ''));
  const mismatch = expectedHeader.findIndex((name, index) => header[index] !== name);
  if (mismatch !== -1) {
    fail(`${path.basename(file)} ma inny układ kolumn, niż zakłada ten skrypt:`, [
      `kolumna ${mismatch + 1}: oczekiwano „${expectedHeader[mismatch]}", jest ` +
        `„${header[mismatch] ?? '(brak)'}"`,
      'Destylat NIE powstał — pozycyjny odczyt kolumn dałby błędne makra.',
    ]);
  }

  for (const [index, line] of lines.entries()) {
    if (index === 0 || line.trim() === '') {
      continue;
    }
    const row = parseCsvLine(line.endsWith('\r') ? line.slice(0, -1) : line);
    if (row.length < expectedHeader.length) {
      fail(
        `${path.basename(file)}: wiersz ${index + 1} ma ${row.length} pól zamiast co najmniej ` +
          `${expectedHeader.length}.`,
        ['Destylat NIE powstał.'],
      );
    }
    yield row;
  }
}

/**
 * Odczyt pliku wejściowego przez tę samą konwencję co reszta skryptu. Bez tego brak albo
 * uszkodzenie pliku daje surowy `ENOENT`/`SyntaxError` zamiast zdania, które mówi, co zrobić.
 */
function readJson(file, hint) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`nie dało się przeczytać ${path.relative(RepoRoot, file)}:`, [error.message, hint]);
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

  const mapping = readJson(
    MappingFile,
    'To plik wersjonowany w repozytorium — jego brak zwykle znaczy zły katalog roboczy.',
  );
  const wanted = new Map(mapping.ingredients.map((item) => [String(item.fdcId), item]));

  // --- opisy, czyli sprawdzenie tożsamości ---

  const descriptions = new Map();
  for (const row of csvRows(path.join(DatasetDir, 'food.csv'), Headers.food)) {
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
  for (const row of csvRows(path.join(DatasetDir, 'food_nutrient.csv'), Headers.foodNutrient)) {
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
