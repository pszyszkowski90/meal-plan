/**
 * Raport wykonalności puli — odpowiedź LICZBĄ na pytanie „czy z tego da się ułożyć dzień".
 *
 * To jest pomiar, dla którego istnieje faza pilotażowa. Przegląd gramatur jest największym
 * i nieodwracalnym nakładem tej zmiany; jeśli po dwudziestu daniach widać, że pula musi być
 * trzykrotnie większa albo inaczej rozłożona na pory posiłku, lepiej dowiedzieć się tego teraz
 * niż po sześćdziesięciu.
 *
 * Uruchomienie:
 *
 *   node ./scripts/check-pool-feasibility.mjs --local
 *   node ./scripts/check-pool-feasibility.mjs --remote
 *
 * **Makra liczy `src/lib/dish-macros.ts`, nie ten skrypt.** Ten sam moduł, którego użyje generator
 * planu (S-04) i ekran dania. Własna arytmetyka dałaby raport o puli, której nie ma.
 *
 * **Wyszukiwanie jest PRZYCINANE, nie pełne.** Przy dwudziestu daniach różnica jest bez znaczenia,
 * ale ten sam skrypt ma obsłużyć pulę docelową i późniejsze: częściowa suma, która już przekracza
 * górną granicę, nie ma jak wrócić do zakresu, więc gałąź jest ucinana. Kolejność po kaloriach
 * rosnąco sprawia, że ucięcie gałęzi ucina też wszystkie dalsze na tym poziomie.
 */
import { spawnSync } from 'node:child_process';

import { computeDishMacros } from '../src/lib/dish-macros.ts';

/** Cele kaloryczne z planu F-01, fazy 3 §5. */
const Targets = [1600, 2000, 2400, 2800, 3200];

/** Guardrail produktowy z `CLAUDE.md`: suma dnia mieści się w ±10% celu. */
const Tolerance = 0.1;

/**
 * Liczba posiłków dziennie, jaką użytkownik może wybrać — enum z `src/lib/preferences.ts`.
 *
 * Raport liczy KAŻDĄ z nich, bo to nie jest szczegół: przy czterech posiłkach ta pula nie sięga
 * 2400 kcal w żadnym złożeniu, a przy sześciu sięga. Raport policzony na jednej, arbitralnie
 * wybranej liczbie posiłków odpowiedziałby „nie da się" na pytanie, na które odpowiedź brzmi
 * „da się, ale nie przy czterech".
 */
const MealsPerDayOptions = [3, 4, 5, 6];

/**
 * Dzień o zadanej liczbie posiłków: trzy główne plus przekąski.
 *
 * Przekąski MUSZĄ być różnymi daniami — dzień z tą samą przekąską trzy razy jest arytmetycznie
 * poprawny i kulinarnie bezużyteczny, a policzony jako trafienie zawyżałby raport dokładnie tam,
 * gdzie pula jest najcieńsza.
 */
function daySlots(mealsPerDay) {
  return ['breakfast', 'lunch', 'dinner', ...Array(mealsPerDay - 3).fill('snack')];
}

/** Pory, które w ogóle występują — do tabeli „dań ocalałych". */
const AllSlots = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * Wykluczenia scenariusza trzeciego — typowy zestaw, nie losowy.
 *
 * Grzyby i owoce morza to dwie z najczęstszych niechęci, a boczek wypada u każdego, kto nie je
 * wieprzowiny. Cztery pozycje mieszczą się w przedziale „3–5 wykluczeń" z planu.
 */
const ScenarioExclusions = [
  'pieczarki, świeże',
  'boczniaki, świeże',
  'boczek wędzony, surowy',
  'krewetki, surowe',
];

/** Limit czasu scenariuszy 2 i 3 — najczęstsza wartość, jaką ustawia człowiek w tygodniu. */
const PrepLimitMinutes = 30;

function fail(message, details = []) {
  console.error(`check-pool-feasibility: ${message}`);
  for (const detail of details) {
    console.error(`  - ${detail}`);
  }
  process.exit(1);
}

function parseMode(argv) {
  const local = argv.includes('--local');
  const remote = argv.includes('--remote');
  if (local === remote) {
    fail('podaj dokładnie jeden tryb: --local albo --remote.');
  }
  return remote ? '--remote' : '--local';
}

/**
 * Jedno zapytanie do D1 przez `wrangler`.
 *
 * `shell: true` jest tu KONIECZNE i nie jest niedbałością: `npx` na Windowsie to plik `.cmd`,
 * którego Node odmawia uruchomić bezpośrednio (EINVAL po poprawce CVE-2024-27980). Ten sam
 * powód i ten sam zapis, co w `scripts/hooks/git-gate.mjs`.
 */
