# Konto e-mail + hasło i granica danych użytkownika — krótki plan

> Pełny plan: `context/changes/account-and-login/plan.md`
> Wersja 2 (2026-09-01) — zastępuje wersję opartą na Better Auth; powód w `change.md`.

## Co i dlaczego

Użytkownik zakłada konto e-mail + hasło, potwierdza adres kodem z maila, loguje się i widzi ten sam
stan na telefonie oraz w przeglądarce; niezalogowany nie dostaje żadnego widoku produktowego.
To fragment S-01 mapy drogowej (FR-001 + *Access Control*) i jedyny element strumienia A z gotowym
startem — odblokowuje profil (S-02) i preferencje (S-03), czyli dwa z trzech wejść generatora.

Tożsamość prowadzi **Clerk**. Nasz Worker nie hashuje haseł, nie trzyma sesji i nie wysyła maili —
weryfikuje podpis tokenu i mapuje `userId` na własne dane w D1.

## Punkt wyjścia

Repo ma wdrożony backend bez żadnej funkcji: `worker.ts` oddaje żądania adapterowi workerd, binding
D1 `DB` dochodzi do tras API przez `getWorkerEnv()`, a jedyna trasa to `/api/health`. Baza jest
**pusta** — zero tabel, zero migracji. Auth nie istnieje w żadnej postaci. Router ma dwa ekrany
startera, oba publiczne, a `_layout.tsx` montuje zakładki bezwarunkowo.

## Pożądany stan końcowy

Na produkcji i w Expo Go: rejestracja wysyła kod, konto powstaje dopiero po jego wpisaniu, sesja
trwa między uruchomieniami aplikacji, wejście na trasę produktową bez sesji przekierowuje na
logowanie, a zapomniane hasło da się zresetować kodem bez opuszczania aplikacji. Każda trasa API
sięgająca po dane użytkownika weryfikuje token i przechodzi przez repozytorium z `userId`
w pierwszym argumencie.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego | Źródło |
| --- | --- | --- | --- |
| Dostawca tożsamości | **Clerk** (plan Hobby) | Serwer sprowadza się do weryfikacji podpisu — znika hashowanie, sesje, maile, limit prób i cała klasa ryzyka bundlowania ciężkiej biblioteki auth przez Metro do workerd | Plan v2 |
| Weryfikacja po stronie serwera | `@clerk/backend` → `verifyToken({ jwtKey })` | Bezsieciowa, klucz publiczny PEM, kanoniczne SDK dla izolatów V8; ścieżka odwrotu to `jose` przeciw temu samemu kluczowi | Plan v2 |
| Plan Cloudflare | **darmowy wystarcza** | Bez hashowania po naszej stronie limit 10 ms CPU przestaje być problemem; Paid wraca przy generatorze (S-04) | Plan v2 — odwrócenie decyzji z v1 |
| Nadawca maili | **brak** — maile wysyła Clerk | Resend wypada z zakresu; jeden dostawca mniej niż w v1 | Plan v2 |
| Weryfikacja adresu i reset hasła | **kod w aplikacji**, nie link | Ten sam przepływ na webie i na native, znika problem linku klikniętego na innym urządzeniu | Plan v2 |
| UI logowania | Własne ekrany na hookach (`useSignIn` / `useSignUp`) | Komponenty natywne Clerka wymagają development buildu; custom flow działa w Expo Go, którym weryfikujemy ten kamień milowy | Plan v2 |
| Transport tokenu | `Authorization: Bearer` na obu platformach | Jedna ścieżka do napisania i przetestowania; Worker nigdy nie czyta ciasteczek | Plan v2 |
| Bramka tras | Grupy `(auth)` / `(app)` z `<Redirect>` | Zakładki nie montują się bez sesji; grupy nie zmieniają URL-i, więc nazwy triggerów zakładek zostają | Plan v1, utrzymane |
| Dane w D1 | Tabela `app_user` kluczowana `userId` z Clerka, **bez danych tożsamościowych** | Lokalna kotwica dla profilu i planów; e-mail i hasło nie są duplikowane | Plan v2 |
| Migracje | `wrangler d1 migrations` (domyślny `migrations/`), wstecz w `migrations/down/` | Wrangler czyta tylko `.sql` z najwyższego poziomu, więc podkatalog jest bezpieczny; bez ORM nie ma generatora do podpięcia | Plan v2 |
| „Gotowe" znaczy | Web na produkcji + jeden przebieg w Expo Go | Wynik S-01 mówi o telefonie **i** przeglądarce | Plan v1, utrzymane |

## Zakres

**W zakresie:** konto e-mail + hasło; potwierdzenie adresu kodem; logowanie i wylogowanie; sesja
trwała na obu platformach; reset hasła; bramka tras `(auth)`/`(app)`; weryfikacja tokenu
w Workerze; pierwszy schemat D1 z konwencją migracji; warstwa repozytorium z `userId` w pierwszym
argumencie; **jeden kanał żądań klienta do własnego API (`src/lib/api.ts`)**; aktualizacja
`CLAUDE.md`.

**Poza zakresem:** dane profilowe (S-02); preferencje, plan, lista zakupów; logowanie
społecznościowe, passkeys, MFA, komponenty natywne Clerka; wywołania Backend API Clerka
(`CLERK_SECRET_KEY`); webhooki synchronizujące użytkowników; własny nadawca maili; zmiana hasła
i e-maila z poziomu konta; offline; runner testów.

## Architektura / Podejście

