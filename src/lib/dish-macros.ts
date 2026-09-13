/**
 * Makra dania liczone z gramatur składników — faza 2 F-01.
 *
 * Moduł jest CZYSTY w tym samym sensie co `calorie-target.ts`: zero importów z Reacta, D1,
 * `@/server` i czegokolwiek innego. Powód jest ten sam — ten plik jest pakowany do klienta,
 * do `dist/server` i uruchamiany przez runner Node z okrajaniem typów, więc nie może zawierać
 * `enum`, `namespace` ani właściwości parametrów konstruktora.
 *
 * Dlaczego makra NIE są kolumną na `dish` (migracja `0003`, komentarz :13-15): suma przechowywana
 * rozjechałaby się przy pierwszej korekcie gramatury. Jedno źródło prawdy, zero dryfu — tak samo
 * jak cel kaloryczny liczony przy odczycie w `calorie-target.ts`.
 */

/** Wartości odżywcze. `kcal` w kilokaloriach, reszta w gramach. */
export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Jedna pozycja dania: makra produktu na 100 g plus gramatura użyta w przepisie. */
export interface DishMacroItem {
  per100g: Macros;
  grams: number;
}

/**
 * Zaokrąglanie jest CZĘŚCIĄ KONTRAKTU, nie szczegółem implementacji — dlatego stoi tutaj jako
 * stała i jest przypięte osobnym testem.
 *
 * Kalorie do pełnych jednostek: ułamek kilokalorii nie niesie informacji przy budżecie ±10%
 * liczonym z tysięcy. Makra do 0,1 g: tyle podaje USDA i tyle widać na etykiecie.
 */
export const MacroPrecision = {
  kcal: 0,
  grams: 1,
} as const;

/** Zaokrąglenie „pół w górę" na zadanej liczbie miejsc po przecinku. */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Sumuje makra dania z listy (makra na 100 g, gramatura).
 *
 * Pusta lista daje same zera — to jest poprawny wynik dla dania bez składników, a nie błąd.
 * Orzekanie, czy danie bez składników wolno zaseedować, należy do `dish-validation.ts`;
 * ten moduł wyłącznie liczy.
 *
 * Gramatura ujemna nie jest tu odrzucana, bo ten moduł nie jest bramką — arytmetyka zadziała
 * i zwróci mniejszą sumę. Odrzuceniem zajmuje się walidacja (`grams > 0`), żeby komunikat trafił
 * do człowieka w jednym miejscu, a nie w dwóch.
 */
export function computeDishMacros(items: readonly DishMacroItem[]): Macros {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  for (const item of items) {
    // Gramatura jest ułamkiem setki: 60 g produktu to 0,6 wartości z tabeli „na 100 g".
    const share = item.grams / 100;
    kcal += item.per100g.kcal * share;
    protein += item.per100g.protein * share;
    carbs += item.per100g.carbs * share;
    fat += item.per100g.fat * share;
  }

  // Zaokrąglamy DOPIERO sumę. Zaokrąglanie każdego składnika z osobna kumulowałoby błąd
  // — przy dziesięciu składnikach potrafi to przesunąć wynik o kilka kilokalorii.
  return {
    kcal: roundTo(kcal, MacroPrecision.kcal),
    protein: roundTo(protein, MacroPrecision.grams),
    carbs: roundTo(carbs, MacroPrecision.grams),
    fat: roundTo(fat, MacroPrecision.grams),
  };
}

/**
 * Energia policzona ze współczynników Atwatera: 4 kcal/g białka, 4 kcal/g węglowodanów,
 * 9 kcal/g tłuszczu.
 *
 * Osobna funkcja, bo korzystają z niej oba sita walidacji — na poziomie składnika i dania.
 */
export function atwaterKcal(macros: Macros): number {
  return 4 * macros.protein + 4 * macros.carbs + 9 * macros.fat;
}

/**
 * Względne odchylenie deklarowanych kilokalorii od energii Atwatera, jako ułamek (0,1 = 10%).
 *
 * Przypadek zerowy jest osobny i celowy: produkty bezkaloryczne (woda, większość przypraw
 * w gramaturach przepisu) mają `kcal = 0` i zerowe makra, więc dzielenie dałoby `NaN`.
 * Zwracamy wtedy 0 — „zgadza się". Ale `kcal = 0` przy niezerowych makrach to realny błąd
 * mapowania i musi wyjść jako nieskończone odchylenie, nie jako zero.
 */
export function atwaterDeviation(macros: Macros): number {
  const expected = atwaterKcal(macros);

  if (macros.kcal === 0) {
    return expected === 0 ? 0 : Number.POSITIVE_INFINITY;
  }

  return Math.abs(macros.kcal - expected) / macros.kcal;
}

/**
 * Czy makra domykają się na współczynnikach Atwatera — z progiem WZGLĘDNYM **i BEZWZGLĘDNYM**.
 *
 * Dlaczego dwa progi, a nie jeden. Sama tolerancja względna **załamuje się blisko zera**:
 * ogólne współczynniki (4/4/9) liczą cały błonnik jak węglowodany przyswajalne, a USDA liczy
 * energię wielu warzyw własnymi współczynnikami, z odjęciem błonnika. Przy produkcie o 23 kcal
 * nadwyżka 6,5 kcal to **28% odchylenia** — mimo że w kilokaloriach jest to nic. Zmierzone
 * na prawdziwych wierszach USDA: brokuł 21%, ogórek 21%, szpinak 28%, pieczarka 29%.
 * Podniesienie samego progu względnego do ~35% przepuściłoby już realne błędy mapowania.
 *
 * Próg bezwzględny rozwiązuje to bez osłabiania sita, bo **skala błędu, którego szukamy, jest
 * inna**: ryż ugotowany podpięty pod suchy daje różnicę 224 kcal, a błąd ×10 na produkcie
 * niskokalorycznym — 166 kcal. Oba są o rząd wielkości powyżej progu, a błonnik nie.
 *
 * Wartość progu (12 kcal/100 g) ma zapas: najgorszy zmierzony przypadek uczciwy to brokuł, 7,2 kcal.
 * Koszt przeoczenia jest ograniczony z góry — 12 kcal/100 g przy 300 g warzyw to 36 kcal,
 * czyli poniżej 2% dziennego budżetu, wewnątrz guardraila ±10%.
 *
 * **Zero kilokalorii jest osobnym przypadkiem i zostaje ostre:** produkt zadeklarowany jako
 * bezkaloryczny, który ma niezerowe makra, jest zawsze błędem mapowania (składnik podpięty pod
 * „wodę") — tam próg bezwzględny NIE obowiązuje.
 */
export function atwaterWithinTolerance(
  macros: Macros,
  relativeTolerance: number,
  absoluteFloorKcal: number,
): boolean {
  if (macros.kcal === 0) {
    return atwaterKcal(macros) === 0;
  }

  const difference = Math.abs(macros.kcal - atwaterKcal(macros));
  return difference <= Math.max(relativeTolerance * macros.kcal, absoluteFloorKcal);
}
