---
project: MealPlan
researched_at: 2026-08-28
recommended_platform: Cloudflare Workers (static assets + D1)
runner_up: EAS Hosting
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Expo Router (Expo SDK 57 / React Native 0.86 / React 19.2)
  runtime: workerd (Cloudflare Workers, izolaty V8)
---

## Recommendation

**Wdrażaj na Cloudflare Workers — własne konto, static assets dla eksportu web, D1 jako baza.**

Decyzja dotyczy backendu i webu, nie binarki mobilnej: aplikacja natywna idzie przez EAS Build
z profilem wewnętrznym i to jest już rozstrzygnięte w [tech-stack.md](tech-stack.md). Backend
mieszka w tym samym repozytorium jako trasy `+api.ts` Expo Routera i jest deployowany oficjalnym
adapterem `expo-server/adapter/workerd` (SDK 57), a statyczny eksport web wjeżdża jako Workers
Static Assets w tym samym Workerze.

Cloudflare, EAS Hosting i Vercel zdobyły komplet 5/5 na kryteriach przyjaznych agentowi —
rozstrzygnęły odpowiedzi z wywiadu. Deklarowana znajomość Cloudflare (Workers / Pages) czyni
z `wrangler` narzędzie, którego nie trzeba się uczyć w czterotygodniowym budżecie po godzinach.
Nierozstrzygnięta kwestia kolokacji domyka się w jednym koncie: D1, KV i R2 są bindingami tego
samego Workera, więc plan i lista zakupów nie wymagają drugiego dostawcy. Brak wymagania trwałych
połączeń (`has_realtime: false`, `has_background_jobs: false`) zdejmuje jedyny twardy filtr, który
mógłby wykluczyć runtime bezserwerowy. Jeden region w zupełności wystarcza, więc globalna sieć
edge jest tu miłym dodatkiem, a nie argumentem — argumentem jest to, że `wrangler secret put`
jest zapisem jednokierunkowym, a `wrangler rollback` cofa wdrożenie jednym poleceniem.

Ta rekomendacja jest wynikiem **świadomej zamiany lidera**: badanie wskazało EAS Hosting, a
kontrola anty-uprzedzeniowa ujawniła trzy słabości (brak typu `secret`, publiczne URL-e preview,
miesięczny a nie dzienny budżet żądań), po których wybór padł na własne konto Cloudflare. Zamiana
kupuje kontrolę i bindingi, a płaci własnoręczną konfiguracją adaptera i własnym auth —
to świadomy koszt, nie przeoczenie.

## Aneks: decyzja o uwierzytelnianiu (2026-09-01)

Badanie poniżej pozostaje zapisem stanu wiedzy z 28.08.2026 i **nie jest przepisywane**. Ten aneks
zastępuje jego rozstrzygnięcia dotyczące auth; wszędzie, gdzie niżej pada „Better Auth + Drizzle
+ D1", obowiązuje to, co tutaj.

**Dostawcą tożsamości jest Clerk** (plan Hobby), a nie własna warstwa auth na D1. Decyzja zapadła
przy planowaniu zmiany `account-and-login`, po tym jak przegląd planu opartego na Better Auth
wykazał, że trzy z sześciu poważnych ustaleń nie dotyczyły produktu, tylko tarcia biblioteki
z runtime'em workerd i z bundlerem Metro. Pełne uzasadnienie i lista odrzuconych opcji:
[`context/changes/account-and-login/change.md`](../changes/account-and-login/change.md).

Co to zmienia w stosunku do treści poniżej:

- **Punkt 3 kontroli anty-uprzedzeniowej jest nieaktualny.** „E-mail + hasło, sesje, reset hasła
  i izolacja danych per konto są Twoje do zbudowania" — nie są. Zostaje wyłącznie izolacja danych,
  bo D1 nadal nie ma RLS (punkt 4 pozostaje w mocy w całości).
- **Nadawca maili nie wchodzi.** Resend / Postmark wypada z projektu; weryfikację adresu i reset
  hasła wysyła Clerk. Liczba dostawców nie rośnie do trzech — zostaje Cloudflare + Clerk.
- **Plan Workers Paid przestaje być wymaganiem auth.** Był potrzebny wyłącznie dlatego, że
  hashowanie hasła nie mieści się w 10 ms CPU planu darmowego. Bez hashowania po naszej stronie
  darmowy plan wystarcza; pozycja o limicie CPU w rejestrze ryzyka dotyczy odtąd wyłącznie
  generatora planu (FR-008).
