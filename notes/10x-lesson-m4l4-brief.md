# Brief: Moduł 4, Lekcja 4 — refaktoryzacja z agentem

> **Lekcja świadomie nieprzerobiona na MealPlanie.** Treść lekcji dostępna.

## Co lekcja wprowadza

Drogę od „mamy problemy" do **obronionej decyzji refaktoryzacyjnej**, w której badanie i decyzja
są rozdzielone:

1. **Zmiana tylko badawcza z jawną intencją** — `m4l4-1-new-change-intention`.
2. **Trzy soczewki wyłącznie do odczytu** na każdy zapisany problem: obecny kształt, historia
   i intencjonalność decyzji, wykonalność migracji. Opcje zostają **uszeregowane, ale nie wybrane
   wewnątrz badania** — to jest sedno rozdziału ról.
3. **Potwierdzenie twierdzeń strukturalnych przez `ast-grep`**, zanim ranking cokolwiek znaczy.
4. Obrona wyboru w wywiadzie `/10x-plan` i plan **guard-first**, fazowy, z każdą fazą
   **niezależnie odwracalną**, przekazany do `/10x-implement`.

Repertuar techniczny: **Strangler Fig**, **Branch by Abstraction**, kolejność w stylu **Mikado**
oraz **testy charakteryzujące** jako uprząż bezpieczeństwa dla kodu legacy.

## Dlaczego nie daje się jej przerobić na MealPlanie

Lekcja zakłada **zastane problemy strukturalne, których nikt nie wybrał** — kod, który ktoś
odziedziczył. Ten projekt ma trzy tygodnie i każdą nietrywialną decyzję zapisaną wraz z odrzuconymi
opcjami (`options.md`, `infrastructure.md`, D1–D19). Nie ma tu warstwy, o której trzeba by pytać
„czy to było celowe" — soczewka druga zwróciłaby wyłącznie odnośniki do dokumentów.

Dług, który istnieje, jest **nazwany i zaadresowany**, a nie do wykrycia: `follow-ups/review-fixes.md`
(indeks na `dish_ingredient`, `meta` w typie D1), Otwarte pytania w `research.md`, cztery ustalenia
PENDING z przeglądu fazy 3 S-02. To jest lista zadań, nie materiał na ranking opcji.

Testy charakteryzujące też nie mają czego charakteryzować: 66 testów jednostkowych i 23 E2E
powstały **razem z kodem**, a nie po fakcie, żeby przybić zachowanie, którego nikt nie rozumie.

## Co musiałoby być prawdą, żeby się nadawała

Moduł, którego zachowania nie da się wyprowadzić z dokumentów ani testów — i którego ruszenie jest
konieczne, bo blokuje coś nowego. W MealPlanie najbliżej tego stanu jest **warstwa nawigacji**
(rozdwojona na `app-tabs.tsx` / `app-tabs.web.tsx`, z niespójnym nazewnictwem `index` kontra
`home`), ale ona jest opisana i broniona w `CLAUDE.md`, a nie zastana.

## Co z niej zabieram mimo to

1. **„Uszereguj opcje, nie wybieraj ich wewnątrz badania."** Zastosowałem dokładnie tę granicę
   dziś w `research.md` dla S-03: trzy warianty warstwy grup wykluczeniowych zostały wypisane
   z dowodami i **jawnie zostawione właścicielowi**, bo wybór modyfikuje kontrakt z decyzji D14.
   Badanie dostarcza dowody, nie zastępuje decyzji.
2. **Każda faza niezależnie odwracalna.** To repo ma tę zasadę w postaci par `migrations/down/`,
   i dziś ją zweryfikowałem w przeglądzie fazy 1 F-01 — pięć `DROP` w kolejności odwrotnej do
   zależności plus `DELETE FROM d1_migrations`, bez którego `migrations apply` nie odtworzyłby tabel.
3. **Guard-first.** Kolejność „najpierw bramka, potem zmiana" powtórzyła się dziś dwa razy:
   czerwony test przed poprawką F5 oraz bramka CI przed dalszymi zmianami.
