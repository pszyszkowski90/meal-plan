import { test as setup } from '@playwright/test';

import { signIn } from './support/sign-in';

/**
 * Loguje się RAZ i zapisuje sesję, żeby pozostałe testy nie przechodziły przez formularz.
 * To zalecany wzorzec Playwrighta i realizacja reguły „uwierzytelniaj bez interfejsu":
 * logowanie przez UI w każdym teście kosztuje kilka sekund i wiąże każdy test z ryzykiem
 * niezwiązanym z tym, którego on pilnuje.
 *
 * Plik sesji ląduje POZA repozytorium (katalog harnessu) — to poświadczenie, nie kod. Ścieżkę
 * podaje konfiguracja zmienną `MEALPLAN_AUTH_STATE`, żeby w repo nie zapisywać ścieżek hosta.
 *
 * Uwaga: sam fakt, że bramka wpuszcza po zalogowaniu, jest osobno sprawdzany w
 * `session-gate.spec.ts` na czystym kontekście. Ten plik jest infrastrukturą, nie dowodem.
 */
setup('zapisz zalogowaną sesję', async ({ page }) => {
  const authFile = process.env.MEALPLAN_AUTH_STATE;
  if (!authFile) {
    throw new Error('Brak MEALPLAN_AUTH_STATE — uruchom testy przez konfigurację harnessu.');
  }

  await signIn(page);
  await page.context().storageState({ path: authFile });
});
