# Brief: Moduł 5, Lekcja 4 — Shared AI Registry

> **Lekcja świadomie nieprzerobiona na MealPlanie.** Treść lekcji dostępna. Trzy skille, które
> zostawiła (`/pack-init`, `/tf-registry`, `/setup-cicd`), **leżą w `.claude/skills/`** i są
> nieużyte — to jedyny ślad tej lekcji w repo.

## Co lekcja wprowadza

Dystrybucję **zespołowych artefaktów AI** — skilli, promptów i reguł — tak samo jak dystrybuuje się
kod: jako **wersjonowaną paczkę w rejestrze, który organizacja już ma**. Trzy modele dobrane
do odbiorcy:

- **GitHub Packages** — domyślny;
- **AWS CodeArtifact + Terraform** — świadoma ścieżka zarządzanej infrastruktury;
- **pełny produkt API + CLI** — dostarczanie na zewnątrz, z bramkowaniem.

Niezależnie od modelu obowiązują te same niezmienniki: **znaczniki wartownicze** wokół
wstrzykiwanych bloków, **odinstalowanie śledzone manifestem** i **przenośność `SKILL.md`**.
Lekcja dowozi też szablony startowe — `package.json`, instalator i deinstalator, `.npmrc`
konsumenta, publikowanie z GitHub Actions — oraz metapętlę: skille, które generują kolejne paczki.

## Dlaczego nie daje się jej przerobić na MealPlanie

Cała lekcja odpowiada na pytanie **„jak rozprowadzić to po zespole"**. Projekt jest jednoosobowy,
więc pytanie nie powstaje. Rejestr, uprawnienia, wersjonowanie i deinstalacja rozwiązują problem
koordynacji między ludźmi, których tu nie ma.

Do tego MealPlan **jest konsumentem takiej dystrybucji, nie jej dostawcą**: `.claude/skills/`
wypełnia `10x-cli` i to on zarządza blokiem w `CLAUDE.md` przez znaczniki
`<!-- BEGIN @przeprogramowani/10x-cli -->`. Budowanie własnego rejestru obok tego byłoby drugim
mechanizmem na tę samą rzecz.

## Co musiałoby być prawdą, żeby się nadawała

Kilka repozytoriów **dzielących te same reguły** i ludzie, którzy muszą dostać ich aktualizację
bez ręcznego kopiowania. Przy jednym repo i jednym autorze `git` wystarcza.

## Co z niej zabieram mimo to

1. **Niezmiennik znaczników wartowniczych zobaczyłem dziś od strony kosztu.** Blok
   `<!-- BEGIN @przeprogramowani/10x-cli -->` w `CLAUDE.md` to dokładnie ten wzorzec — i w zadaniu
   B2 **usunąłem go**, odzyskując 30 linii niepustych. Lekcja tłumaczy, dlaczego to usunięcie jest
   tymczasowe: blok jest **zarządzany**, więc wróci przy następnym `10x get`. Znaczniki dają
   właścicielowi paczki prawo do nadpisania i to działa w obie strony.
2. **Deinstalacja śledzona manifestem wyjaśnia najgroźniejszą pułapkę tego repo.**
   `10x get <ref>` nie dokłada kumulatywnie — **synchronizuje** `.claude/skills/` do manifestu
   żądanej lekcji, więc kasuje wszystko spoza niego. To nie jest błąd narzędzia, tylko **poprawnie
   zaimplementowana deinstalacja śledzona manifestem**, uruchomiona z niewłaściwym oczekiwaniem.
   Zrozumienie mechanizmu zmienia tę pułapkę z magii w regułę — i dlatego stoi dziś jako reguła
   numer jeden w `CLAUDE.md`.
3. **Przenośność `SKILL.md`.** Skille w tym repo są w markdownie z frontmatterem, bez kodu — dzięki
   temu przeżyły ręczne nałożenie siedmiu skilli Modułu 5 na manifest m3l5. Format, który da się
   skopiować i który nic nie zakłada o narzędziu, jest odporniejszy niż instalator.
