/**
 * Adres produkcyjnego Workera — **jedno** miejsce dla obu stron granicy.
 *
 * Czytają go: `src/lib/api.ts` (klient natywny, gdy celuje w produkcję) i `src/server/auth.ts`
 * (lista `authorizedParties` przy weryfikacji tokenu). Wcześniej stała była zduplikowana po dwóch
 * stronach i rozjazd — zmiana nazwy Workera albo własna domena — objawiłby się jako 401 bez żadnej
 * wskazówki, bo token z nowego originu nie pasowałby do starej listy.
 *
 * Plik jest czystą stałą bez importów z React Native, więc bezpiecznie wchodzi zarówno do bundla
 * klienta, jak i do tras `+api.ts` idących przez Metro do `dist/server`.
 */
export const ProductionOrigin = 'https://meal-plan.kurs-ai-szysza.workers.dev';
