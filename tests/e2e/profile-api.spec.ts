import { test, expect } from '@playwright/test';

import { sessionToken } from './support/token';

/**
 * Ryzyka #4 i #6 z `context/foundation/test-plan.md`: cel kaloryczny rozjeżdża się z wyliczeniem
 * z profilu, a serwer ufa klientowi.
 *
 * Ten plik odtwarza kryteria **2.5–2.8** fazy 2 z
 * `context/changes/profile-and-calorie-target/plan.md`. Przegląd implementacji fazy 2 stwierdził,
 * że poprawki F1/F2/F4/F6 zmieniły schemat i zachowanie tras, więc kryteria odhaczone wcześniej
 * wymagają ponownego przebiegu. Tutaj przestają wymagać człowieka.
 *
 * **Wyrocznia jest niezależna od implementacji.** Liczba 2759 nie została odczytana z modułu
 * liczącego — pochodzi z kryterium 2.7 planu, czyli z wymagania. Gdyby wzór się zmienił, ten test
 * ma zaświecić na czerwono; test przepisujący wartość z kodu zatwierdzałby każdy błąd.
 *
 * Żądania idą **z pominięciem formularza**: walidacja klienta nie może przesłaniać walidacji
 * serwera, bo klient jest pod kontrolą atakującego.
 */

/** Profil odniesienia z kryterium 2.7 planu: 80 kg / 180 cm / 30 lat / mężczyzna / aktywność 3. */
const ReferenceProfile = {
  weightKg: 80,
  heightCm: 180,
  age: 30,
  sex: 'male',
  activityLevel: 3,
} as const;

/** Wartość z kryterium 2.7 — wymaganie, nie wynik uruchomienia implementacji. */
const ExpectedComputedKcal = 2759;

/**
 * SZEREGOWO, i to jest świadome. Wszystkie trzy testy piszą do profilu TEGO SAMEGO konta —
 * mamy jedno konto testowe, więc wiersz w D1 jest zasobem współdzielonym. Równoległy przebieg
 * dawałby wyścig: jeden test ustawia nadpisanie celu, gdy drugi sprawdza, że go nie ma.
 *
 * To ustępstwo od reguły niezależności testów, wymuszone brakiem drugiego konta, a nie
 * niedopatrzenie. Każdy test i tak sam ustawia swój stan wejściowy, więc kolejność go nie ustawia;
 * szeregowość chroni wyłącznie przed przeplotem zapisów. Gdy pojawi się drugie konto
 * (faza 3 wdrożenia z planu testów), ten blok może wrócić do trybu równoległego.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Ryzyka #4 i #6 — kontrakt profilu po uwierzytelnieniu', () => {
  test('zapisany profil wraca z tym samym, niezależnie policzonym celem (2.7)', async ({ page, request }) => {
    const token = await sessionToken(page);
    const auth = { Authorization: `Bearer ${token}` };

    const saved = await request.put('/api/profile', { headers: auth, data: ReferenceProfile });
    expect(saved.status()).toBe(200);

    const savedBody = await saved.json();
    expect(savedBody.profile).toMatchObject(ReferenceProfile);
    expect(savedBody.target.computedKcal).toBe(ExpectedComputedKcal);
    expect(savedBody.target.effectiveKcal).toBe(ExpectedComputedKcal);

    // Odczyt musi oddać to samo — inaczej zapis i odczyt liczą cel w dwóch miejscach.
    const read = await request.get('/api/profile', { headers: auth });
    expect(read.status()).toBe(200);
    const readBody = await read.json();
    expect(readBody.profile).toMatchObject(ReferenceProfile);
    expect(readBody.target.computedKcal).toBe(ExpectedComputedKcal);

    // Dane osobowe nie mogą wylądować w cache pośrednika (ustalenie F2 przeglądu fazy 2).
    expect(read.headers()['cache-control']).toContain('no-store');
  });

  test('nadpisanie celu obowiązuje, a wyliczenie zostaje pod spodem (2.8)', async ({ page, request }) => {
    const token = await sessionToken(page);
    const auth = { Authorization: `Bearer ${token}` };

    const overridden = await request.put('/api/profile', {
      headers: auth,
      data: { ...ReferenceProfile, targetKcalOverride: 2200 },
    });
    expect(overridden.status()).toBe(200);

    const overriddenBody = await overridden.json();
    expect(overriddenBody.target.effectiveKcal).toBe(2200);
    // Wyliczenie nie znika — użytkownik ma móc wrócić do niego bez podawania profilu od nowa.
    expect(overriddenBody.target.computedKcal).toBe(ExpectedComputedKcal);

    // Powrót do wyliczenia: `null` kasuje nadpisanie.
    const cleared = await request.put('/api/profile', {
      headers: auth,
      data: { ...ReferenceProfile, targetKcalOverride: null },
    });
    const clearedBody = await cleared.json();
    expect(clearedBody.target.effectiveKcal).toBe(ExpectedComputedKcal);
  });

  test('serwer odrzuca dane, których formularz by nie wypuścił (2.6)', async ({ page, request }) => {
    const token = await sessionToken(page);
    const auth = { Authorization: `Bearer ${token}` };

    // Wiek poniżej dolnej granicy — odrzucenie musi wskazać POLE, nie tylko zwrócić 400.
    const tooYoung = await request.put('/api/profile', {
      headers: auth,
      data: { ...ReferenceProfile, age: 17 },
    });
    expect(tooYoung.status()).toBe(400);
    const tooYoungBody = await tooYoung.json();
    expect(tooYoungBody.error).toBe('invalid');
    expect(tooYoungBody.fields).toHaveProperty('age');

    // Ciało, które nie jest JSON-em, to inny tryb awarii niż złe dane — i inny komunikat.
    //
    // Celowo `body`, nie `data`: `data` z łańcuchem znaków zostaje przez Playwrighta
    // ZSERIALIZOWANE do poprawnego JSON-a (`"to nie jest json"` jest legalnym JSON-em), więc
    // parser trasy by go przyjął i odpowiedź brzmiałaby `invalid` zamiast `invalid_json` —
    // testowalibyśmy walidację pól, nie parser. Tu idą surowe, niepoprawne bajty.
    const notJson = await request.put('/api/profile', {
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: '{to nie jest json',
    });
    expect(notJson.status()).toBe(400);
    expect((await notJson.json()).error).toBe('invalid_json');

    // Odrzucenie musi być SKUTECZNE: poprzedni profil zostaje nietknięty.
    const afterReject = await request.get('/api/profile', { headers: auth });
    expect((await afterReject.json()).profile.age).toBe(ReferenceProfile.age);
  });
});
