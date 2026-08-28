---
starter_id: expo
package_manager: npm
project_name: meal-plan
hints:
  language_family: js
  team_size: solo
  deployment_target: appstore-via-eas
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Solo build, 4 tygodnie po godzinach, product_type `mobile`, rodzina językowa
JS/TS — dla tej komórki rejestr wskazuje Expo (React Native) i użytkownik
przyjął rekomendację. Trzy czynniki niosą tę decyzję: krótki budżet czasu
premiuje starter sprawdzony end-to-end przez bootstrapper (`verified`),
jeden kod na iOS, Androida i web obsługuje zapisane w shape-notes wymaganie
równorzędnej powierzchni webowej bez drugiego projektu, a TypeScript plus
konwencje Expo Routera domykają wszystkie cztery bramki jakości, więc
`quality_override` jest fałszywe. Karta Expo nie wnosi backendu, dlatego
konto e-mail+hasło (FR-001) i izolacja danych profilowych (Access Control)
wymagają dobrania warstwy danych osobno — to pierwsza decyzja po
scaffoldowaniu, obok offline'owej dostępności planu i listy zakupów
(Non-Functional). `has_ai` jest fałszywe świadomie: generowanie przepisów
przez model to jedna z rozważanych, nierozstrzygniętych opcji w Open
Question 1, a nie zatwierdzony zakres MVP. Wdrożenie celuje w EAS z profilem
wewnętrznym — APK instalowany ręcznie, publikacja w sklepie odłożona.
