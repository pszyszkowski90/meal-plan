/// <reference types="expo/types" />

// Deklaracje typów Expo — w tym modułów `*.css` i `*.module.css` — wciągnięte JAWNIE i pod
// kontrolą wersji.
//
// Expo generuje dla tego samego celu `expo-env.d.ts`, ale ten plik jest w `.gitignore`
// i powstaje dopiero przy pierwszym `npm start` (`expo export` go NIE tworzy — sprawdzone
// 13.09.2026). Skutek był taki, że `npx tsc --noEmit` zgłaszał dwa błędy o `.css` wszędzie tam,
// gdzie nikt wcześniej nie uruchomił Metro: na świeżym klonie, w świeżym `git worktree`
// i — co zablokowało bramkę jakości — na runnerze GitHub Actions.
//
// Trzymanie tej jednej linijki w repozytorium usuwa całą tę klasę fałszywych błędów. Plik
// wygenerowany przez Expo może nadal powstać obok; podwójne `reference` do tego samego pakietu
// jest bezpieczne, bo TypeScript je scala.
//
// Czego ten plik NIE zastępuje: `.expo/types/router.d.ts` z typami tras (`typedRoutes`).
// Tamte powstają wyłącznie przy uruchomieniu Metro i też są w `.gitignore` — patrz komentarz
// w `.github/workflows/quality-gate.yml`.