function query(mode, sql) {
  // Zapytanie MUSI być jedną linią. Idzie przez powłokę, a znak nowej linii w poleceniu urywa je
  // w połowie — objaw to `wrangler zwrócił 1` z pustym stderr, czyli komunikat, który o niczym
  // nie mówi. Zmierzone 14.09.2026 na tym właśnie zapytaniu.
  const oneLine = sql.replace(/\s+/g, ' ').trim();

  const result = spawnSync(
    `npx wrangler d1 execute mealplan ${mode} --json --command "${oneLine.replace(/"/g, '\\"')}"`,
    undefined,
    { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

  if (result.error) {
    fail('nie udało się uruchomić wranglera:', [result.error.message]);
  }
  if (result.status !== 0) {
    fail(`wrangler zwrócił ${result.status}:`, [(result.stderr || '').trim()]);
  }

  // `wrangler --json` potrafi poprzedzić JSON linijkami diagnostycznymi — bierzemy od pierwszego
  // nawiasu, zamiast zakładać, że wyjście jest czystym JSON-em.
  const text = result.stdout ?? '';
  const start = text.indexOf('[');
  if (start === -1) {
    fail('wrangler nie zwrócił JSON-a.', [text.slice(0, 400)]);
  }

  try {
    return JSON.parse(text.slice(start))[0].results;
  } catch (error) {
    fail('nie dało się sparsować odpowiedzi wranglera:', [error.message]);
  }
}

function loadPool(mode) {
  const rows = query(
    mode,
    `SELECT d.slug, d.name, d.prep_minutes AS prepMinutes,
            (SELECT GROUP_CONCAT(meal_slot) FROM dish_meal_slot WHERE dish_id = d.id) AS slots,
            (SELECT GROUP_CONCAT(i.name || '|' || di.grams || '|' || i.kcal_per_100g || '|' ||
                                 i.protein_per_100g || '|' || i.carbs_per_100g || '|' ||
                                 i.fat_per_100g, ';;')
               FROM dish_ingredient di JOIN ingredient i ON i.id = di.ingredient_id
              WHERE di.dish_id = d.id) AS items
       FROM dish d ORDER BY d.slug`,
  );

  if (rows.length === 0) {
    fail('pula dań jest pusta — nie ma czego mierzyć.', [
      'Zasiej dania: `node ./scripts/seed-dishes.mjs --local`.',
    ]);
  }

  return rows.map((row) => {
    const ingredients = (row.items ?? '').split(';;').filter(Boolean).map((chunk) => {
      const [name, grams, kcal, protein, carbs, fat] = chunk.split('|');
      return {
        name,
        grams: Number(grams),
        per100g: {
          kcal: Number(kcal),
          protein: Number(protein),
          carbs: Number(carbs),
          fat: Number(fat),
        },
      };
    });

    return {
      slug: row.slug,
      name: row.name,
      prepMinutes: row.prepMinutes,
      slots: (row.slots ?? '').split(',').filter(Boolean),
      ingredientNames: ingredients.map((item) => item.name),
      // Makra liczy moduł z `src/lib/`, nie ten skrypt — jedno źródło prawdy z generatorem.
      macros: computeDishMacros(ingredients),
    };
  });
}

function applyScenario(pool, scenario) {
  return pool.filter((dish) => {
    if (scenario.prepLimit !== null && dish.prepMinutes > scenario.prepLimit) {
      return false;
    }
    return !dish.ingredientNames.some((name) => scenario.exclusions.includes(name));
  });
}

function bySlot(dishes) {
  const grouped = {};
  for (const slot of AllSlots) {
    grouped[slot] = dishes
      .filter((dish) => dish.slots.includes(slot))
      .sort((a, b) => a.macros.kcal - b.macros.kcal);
  }
  return grouped;
}

/**
 * Liczy kombinacje dnia mieszczące się w ±10% celu — z przycinaniem.
 *
 * Zwraca `{ hits, explored }`: ile złożeń trafia w zakres i ile węzłów odwiedziło wyszukiwanie.
 * Odsetek liczony od `explored` byłby mylący (przycinanie zmienia mianownik), więc raport podaje
 * obie liczby osobno, a odsetek — od PEŁNEJ liczby kombinacji.
 */
/**
 * Liczy złożenia dnia mieszczące się w ±10% celu — z przycinaniem.
 *
 * Przekąski są wybierane jako rosnący ciąg indeksów, więc każdy ZESTAW przekąsek liczy się raz,
 * a nie `k!` razy, i żadna nie powtarza się w jednym dniu.
 *
 * Mianownik („ze wszystkich") liczymy WZOREM, nie licznikiem w przebiegu: przycinanie z definicji
 * nie odwiedza części gałęzi, więc odsetek liczony od odwiedzonych węzłów rósłby wraz ze
 * skutecznością przycinania. To byłaby miara samej siebie.
 */
function countDays(grouped, target, mealsPerDay) {
  const snacksNeeded = mealsPerDay - 3;
  const main = ['breakfast', 'lunch', 'dinner'];
  const snacks = grouped.snack;
  const lower = target * (1 - Tolerance);
  const upper = target * (1 + Tolerance);
  let hits = 0;

  /** Dobiera przekąski: rosnące indeksy, więc bez powtórzeń i bez permutacji tego samego zestawu. */
  const walkSnacks = (from, left, sum) => {
    if (left === 0) {
      if (sum >= lower && sum <= upper) {
        hits += 1;
      }
      return;
    }
    for (let index = from; index < snacks.length; index += 1) {
      const next = sum + snacks[index].macros.kcal;
      // Posortowane rosnąco po kaloriach — dalsze przekąski tylko dołożą.
      if (next > upper) {
        break;
      }
      walkSnacks(index + 1, left - 1, next);
    }
  };

  const walkMain = (index, sum) => {
    if (index === main.length) {
      walkSnacks(0, snacksNeeded, sum);
      return;
    }
    for (const dish of grouped[main[index]]) {
      const next = sum + dish.macros.kcal;
      if (next > upper) {
        break;
      }
      walkMain(index + 1, next);
    }
  };

  walkMain(0, 0);
  return hits;
}

/** Ile jest dni w ogóle: trzy główne razy liczba k-elementowych ZESTAWÓW przekąsek. */
function totalCombinations(grouped, mealsPerDay) {
  const choose = (n, k) => {
    if (k < 0 || k > n) {
      return 0;
    }
    let result = 1;
    for (let index = 0; index < k; index += 1) {
      result = (result * (n - index)) / (index + 1);
    }
    return Math.round(result);
  };

  return (
    grouped.breakfast.length *
    grouped.lunch.length *
    grouped.dinner.length *
    choose(grouped.snack.length, mealsPerDay - 3)
  );
}

function main() {
  const mode = parseMode(process.argv.slice(2));
  const pool = loadPool(mode);

  const scenarios = [
    { label: 'bez filtrów', prepLimit: null, exclusions: [] },
    { label: `limit ${PrepLimitMinutes} min`, prepLimit: PrepLimitMinutes, exclusions: [] },
    {
      label: `limit ${PrepLimitMinutes} min + ${ScenarioExclusions.length} wykluczenia`,
      prepLimit: PrepLimitMinutes,
      exclusions: ScenarioExclusions,
    },
  ];

  console.log(`# Raport wykonalności puli (${mode.replace('--', '')})
`);
  console.log(`Dań w puli: **${pool.length}**.`);
  console.log(
    `Dzień = śniadanie + obiad + kolacja + przekąski (${MealsPerDayOptions.join('/')} posiłków).`,
  );
  console.log(`Guardrail: suma dnia w ±${Math.round(Tolerance * 100)}% celu.
`);

  for (const scenario of scenarios) {
    const survivors = applyScenario(pool, scenario);
    const grouped = bySlot(survivors);

    console.log(`## Scenariusz: ${scenario.label}`);
    console.log(`
Dań ocalałych: **${survivors.length}** z ${pool.length}.
`);
    console.log('| Pora | Dań | Zakres kcal |');
    console.log('| --- | ---: | --- |');
    for (const slot of AllSlots) {
      const dishes = grouped[slot];
      const range =
        dishes.length > 0
          ? `${dishes[0].macros.kcal}–${dishes[dishes.length - 1].macros.kcal}`
          : '—';
      console.log(`| ${slot} | ${dishes.length} | ${range} |`);
    }

    console.log(`
**Odsetek dni w ±10% celu** (w nawiasie liczba złożeń):
`);
    console.log(`| Cel | ${MealsPerDayOptions.map((n) => `${n} posiłków`).join(' | ')} |`);
    console.log(`| ---: | ${MealsPerDayOptions.map(() => '---:').join(' | ')} |`);

    for (const target of Targets) {
      const cells = MealsPerDayOptions.map((meals) => {
        const total = totalCombinations(grouped, meals);
        if (total === 0) {
          return 'brak dań';
        }
        const hits = countDays(grouped, target, meals);
        return `${((hits / total) * 100).toFixed(1)}% (${hits})`;
      });
      console.log(`| ${target} kcal | ${cells.join(' | ')} |`);
    }
    console.log('');
  }
}

main();
