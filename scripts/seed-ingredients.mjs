/**
 * Generuje SQL zasiewający SKŁADNIKI i GRUPY WYKLUCZENIOWE — nie dania.
 *
 * Dania mają własną ścieżkę (fazy 2-4 F-01) i wymagają przeglądu gramatur przez człowieka.
 * Tutaj powstaje wyłącznie to, czego potrzebuje ekran preferencji (S-03 faza 2): lista składników
 * do wyboru i słownik grup, bez którego użytkownik nie wyrazi „nie jem grzybów".
 *
 * Uruchomienie — skrypt PISZE NA STDOUT, niczego sam nie stosuje:
 *
 *   node scripts/seed-ingredients.mjs > .wrangler/seed-ingredients.sql
 *   npx wrangler d1 execute mealplan --local  --file .wrangler/seed-ingredients.sql
 *   npx wrangler d1 execute mealplan --remote --file .wrangler/seed-ingredients.sql
 *
 * Rozdzielenie generowania od stosowania jest celowe: wynik da się przeczytać przed wysłaniem
 * na produkcję, a skrypt nie potrzebuje żadnych poświadczeń.
 *
 * **Idempotentnie.** Każdy `INSERT` jest `OR IGNORE` po tożsamości wiersza (`ingredient.name`,
 * `exclusion_group.slug`, para kluczy w `ingredient_group`), więc powtórny przebieg nie tworzy
 * duplikatów ani nie nadpisuje ręcznych korekt makr.
 *
 * **Sito Atwatera jest REALNE, nie przepisane.** Skrypt importuje `atwaterWithinTolerance`
 * i `DishBounds` z `src/lib/` — te same, których użyje walidacja dania. Kopia progu w skrypcie
 * rozjechałaby się przy pierwszej korekcie i zasiałaby składniki, których walidator nie przyjmie.
 * Wiersz, który sita nie przechodzi, przerywa generowanie: lepiej brak seeda niż seed z błędem
 * mapowania, bo makra są wejściem guardraila ±10%.
 *
 * Źródło makr: USDA FoodData Central, wartości na 100 g produktu W STANIE PODANYM W NAZWIE.
 * Stan jest częścią tożsamości składnika (`migrations/0003_dish_pool.sql:23-27`): ryż suchy ma
 * ~365 kcal, ugotowany ~130 — różnica rzędu 180%, czyli wielokrotność całego budżetu ±10%.
 */
import { atwaterKcal, atwaterWithinTolerance } from '../src/lib/dish-macros.ts';
import { DishBounds } from '../src/lib/dish-validation.ts';

/**
 * Grupy wykluczeniowe — słownik współdzielony, bez `user_id`.
 *
 * Osiem pozycji pokrywa to, co ludzie naprawdę wykluczają w całości, a czego nie da się wyrazić
 * kategorią sklepową z `0003`: grzyby i orzechy leżą tam w `warzywa` i `suche`.
 */
const Groups = [
  { slug: 'grzyby', name: 'grzyby' },
  { slug: 'orzechy', name: 'orzechy' },
  { slug: 'nabial', name: 'nabiał' },
  { slug: 'ryby', name: 'ryby' },
  { slug: 'owoce-morza', name: 'owoce morza' },
  { slug: 'straczki', name: 'strączki' },
  { slug: 'gluten', name: 'gluten' },
  { slug: 'wieprzowina', name: 'wieprzowina' },
];

/**
 * Składniki: nazwa ze STANEM, makra USDA na 100 g, kategoria z enuma `0003` i przynależność
 * do grup wykluczeniowych.
 *
 * Czego tu ŚWIADOMIE nie ma: pieprzu i innych przypraw o wysokiej zawartości błonnika. Pieprz
 * czarny ma 251 kcal przy makrach dających 327 kcal Atwatera — 30% odchylenia na poprawnym
 * wierszu USDA, więc sito go odrzuca. To nie jest błąd sita: w gramaturach przepisu przyprawy
 * wnoszą ułamek kilokalorii, a wpuszczenie ich wymagałoby poluzowania progu, który chroni
 * przed błędami mapowania rzędu ×10.
 */