- **Worker weryfikuje podpis JWT kluczem publicznym PEM** (`@clerk/backend`, bezsieciowo, rząd
  wielkości pojedynczych milisekund), a `userId` z tokenu jest pierwszym argumentem każdej funkcji
  repozytorium. D1 nie przechowuje danych tożsamościowych — e-mail i hash hasła zostają u Clerka.

Świadomie przyjęty koszt: tożsamość mieszka poza naszą infrastrukturą (rezydencja danych
w wybranym regionie to funkcja planów płatnych Clerka), sesja na planie Hobby ma sztywne 7 dni,
i powstaje uzależnienie od dostawcy. Dane objęte guardrailem prywatności z PRD — waga, wiek,
płeć — zostają w D1 w regionie EEUR.

## Platform Comparison

Ocena według pięciu kryteriów z `references/agent-friendly-criteria.md`. Twardy filtr trwałych
połączeń nie usunął nikogo (backend jest request/response). Twardy filtr runtime'u też nie —
`expo-server` w SDK 57 ma sześć oficjalnych adapterów (`bun`, `express`, `http`, `netlify`,
`vercel`, `workerd`), więc każda kandydatka technicznie uruchamia ten stos.

| Platforma | CLI-first | Managed / serverless | Agent-readable docs | Stable deploy API | MCP / integracja | Razem |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | **5 Pass** |
| **EAS Hosting** | Pass | Pass | Pass | Pass | Pass | **5 Pass** |
| **Vercel** | Pass | Pass | Pass | Pass | Pass (beta) | **5 Pass** |
| Netlify | Pass | Pass | Partial | Pass | Pass | 4 Pass / 1 Partial |
| Railway | Pass | Pass | Partial | Pass | Partial | 3 Pass / 2 Partial |
| Fly.io | Pass | Partial | Pass | Pass | Fail | 3 Pass / 1 Partial / 1 Fail |
| Render | Partial | Pass | Partial | Pass | Partial | 2 Pass / 3 Partial |

**Cloudflare Workers** — `wrangler` pokrywa cały cykl: `deploy`, `versions upload/deploy`,
`rollback`, `tail`, `secret put`, `d1 execute`. Dokumentacja jest w markdownie na GitHubie,
Cloudflare publikuje `llms.txt`, gotowe prompty migracyjne (`/workers/prompts/pages-to-workers.txt`)
i osobną stronę konfiguracji dla Claude Code. Wdrożenia są wersjonowane, a rollback sięga 100
ostatnich wersji. Serwery MCP pokrywają docs, bindingi i observability. Static assets są darmowe
i bez limitu na obu planach.

**EAS Hosting** — technicznie ten sam runtime (Cloudflare Workers, izolaty V8), ale przez
pośrednika. Zyskuje na integracji: `eas deploy` bierze eksport, deployment jest niezmienny,
promocja i cofnięcie idą przez alias (`eas deploy:alias --prod --id=`). Oficjalny Expo MCP Server
jest teraz na planie Free i pokrywa status buildów EAS, workflowy i logi. Traci na trzech
rzeczach nazwanych w kontroli anty-uprzedzeniowej niżej.

**Vercel** — najdojrzalsze preview w stawce: Deployment Protection zamyka podglądy do członków
projektu, czego brakuje obu poprzednim. Ma oficjalny `expo-server/adapter/vercel`, a Fluid compute
usuwa zimne starty. Przegrywa na dwóch rzeczach: Hobby jest **wyłącznie niekomercyjny** (Pro
$20/dev/mc w momencie, gdy projekt przestanie być prywatny), a bazy nie ma na miejscu — Postgres
trzeba dobrać z marketplace'u, czyli i tak wraca drugi dostawca.

**Netlify** — oficjalny Netlify MCP Server i oficjalny adapter `expo-server/adapter/netlify`,
a `netlify deploy` domyślnie robi szkic (wymaga `--prod`), co jest bezpieczną wartością domyślną
dla agenta. Netlify DB (Neon) daje kolokację Postgresa. Minusem jest rozliczenie kredytowe —
300 kredytów miesięcznie dzielonych między deploye, transfer i compute — którego kosztu nie da
się przewidzieć przed uruchomieniem.