```
Expo Router (src/app/)                                   Clerk (hosted)
├── _layout.tsx  ClerkProvider + tokenCache ──────────►  rejestracja, kod,
├── (auth)/   sign-in, sign-up, forgot-password           logowanie, reset,
├── (app)/    _layout = useAuth → Redirect | AppTabs      limit prób, sesja
│                                                                │
│   lib/api.ts  authedFetch() ────────────┐                      │
│      getToken() ──► Authorization: Bearer│                     │
└── api/  account+api.ts                   │            klucz publiczny PEM
              │                            ▼                     │
              └──► src/server/auth.ts  requireUserId() ◄──────────┘
                             │           (verifyToken, bezsieciowo)
                             ▼
                   src/server/repository/app-users.ts
                             │  touchAppUser(userId, …)
                             ▼
                   getWorkerEnv().DB  →  D1 `app_user`
```

Klient rozmawia z Clerkiem bezpośrednio — **przepływ logowania nie dotyka naszego Workera**.
Worker widzi wyłącznie podpisany token i wyciąga z niego `userId`.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
| --- | --- | --- |
| 1. Konto i bramka tras | Klucz publikowalny (lokalnie **i** w Workers Builds), rejestracja z kodem, logowanie, wylogowanie, grupy `(auth)`/`(app)` | Czy `@clerk/expo` przejdzie przez prerender Metro (`web.output: "server"`) — bramka `expo export` jest krokiem 5, przed ekranami, bo ścieżki odwrotu nie ma |
| 2. Reset hasła | Trzyetapowy przepływ kodem, w aplikacji | Mały; ryzyko głównie w tym, żeby ekran nie zdradzał, czy adres istnieje |
| 3. Granica danych na serwerze | `requireUserId()`, migracja `app_user` (w tym `--remote`), repozytorium, `/api/account`, `authedFetch()` | Czy `@clerk/backend` przejdzie przez Metro do `dist/server` — ścieżka odwrotu to `jose` |
| 4. Wdrożenie | Potwierdzenie warunków produkcji, przebieg na webie i w Expo Go, `CLAUDE.md` | Mały — faza nie zakłada już żadnego warunku, tylko go sprawdza |

**Auto-deploy narzuca kolejność.** Workers Builds wdraża każdy push na `main` bez udziału
człowieka, więc **warunek produkcyjny wchodzi przed commitem fazy, która go potrzebuje**: zmienna
buildu `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` w fazie 1, sekret `CLERK_JWT_KEY` i migracja
`--remote` w fazie 3. Odłożenie ich do fazy wdrożeniowej daje martwą produkcję (bundel bez
tożsamości Clerka) i okno 500 (`/api/account` bez tabeli).

**Wymagania wstępne:** konto Clerk z aplikacją na planie Hobby (e-mail + hasło, weryfikacja kodem,
reset kodem); publishable key i PEM public key z dashboardu; dostęp do zmiennych środowiskowych
buildu w Workers Builds; telefon z Expo Go do faz 1 i 4. `.dev.vars`, `.wrangler/`
i `.wrangler-dry/` są **już** w `.gitignore` — zostaje potwierdzenie przed pierwszym sekretem.
**Plan Workers Paid nie jest już potrzebny.**

**Szacowany nakład pracy:** ~4 sesje po godzinach, po jednej na fazę; faza 1 jest największa,
faza 2 najmniejsza.

## Otwarte ryzyka i założenia

- **Tożsamość poza naszą infrastrukturą.** Clerk trzyma e-mail i hash hasła; rezydencja danych
  w wybranym regionie to funkcja planów płatnych. Dane objęte guardrailem PRD (waga, wiek, płeć)
  zostają w D1 w regionie EEUR i nigdy nie trafiają do Clerka.
- **`@clerk/expo` w prerenderze Metro jest niesprawdzony** — `web.output: "server"` prerenderuje
  trasy w Node z `ClerkProvider` i `expo-secure-store` w drzewie. Ta sama klasa ryzyka, która
  przewróciła wersję 1 planu, i **bez ścieżki odwrotu** (własne ekrany na hookach to jedyne
  podejście działające w Expo Go). Dlatego faza 1 sprawdza to jednym `expo export` przed
  napisaniem ekranów.
- **`@clerk/backend` w bundlu Metro jest niesprawdzony** — ta sama klasa, mniejsza powierzchnia
  i z gotową ścieżką odwrotu (`jose`). Rozstrzyga się w fazie 3, gdy działające konto już jest.
- **Sesja na planie Hobby ma sztywne 7 dni** — użytkownik loguje się raz w tygodniu; wydłużenie
  wymaga planu płatnego.
- **Uzależnienie od dostawcy** — wyjście oznacza migrację użytkowników i przepisanie ekranów auth.
  Kod produktowy zna wyłącznie `userId` jako string, więc izolacja jest tak dobra, jak może być.
- **Izolacja danych opiera się na dyscyplinie w kodzie.** D1 nie ma RLS, repo nie ma testów, więc
  jedynym zabezpieczeniem jest to, że każda trasa przechodzi przez repozytorium.

## Kryteria sukcesu (podsumowanie)

- Nowy użytkownik przechodzi od pustego ekranu do zalogowanej sesji: rejestracja → kod →
  potwierdzenie → logowanie, na produkcji i w Expo Go.
- To samo konto pokazuje ten sam stan w przeglądarce i na telefonie, a sesja przeżywa zamknięcie
  aplikacji.
- Bez tokenu nie da się otworzyć żadnego widoku produktowego ani dostać danych z trasy API;
  z cudzym tokenem nie widać cudzych danych.
