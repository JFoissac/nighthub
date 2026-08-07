# Market Intel — chantier en cours (07/08)

## FAIT
- Backend `market-intel.service.ts` + tests (commit 78dbb7d) : Fear&Greed (alternative.me, cache 1h, stale-while-error), VIX snapshot (depuis market data), TCSD (mots-clés crypto sur posts+news Trump), sentiment composite risque-on/off
- Endpoints : GET /api/market/fear-greed, /sentiment, /news (newsapi.org, NEWS_API_KEY)
- Frontend market-section : jauge sentiment dans le header (score+label coloré+tooltip F&G/VIX/TCSD), onglet NEWS (GRID/LIST/NEWS), signal + fetch toutes les 60s
- Graph déplié : path SVG animé (sparkline-draw, effet de tracé 0.9s) + échelle min/max + label 7D, reveal du bloc (fadeInUp 0.35s), coupés par prefers-reduced-motion

## RESTE À FAIRE
- [ ] Valider typecheck frontend (npx tsc -p tsconfig.app.json)
- [ ] Valider build Angular (ng build) + vérifier rendu sur 4201
- [ ] Commit frontend + routes + .md
- [ ] (Optionnel) sparkline animée aussi dans la vue GRID compacte (actuellement seulement dans le bloc déplié)

## Notes
- Pas de tests unitaires supplémentaires (règle éco tokens) — seuls les tests existants doivent passer
- NEWS_API_KEY déjà dans server/.env