**Railway** — dobre DX i Postgres obok aplikacji, ale nie ma stałego darmowego planu; Hobby
zaczyna się od 5 USD/mc minimum zużycia. Eksport serwera Expo trzeba opakować w kontener albo
w Nixpacks, zamiast użyć natywnego adaptera.

**Fly.io** — `flyctl` jest solidny, ale platforma jest kontenerowa, więc wchodzi Dockerfile,
czyli wprost cel nieobjęty tym badaniem. Managed Postgres startuje od 38 USD/mc, darmowego planu
na Machines, Postgresa i transfer w 2026 już nie ma. Brak pierwszoklasowej integracji agentowej.

**Render** — darmowa warstwa usypia usługę (zimne starty) i darmowy Postgres wygasa po 90 dniach,
co dla produktu mającego trzymać profil i plan użytkownika jest dyskwalifikujące. Operacyjnie
platforma jest bardziej panelowa niż CLI-owa.

### Shortlisted Platforms

#### 1. Cloudflare Workers (rekomendacja po zamianie)

Wygrywa, bo domyka kolokację bez drugiego dostawcy (D1 + KV + R2 jako bindingi), daje sekrety
zapisywane jednokierunkowo, deterministyczny `wrangler rollback` i dzienny — nie miesięczny —
budżet 100 000 żądań na planie darmowym. Deklarowana znajomość platformy zamienia najdroższą
pozycję w budżecie czasu (nauka narzędzia) w zero.

#### 2. EAS Hosting

Był liderem punktacji. Jedno polecenie (`eas deploy`) obsługuje web i trasy API, `npx expo export`
i deployment mówią tym samym językiem, a Expo MCP Server jest oficjalny i darmowy. Odpada na
kontroli anty-uprzedzeniowej, nie na punktacji. Zostaje realną ścieżką odwrotu: jeśli konfiguracja
adaptera workerd okaże się zbyt kosztowna, `eas deploy` na tym samym eksporcie jest kwestią
godziny, bo runtime się nie zmienia.

#### 3. Vercel

Trzecie miejsce dzięki Deployment Protection i dojrzałości narzędzi, ale niekomercyjność planu
Hobby jest tykającym ograniczeniem dla produktu, który ma ambicję istnieć, a brak bazy na miejscu
nie odpowiada na nierozstrzygnięte pytanie o kolokację.

## Anti-Bias Cross-Check: Cloudflare Workers

Kontrola przebiegła dwa razy. Pierwsza tura dotyczyła EAS Hosting i doprowadziła do zamiany
lidera; jej wynik jest zachowany na końcu tej sekcji, bo to on uzasadnia obecną rekomendację.
Poniżej pełna tura dla wybranej platformy.

### Devil's Advocate — Weaknesses