const Ingredients = [
  // --- warzywa
  { name: 'pieczarki, świeże', kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3, category: 'warzywa', groups: ['grzyby'] },
  { name: 'boczniaki, świeże', kcal: 33, protein: 3.3, carbs: 6.1, fat: 0.4, category: 'warzywa', groups: ['grzyby'] },
  { name: 'brokuł, surowy', kcal: 34, protein: 2.8, carbs: 6.6, fat: 0.4, category: 'warzywa', groups: [] },
  { name: 'marchew, surowa', kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2, category: 'warzywa', groups: [] },
  { name: 'pomidor, surowy', kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, category: 'warzywa', groups: [] },
  { name: 'cebula, surowa', kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, category: 'warzywa', groups: [] },
  { name: 'papryka czerwona, surowa', kcal: 31, protein: 1.0, carbs: 6.0, fat: 0.3, category: 'warzywa', groups: [] },
  { name: 'szpinak, surowy', kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, category: 'warzywa', groups: [] },
  { name: 'ziemniaki, surowe', kcal: 77, protein: 2.0, carbs: 17.5, fat: 0.1, category: 'warzywa', groups: [] },

  // --- owoce
  { name: 'jabłko, surowe', kcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2, category: 'owoce', groups: [] },
  { name: 'banan, surowy', kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, category: 'owoce', groups: [] },

  // --- mięso
  { name: 'pierś z kurczaka, surowa', kcal: 120, protein: 22.5, carbs: 0, fat: 2.6, category: 'mieso', groups: [] },
  { name: 'schab wieprzowy, surowy', kcal: 143, protein: 21.0, carbs: 0, fat: 6.0, category: 'mieso', groups: ['wieprzowina'] },
  { name: 'boczek wędzony', kcal: 541, protein: 37.0, carbs: 1.4, fat: 42.0, category: 'mieso', groups: ['wieprzowina'] },

  // --- ryby i owoce morza
  { name: 'łosoś atlantycki, surowy', kcal: 208, protein: 20.4, carbs: 0, fat: 13.4, category: 'ryby', groups: ['ryby'] },
  { name: 'dorsz atlantycki, surowy', kcal: 82, protein: 17.8, carbs: 0, fat: 0.7, category: 'ryby', groups: ['ryby'] },
  { name: 'tuńczyk w wodzie, z puszki', kcal: 116, protein: 25.5, carbs: 0, fat: 0.8, category: 'ryby', groups: ['ryby'] },
  { name: 'krewetki, surowe', kcal: 85, protein: 20.1, carbs: 0.9, fat: 0.5, category: 'ryby', groups: ['owoce-morza'] },

  // --- nabiał
  { name: 'mleko 2%, płynne', kcal: 50, protein: 3.3, carbs: 4.8, fat: 2.0, category: 'nabial', groups: ['nabial'] },
  { name: 'jogurt naturalny 2%', kcal: 63, protein: 5.3, carbs: 7.0, fat: 1.6, category: 'nabial', groups: ['nabial'] },
  { name: 'ser gouda', kcal: 356, protein: 24.9, carbs: 2.2, fat: 27.4, category: 'nabial', groups: ['nabial'] },
  { name: 'twaróg półtłusty', kcal: 103, protein: 12.4, carbs: 3.4, fat: 4.3, category: 'nabial', groups: ['nabial'] },

  // --- jaja
  { name: 'jajo kurze, całe, surowe', kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5, category: 'jaja', groups: [] },

  // --- pieczywo
  { name: 'chleb pszenny jasny', kcal: 265, protein: 9.0, carbs: 49.0, fat: 3.2, category: 'pieczywo', groups: ['gluten'] },

  // --- produkty suche
  { name: 'ryż biały, suchy', kcal: 365, protein: 7.1, carbs: 80.0, fat: 0.7, category: 'suche', groups: [] },
  { name: 'makaron pszenny, suchy', kcal: 371, protein: 13.0, carbs: 74.7, fat: 1.5, category: 'suche', groups: ['gluten'] },
  { name: 'płatki owsiane, suche', kcal: 379, protein: 13.2, carbs: 67.7, fat: 6.5, category: 'suche', groups: [] },
  { name: 'soczewica czerwona, sucha', kcal: 358, protein: 23.9, carbs: 63.1, fat: 1.1, category: 'suche', groups: ['straczki'] },
  { name: 'ciecierzyca, sucha', kcal: 378, protein: 20.5, carbs: 63.0, fat: 6.0, category: 'suche', groups: ['straczki'] },
  { name: 'fasola biała, sucha', kcal: 333, protein: 23.4, carbs: 60.3, fat: 0.9, category: 'suche', groups: ['straczki'] },
  { name: 'migdały', kcal: 579, protein: 21.2, carbs: 21.6, fat: 49.9, category: 'suche', groups: ['orzechy'] },
  { name: 'orzechy włoskie', kcal: 654, protein: 15.2, carbs: 13.7, fat: 65.2, category: 'suche', groups: ['orzechy'] },

  // --- tłuszcze
  { name: 'oliwa z oliwek', kcal: 884, protein: 0, carbs: 0, fat: 100, category: 'tluszcze', groups: [] },
  { name: 'masło', kcal: 717, protein: 0.9, carbs: 0.1, fat: 81.1, category: 'tluszcze', groups: ['nabial'] },

  // --- przyprawy
  { name: 'sól', kcal: 0, protein: 0, carbs: 0, fat: 0, category: 'przyprawy', groups: [] },
];

