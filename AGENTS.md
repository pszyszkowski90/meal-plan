# Repository Guidelines

Reguły tego repozytorium żyją w jednym pliku: **[CLAUDE.md](CLAUDE.md)**. Przeczytaj go teraz,
zanim zaczniesz pracę — ten plik jest tylko wskaźnikiem i nie zawiera żadnych reguł.

Powód takiego układu: konwencja społeczności stawia `AGENTS.md` jako źródło prawdy, ale Claude Code
w tej instalacji nie wczytuje `AGENTS.md` i nie rozwija importu `@AGENTS.md`, a `ln -s AGENTS.md
CLAUDE.md` jest na tym Windowsie zablokowane (brak uprawnień do symlinków). Reguły muszą więc
fizycznie leżeć w `CLAUDE.md`. Nie duplikuj ich tutaj — duplikaty instrukcji rozjeżdżają się tak
samo szybko jak duplikaty kodu.