1. **Adapter `workerd` jest najmniej przetartą z sześciu oficjalnych ścieżek.** Trafił do
   `expo-server` dopiero w SDK 57 (PR expo/expo#38531), a Expo dogfooduje EAS Hosting, które tej
   publicznej powierzchni nie używa. Zgłoszenie expo/expo#41473 opisuje już psujące się React
   Server Functions na Workers („Illegal invocation"). Gdy wyjście `expo export` i workerd się
   rozjadą, bisekcja jest Twoja — w trzecim tygodniu z czterech, po godzinach.
2. **Prawie każdy tutorial Cloudflare + Expo, który znajdziesz, jest błędny dla wrangler v4.**
   Obie społecznościowe paczki (`expo-adapter-workers`, `expo-workers`) konfigurują
   `[site] bucket = "./dist/client"` — czyli Workers Sites, **zdeprecjonowane w wrangler v4**
   z jawną adnotacją „nie używaj w nowych projektach". Poprawna konfiguracja to `assets.directory`
   plus `assets.binding`. Agent kopiujący pierwszy wynik wyszukiwania produkuje deploy, który
   albo się wywala, albo cicho nie serwuje niczego. Ta sama klasa błędu dotyczy poradników
   o Cloudflare Pages: Pages nadal działa, ale każda nowa funkcja platformy trafia najpierw do
   Workers, więc pójście za takim poradnikiem stawia projekt na gałęzi, z której Cloudflare
   odchodzi.
3. **Cloudflare nie ma produktu auth, a FR-001 jest must-have w tygodniu pierwszym.** Odrzucenie
   Supabase oznacza, że e-mail + hasło, sesje, reset hasła i izolacja danych per konto są Twoje
   do zbudowania. Better Auth + Drizzle + D1 to obecna odpowiedź, ale tarcie jest realne
   i udokumentowane: na Workers binding D1 istnieje wyłącznie wewnątrz `fetch(request, env, ctx)`,
   więc zarówno instancja Drizzle, jak i `betterAuth()` muszą powstawać per żądanie w tym zakresie
   — a każdy przykład Better Auth spoza Workers tworzy je na poziomie modułu. Reset hasła dokłada
   nadawcę maili (Resend / Postmark), czyli **trzeciego** dostawcę, którego zamiana miała uniknąć.
4. **D1 nie ma row-level security, więc „pełna izolacja danych między kontami" schodzi do
   dyscypliny w kodzie.** Postgres z RLS uczyniłby guardrail Access Control z PRD strukturalnie
   wymuszonym: jedna polityka i zapomniane `WHERE user_id = ?` nie wycieka cudzej wagi ani wieku.
   Na D1 każde zapytanie jest miejscem, w którym ten guardrail można cicho złamać — a repo nie ma
   runnera testów, który by to złapał ([CLAUDE.md](../../CLAUDE.md): „Nie ma runnera testów").
5. **Limity darmowego planu to urwiska, nie dławienie.** D1 free: 100 000 zapisanych wierszy
   dziennie i 5 mln odczytanych; Workers free: 100 000 żądań dziennie i **10 ms CPU na
   wywołanie**. To 10 ms jest ostrzem: generator z FR-008 przeszukuje kombinacje dań pod
   ograniczeniem ±10% kcal, listą wykluczeń i limitem czasu przygotowania. Przekroczenie CPU nie
   spowalnia — zabija wywołanie. Lekarstwem jest plan Workers Paid za 5 USD/mc (domyślnie 30 s,
   do 5 min CPU), więc historia „za darmo" to w rzeczywistości „5 USD/mc od momentu, gdy generator
   zacznie realnie liczyć".

### Pre-Mortem — How This Could Fail

Jest luty 2027. Aplikacja działa, ale nikt jej nie używa — łącznie z Tobą. Rozjazd zaczął się
w tygodniu drugim, gdy zamiast pisać generator, konfigurowałeś Better Auth pod bindingi Workers:
każdy przykład z sieci tworzył instancję na poziomie modułu, Twoja musiała powstawać w `fetch`,
a reset hasła wymagał czwartego wieczoru i konta w Resend. Tydzień trzeci zjadła migracja z
`web.output: "static"` na `"server"` — hydracja schematu kolorów zaczęła się rozjeżdżać, bo
założenie o statycznym renderowaniu webu było wpisane w kod, nie w konfigurację. Generator
powstał w tygodniu czwartym i od razu przekroczył 10 ms CPU, więc weszło 5 USD/mc — samo w sobie
nieistotne, ale to był moment, w którym „darmowy MVP" przestał być prawdą, a Ty przestałeś ufać
własnym szacunkom. Potem przyszła prawdziwa awaria: migracja D1 dodała kolumnę, deploy padł,
`wrangler rollback` cofnął kod, ale nie schemat. Aplikacja stała trzy dni. Wróciłeś do arkusza
kalkulacyjnego — tego samego, który produkt miał zastąpić — i tam zostałeś. Nigdy nie
rozstrzygnąłeś Open Question 1; cała robota poszła w hydraulikę pod przepisy, których nie było.

### Unknown Unknowns

- **Bindingi nie są w `process.env`.** Na Workers `env` — z D1 i sekretami — istnieje wyłącznie
  wewnątrz `fetch(request, env, ctx)`. To odwrotnie niż na EAS Hosting, gdzie Expo populuje
  `process.env`. Wybór własnego konta Cloudflare zmienia więc sposób dostępu do konfiguracji
  w każdej trasie API, a nie tylko miejsce wdrożenia.
- **`wrangler deploy` nie buduje.** Przed każdym wdrożeniem musi pójść `npx expo export -p web`.
  Jeden eksport produkuje dwa katalogi lądujące w dwóch różnych miejscach konfiguracji:
  `dist/client` w `assets.directory`, `dist/server` w parametrze `build` adaptera. Pomylenie ich
  daje deploy, który wstaje i zwraca 404 na wszystko.
- **`wrangler rollback` cofa kod Workera, nie schemat D1.** Migracja, która dodała kolumnę,
  zostaje po rollbacku. Cofnięcie nieudanej migracji jest ręczną migracją wstecz — dokładnie ta
  klasa awarii, którą chce się cofnąć jednym poleceniem o drugiej w nocy.
- **`npx expo start --web` nie jest workerd.** Dev server Expo uruchamia trasy API w Node, więc
  kod działający lokalnie może paść na produkcji na brakującym module Node albo na limicie CPU.
  Wierność runtime'u daje dopiero `npx wrangler dev` na zbudowanym `dist/` — a to wolniejsza
  pętla niż ta, którą znasz z Expo. To odwrotność częstego wzorca „dev server frameworka już
  zapewnia wierność": tutaj nie zapewnia i osobny krok jest konieczny.
- **TCP-owy Postgres jest poza zasięgiem, gdyby Open Question 1 poszła w stronę zewnętrznej bazy.**
  Izolat Workers nie ma gniazd TCP; Neon i Supabase wymagają sterownika po HTTP, a Hyperdrive to
  osobny, płatny produkt. Wybór D1 dziś zamyka furtkę „przeniesiemy się na Postgresa później"
  ciaśniej, niż to wygląda z zewnątrz.

### Pierwsza tura — EAS Hosting (lider odrzucony)

Zachowane, bo to te ustalenia uzasadniają zamianę:

1. **Typ `secret` nie działa z EAS Hosting** — dokumentacja Expo dopuszcza tylko `plain text`
   i `sensitive`. Klucz do modelu AI (jeśli tak rozstrzygnie się Open Question 1) byłby
   odczytywalny przez `eas env:pull`, a nie tylko zapisywalny.
2. **Deploymenty preview są publicznie dostępne** — każdy `eas deploy` produkuje żywy URL
   `*.expo.app` bez bramki dostępu; EAS Hosting nie ma odpowiednika Deployment Protection.
3. **Budżet darmowego planu jest miesięczny, nie dzienny** — 100 000 żądań na miesiąc, przy czym
   po przejściu na `web.output: "server"` renderowanie stron webowych zaczyna konkurować o ten
   sam budżet co wywołania API.
4. **Brak bazy i brak auth** — decyzja o platformie nie domykała FR-001 ani izolacji profilu,
   tylko przesuwała je do kolejnego dostawcy.
5. **Retencja logów 7 dni na planie darmowym** — diagnoza zgłoszonego z opóźnieniem złamania
   guardraila ±10% byłaby niemożliwa z logów.

## Operational Story

- **Preview deploys**: działa dopiero po pierwszym `wrangler deploy` (Worker musi istnieć).
  `npx wrangler versions upload` tworzy wersję z własnym URL-em preview
  w formacie `<prefiks-wersji>-<nazwa-workera>.<subdomena>.workers.dev` **bez** kierowania na nią
  ruchu produkcyjnego; promocja to `npx wrangler versions deploy`. URL-e preview są **domyślnie
  publiczne** — zamknięcie ich wymaga Cloudflare Access (Zero Trust, darmowy do 50 użytkowników)
  albo wyłączenia ich w konfiguracji przez `preview_urls = false`. URL-e wersjonowane wymagają
  wrangler ≥ 3.74.0, aliasowane ≥ 4.21.0.
- **Secrets**: `npx wrangler secret put NAZWA` zapisuje jednokierunkowo — wartości nie da się
  odczytać z powrotem, `wrangler secret list` pokazuje wyłącznie nazwy. Lokalnie odpowiednikiem
  jest plik `.dev.vars`, który **musi** trafić do `.gitignore`. Rotacja to ponowne `secret put`
  plus redeploy; nie ma osobnego przepływu rotacji.
- **Rollback**: `npx wrangler rollback [id-wersji]` natychmiast tworzy nowe wdrożenie ze wskazanej
  wersji na wszystkich trasach i domenach; zasięg to 100 ostatnio opublikowanych wersji.
  Czas cofnięcia liczy się w sekundach. **Zastrzeżenie danych**: rollback nie dotyka schematu D1
  — migracja bazy nie cofa się razem z kodem i wymaga osobnej migracji wstecz.
- **Approval**: agent może samodzielnie robić `expo export`, `wrangler versions upload`,
  `wrangler deploy`, `wrangler tail`, `wrangler d1 execute` na zapytaniach odczytowych oraz
  `wrangler rollback`. Wyłącznie dla człowieka, ręcznie w panelu: `wrangler d1 delete`,
  `wrangler delete`, rotacja sekretu produkcyjnego, zmiana planu i cokolwiek dotykającego DNS.
  Token API musi być zawężony do Workers i D1 tego jednego projektu — bez DNS, bez rozliczeń,
  bez sekretów innych projektów — i musi mieszkać w zmiennej środowiskowej, nie w commitowanym
  `.mcp.json`.
- **Logs**: `npx wrangler tail` daje logi na żywo. Trwałe logi wymagają włączenia observability
  w konfiguracji (`"observability": { "enabled": true, "head_sampling_rate": 1 }`, wrangler
  ≥ 3.78.6); plan darmowy to 200 000 zdarzeń dziennie i **3 dni** retencji, płatny 20 mln
  miesięcznie i 7 dni. Zapytania o stan bazy idą przez `wrangler d1 insights`.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Generator planu (FR-008) przekracza 10 ms CPU na planie darmowym i wywołanie zostaje zabite | Devil's advocate | H | H | Załóż plan Workers Paid (5 USD/mc) od pierwszego dnia pracy nad generatorem; zmierz czas CPU najgorszego przypadku (max wykluczeń, 5 posiłków) zanim uznasz go za gotowy |
| Agent kopiuje konfigurację `[site]` ze społecznościowego adaptera lub poradnika o Pages i deploy cicho nie serwuje niczego | Devil's advocate | H | M | Zapisz w [CLAUDE.md](../../CLAUDE.md) twardą regułę: wyłącznie `expo-server/adapter/workerd` + `assets.directory`; `[site]`, Workers Sites i Cloudflare Pages są zakazane w tym repo |
| Zapomniane `WHERE user_id = ?` łamie guardrail izolacji danych profilu, a D1 nie ma RLS i repo nie ma testów | Devil's advocate | M | H | Cały dostęp do danych użytkownika przez jedną warstwę repozytorium przyjmującą `userId` jako pierwszy argument; żadnego surowego SQL-a w trasach API |
| Migracja D1 psuje produkcję, a `wrangler rollback` cofa tylko kod | Unknown unknowns | M | H | Każda migracja pisana z gotową migracją wstecz w tym samym commicie; migracje wyłącznie addytywne w MVP (bez `DROP COLUMN`, bez zmiany typu) |
| Publiczny URL preview wystawia kopię aplikacji wpiętą w produkcyjne D1 | Research finding | M | H | Cloudflare Access na Workerze przed pierwszym `versions upload`, albo `preview_urls = false` i testowanie wyłącznie przez `wrangler dev` |
| Biblioteka auth bundlowana przez Metro do `dist/server` nie startuje na workerd (warunki eksportu, `createRequire`, czysto-JS hashowanie) | Przegląd planu 2026-08-31 | H | H | Zdezaktualizowane przez aneks: tożsamość prowadzi Clerk, więc w bundlu serwera zostaje wyłącznie weryfikacja podpisu. Ryzyko resztkowe dotyczy `@clerk/backend`; ścieżka odwrotu to `jose` przeciw temu samemu kluczowi PEM |
| Tożsamość mieszka u zewnętrznego dostawcy — awaria, zmiana cennika lub wymóg rezydencji danych wymuszają migrację użytkowników | Aneks 2026-09-01 | L | H | Kod produktowy zna wyłącznie `userId` jako string i nie duplikuje danych tożsamościowych; wymiana dostawcy dotyka ekranów auth i jednej funkcji weryfikującej token, nie warstwy danych |
| Przejście `web.output` ze `static` na `server` psuje hydrację schematu kolorów i inne założenia statycznego renderowania | Pre-mortem | M | M | Zmień `web.output` osobnym commitem, uruchom `npx tsc --noEmit` i otwórz web przed dołożeniem pierwszej trasy `+api.ts`; zaktualizuj sekcję o `use-color-scheme` w [CLAUDE.md](../../CLAUDE.md) |
| Kod działa w `expo start --web`, ale pada na workerd (brak modułu Node, limit CPU) | Unknown unknowns | H | M | `npx wrangler dev` na zbudowanym `dist/` jako bramka przed każdym deployem — nie `expo start --web` |
| Adapter `workerd` jest świeży (SDK 57) i ma otwarte zgłoszenia; blokujący bug zatrzymuje projekt | Devil's advocate | M | H | Ścieżka odwrotu: ten sam `npx expo export -p web` deployuje się przez `eas deploy` na EAS Hosting (ten sam runtime) — trzymaj ją jako plan B, nie przepisuj kodu pod Cloudflare |
| Sekret do modelu AI wycieka, jeśli Open Question 1 pójdzie w stronę generowania przepisów | Research finding | M | H | Wyłącznie `wrangler secret put`; klucz nigdy w kodzie klienta ani w `EXPO_PUBLIC_*`; `.dev.vars` w `.gitignore` od pierwszego commita |
| Twarde dzienne limity D1 (100 tys. zapisów) trafione przez pętlę generatora zapisującą warianty planu | Research finding | L | M | Zapisuj wyłącznie zaakceptowany plan, nie kandydatów; warianty trzymaj w pamięci wywołania |

## Getting Started

Polecenia zweryfikowane pod Expo SDK 57 (`expo ~57.0.18`, `expo-router ~57.0.17`) i wrangler v4.
Nie kopiuj konfiguracji z poradników o Cloudflare Pages ani z paczek `expo-adapter-workers` /
`expo-workers` — używają `[site]`, czyli zdeprecjonowanego Workers Sites.

1. **Zainstaluj runtime serwera i wrangler.**
   ```sh
   npx expo install expo-server
   npm i -D wrangler@4
   ```

2. **Włącz tryb serwerowy w `app.json`.** Zmień `web.output` ze `"static"` na `"server"`
   (`slug` i `scheme` zostaw nietknięte):
   ```json
   "web": { "bundler": "metro", "output": "server", "favicon": "./assets/images/favicon.png" }
   ```
   Zrób to osobnym commitem i sprawdź web przed dołożeniem pierwszej trasy API — to zmienia
   kontrakt renderowania opisany w [CLAUDE.md](../../CLAUDE.md).

3. **Dodaj punkt wejścia Workera** — `worker.ts` w katalogu głównym:
   ```ts
   import { createRequestHandler, type RequestHandler } from 'expo-server/adapter/workerd';

   import { setWorkerEnv } from './src/server/env';

   const handler: RequestHandler = createRequestHandler({ build: './dist/server' });

   export default {
     fetch(request: Request, env: unknown, ctx: Parameters<RequestHandler>[2]) {
       setWorkerEnv(env);
       return handler(request, env, ctx);
     },
   };
   ```
   Dwie rzeczy, które nie są kosmetyką. `ctx: unknown` **nie przechodzi** `tsc` — trzeba wziąć typ
   od adaptera (`Parameters<RequestHandler>[2]`), co przy okazji oszczędza `@cloudflare/workers-types`
   i kolizji globalnych `Request` / `Response` z `lib: ["DOM", "ESNext"]`. A `setWorkerEnv(env)` jest
   konieczne, bo **adapter nie przekazuje bindingów do tras API**: `createWorkerdRequestScope` przyjmuje
   `_env` i go ignoruje, a request scope wystawia tylko `origin`, `requestHeaders`, `waitUntil`,
   `deferTask`, `setResponseHeaders`. `worker.ts` idzie przez esbuild, a trasy `+api.ts` przez Metro do
   `dist/server` — dwa osobne bundle, więc stan modułowy się nie dzieli i jedynym kanałem jest
   `globalThis`. Zamknij to w jednym module (`src/server/env.ts`), nie rozsiewaj po trasach.

4. **Utwórz bazę i skonfiguruj `wrangler.jsonc`.**
   ```sh
   npx wrangler d1 create mealplan
   ```
   ```jsonc
   {
     "name": "meal-plan",
     "main": "worker.ts",
     "compatibility_date": "2026-08-28",
     "compatibility_flags": ["nodejs_compat"],
     "preview_urls": false,
     "assets": {
       "binding": "ASSETS",
       "directory": "dist/client",
       "html_handling": "none",
       "not_found_handling": "none"
     },
     "find_additional_modules": true,
     "base_dir": ".",
     "rules": [
       { "type": "CommonJS", "globs": ["dist/server/**/*.js"] },
       { "type": "Text", "globs": ["dist/server/**/*.html", "dist/server/**/*.json"] },
       { "type": "Data", "globs": ["dist/server/**/*.bin"] },
       { "type": "CompiledWasm", "globs": ["dist/server/**/*.wasm"] }
     ],
     "observability": { "enabled": true, "head_sampling_rate": 1 },
     "d1_databases": [
       { "binding": "DB", "database_name": "mealplan", "database_id": "<z polecenia wyżej>" }
     ]
   }
   ```
   Sam `assets.directory` **nie wystarczy** — to ustalenie z pierwszego wdrożenia (2026-08-31), nie
   ostrożność:

   - `find_additional_modules` + `rules` są wymagane, bo adapter czyta manifest, HTML i moduły tras
     przez `import()` ze **zmiennym** prefiksem (`${build}/${request}`), czego esbuild nie zbunduluje
     statycznie. Bez tego deploy wstaje i zwraca 404 na wszystko.
   - Typ dla `dist/server/**/*.js` to **`CommonJS`**, nie `ESModule`. Metro kończy bundel trasy API
     linią `module.exports = __r(...)`; deklaracja ESModule daje w runtime `ReferenceError: module is
     not defined` i 500 na trasie API, przy poprawnie działającym HTML-u.
   - Reguły `Data` i `CompiledWasm` są zawężone do `dist/server`, mimo że nie ma tam ani `.bin`, ani
     `.wasm`. Powód: reguła użytkownika bez `"fallthrough": true` **usuwa** regułę domyślną tego samego
     typu (`parseRules` w wranglerze). Bez nich domyślne `**/*.bin` i `**/*.wasm` zamiatają
     `node_modules` (m.in. `react-native/React/I18n/**` i `blake3-wasm`) — 46 modułów, 8.9 MB,
     3.5 MB gzip, czyli **ponad limit skryptu na planie darmowym**. Z nimi: 6 modułów, 98 KiB, 25 KiB gzip.
   - `html_handling: "none"` + `not_found_handling: "none"`, bo właścicielem HTML-a jest Worker.
     Sprawdzone: przy `output: "server"` eksport **nie** kładzie żadnego `.html` w `dist/client`
     (poza `--no-ssg`), więc routing „assets first" jest bezpieczny i nie przechwytuje `/`.
   - `compatibility_date` nie może wyprzedzać runtime'u dostarczonego z wranglerem. wrangler 4.127.1
     wiezie workerd `1.20260828.1`, więc `2026-08-28` to maksimum.

5. **Zbuduj, sprawdź wierność runtime'u, wdróż.** `wrangler deploy` **nie buduje** — eksport musi
   pójść przed każdym wdrożeniem:
   ```sh
   npx expo export -p web        # produkuje dist/client i dist/server
   npx wrangler deploy --dry-run --outdir .wrangler-dry   # sprawdź listę modułów PRZED zdalnym
   npx wrangler dev              # workerd lokalnie — jedyny wierny test
   npx wrangler versions upload  # wersja bez ruchu produkcyjnego
   npx wrangler deploy           # produkcja
   ```
   **Uwaga na kolejność przy pierwszym wdrożeniu:** `versions upload` odbija się o „You cannot upload
   a new version of a Worker that does not yet exist". Pierwsza wersja musi pójść przez `deploy`;
   ścieżka preview-przed-produkcją działa dopiero od drugiego wdrożenia.

   Krok `--dry-run --outdir` jest tani i wychwytuje dokładnie te dwie awarie, które wyżej: czy
   `dist/server/**` weszło jako dodatkowe moduły i czy nie weszło nic z `node_modules`.

6. **Zabezpiecz sekrety i preview, zanim wejdą prawdziwe dane.** `echo ".dev.vars" >> .gitignore`,
   `npx wrangler secret put <NAZWA>` dla każdego klucza, oraz Cloudflare Access na Workerze
   (albo `"preview_urls": false`) przed pierwszym `versions upload`.

## Out of Scope

Badanie nie obejmowało:
- konfiguracji obrazów Docker,
- konfiguracji potoku CI/CD (`ci_provider: github-actions` z [tech-stack.md](tech-stack.md)
  czeka na osobną decyzję),
- architektury w skali produkcyjnej (wiele regionów, HA, DR),
- wyboru źródła przepisów i makr — Open Question 1 z [prd.md](prd.md) pozostaje otwarte i nadal
  blokuje generator planu.