/** Apostrof w nazwie zamykałby literał SQL — jedyne miejsce, które tu czegokolwiek dotyka. */
function quote(text) {
  return `'${String(text).replace(/'/g, "''")}'`;
}

/**
 * Przerywa generowanie, gdy którykolwiek wiersz nie domyka się na współczynnikach Atwatera
 * albo wskazuje nieistniejącą grupę. Seed z błędem mapowania jest gorszy niż brak seeda.
 */
function verify() {
  const known = new Set(Groups.map((group) => group.slug));
  const problems = [];

  for (const item of Ingredients) {
    const macros = { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat };

    if (!atwaterWithinTolerance(macros, DishBounds.atwaterTolerance, DishBounds.atwaterFloorKcal)) {
      problems.push(
        `${item.name}: ${item.kcal} kcal, a z makr wychodzi ${atwaterKcal(macros).toFixed(1)} kcal`,
      );
    }

    for (const slug of item.groups) {
      if (!known.has(slug)) {
        problems.push(`${item.name}: nieznana grupa „${slug}"`);
      }
    }
  }

  const names = Ingredients.map((item) => item.name);
  if (new Set(names).size !== names.length) {
    problems.push('powtórzona nazwa składnika — `ingredient.name` jest UNIQUE');
  }

  if (problems.length > 0) {
    console.error('seed-ingredients: wiersze nie do zasiania:');
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }
}

function generate() {
  const lines = [
    '-- WYGENEROWANE przez scripts/seed-ingredients.mjs — nie edytuj ręcznie.',
    '-- Makra: USDA FoodData Central, na 100 g produktu w stanie podanym w nazwie.',
    `-- Składników: ${Ingredients.length}, grup wykluczeniowych: ${Groups.length}.`,
    '',
  ];

  for (const group of Groups) {
    lines.push(
      `INSERT OR IGNORE INTO exclusion_group (slug, name) VALUES (${quote(group.slug)}, ${quote(group.name)});`,
    );
  }
  lines.push('');

  for (const item of Ingredients) {
    lines.push(
      'INSERT OR IGNORE INTO ingredient (name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, category)',
      `VALUES (${quote(item.name)}, ${item.kcal}, ${item.protein}, ${item.carbs}, ${item.fat}, ${quote(item.category)});`,
    );
  }
  lines.push('');

  // Podzapytania zamiast wpisanych na sztywno identyfikatorów: `ingredient.id` jest
  // AUTOINCREMENT i różni się między środowiskiem lokalnym a produkcją.
  for (const item of Ingredients) {
    for (const slug of item.groups) {
      lines.push(
        'INSERT OR IGNORE INTO ingredient_group (ingredient_id, group_id) VALUES (',
        `  (SELECT id FROM ingredient WHERE name = ${quote(item.name)}),`,
        `  (SELECT id FROM exclusion_group WHERE slug = ${quote(slug)})`,
        ');',
      );
    }
  }

  return lines.join('\n') + '\n';
}

verify();
process.stdout.write(generate());
