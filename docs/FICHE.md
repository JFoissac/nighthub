---
titre: FICHE — NightHub
projet: nighthub
role: "Dashboard personnel nocturne : agrège en UNE page les sources que JF regarde chaque jour (Twitch live, YouTube, X/Nitter, Trump Watch, veille news IA, météo, marchés) — zéro donnée en dur."
stack: [Angular 21.2 (standalone, zoneless, Signals) + Nx 22.6.5, Tailwind 3.4, Chart.js 4.5, lucide-angular, Jest 29 (front) ; backend Express 5 + tsx (TypeScript) + Prisma + SQLite + node-cron, Vitest (back)]
ports: { frontend: 4201, backend: 3001 }
urls: ["http://localhost:4201", "http://127.0.0.1:3001/health"]
depots: ["C:\\Bureau\\Dev\\nighthub", "https://github.com/JFoissac/nighthub.git"]
services: ["backend Express/tsx sur :3001 (server/)", "front Angular/Nx sur :4201 (racine Nx)", "démarrage auto Windows : HKCU\\Run → wscript nighthub-start.vbs (caché)", "cron internes node-cron dans le backend (refresh, Twitch, YouTube, Trump)"]
donnees: "SQLite Prisma : server/prisma/dev.db (Tweet, TrumpTweet, TrumpNewsItem, TwitchStream, TwitchFollow, YoutubeVideo, AiNewsItem, WeatherCache, OAuthToken, UserPreference, ContentScore) + snapshots JSON persistants server/data/{dashboard-snapshot,market-snapshot,trump-trained-profile}.json"
depend_de: ["Twitch (Helix/GQL), YouTube (RSS + API v3 + repli Piped), X/Nitter (multi-instances), flux RSS médias, météo (OpenWeatherMap/Open-Meteo), marchés (Binance, Yahoo, Alpha Vantage, newsapi.org), provider OpenAI-compatible pour Trump Watch IA", "LifeHub : le micro-frontend vanilla NightHub (apps/nighthub, :4331, proxy /api/nh → :3001) vit sur la branche feat/nighthub du dépôt LifeHub — non fusionnée dans sa branche courante", "DevHub (launcher : steps front :4201 + back :3001)"]
sante: "curl -s http://127.0.0.1:3001/health → {\"status\":\"ok\"} ; curl -s -o /dev/null -w '%{http_code}' http://[::1]:4201/ → 200"
tests: "front : npx jest (194/194 verts, 28 suites — 2026-09-19). back : cd server && npm test (Vitest, 246/246 verts — 2026-09-19). Types : cd server && npm run typecheck."
branche_courante: feat/evo
owner: JF
statut: actif
last_reviewed: 2026-09-19
---

# FICHE — NightHub

## 1. À quoi ça sert
NightHub est le tableau de bord nocturne de JF : une seule page qui rassemble les streams Twitch en direct des chaînes suivies, les dernières vidéos YouTube, la timeline X/Twitter, les posts de Trump scorés (criticité 0-10) avec une veille presse associée, les news IA, la météo de la semaine et les marchés (crypto et actions par groupes de tickers, avec sparklines et un indice de sentiment). Aucune donnée n'est codée en dur : tout vient de flux (RSS/GQL/scraping) ou des préférences de l'utilisateur.

## 2. État actuel
- **Marche** : backend sur :3001 vérifié vivant le 19/09 (`/health` 200, `/api/dashboard` 200) ; front sur :4201 servi (200 en IPv6) ; 246/246 tests backend et 194/194 tests front verts ; cron actifs ; démarrage auto Windows en place (`HKCU\Run` → `nighthub-start.vbs`). Dernier commit : *2026-08-26 « fix(youtube): sert tout le cache 7j de videos au dashboard (limite 20 -> 100) »*.
- **En chantier** : branche `feat/evo`. Le module Énergie (Conso API/Linky) **n'existe plus dans le code** (ni `energy.*.ts` côté serveur ni route) : il a été stoppé et retiré — à ne pas confondre avec une fonctionnalité en place. Restent non commités : `server/data/trump-trained-profile.json` (snapshot réentraîné) et des fichiers non suivis (`.freebuff/`, `docs/review/crypto-dashboard-reference.png`, `docs/review/prompt-refonte-lifehub.txt`).
- **À VENIR** : chantier annoncé dans `PLAN.md` — **chargement des données au lancement** (dashboard quasi instantané au boot, stale-while-revalidate) ; P1/P2 du diagnostic UI/UX non traités (unifier les 3 sources de couleurs — tokens Tailwind vs `:root` vs hex inline, unités 24 h incohérentes entre crypto et actions, `lg:col-span-5/7` inertes, focus trap des modales) ; badge « DÉMO » si la source l'est, sinon LIVE.

## 3. Démarrage / arrêt
```bash
# démarrage normal (caché, sans console) — ne PAS lancer si :3001/:4201 sont déjà pris (EADDRINUSE)
wscript.exe "C:\Users\Donwar\nighthub-start.vbs"

# démarrage manuel (2 terminaux)
cd C:/Bureau/Dev/nighthub && npm start          # front Nx → :4201
cd C:/Bureau/Dev/nighthub/server && npm run dev # back tsx → :3001
npm run dev:all                                 # les deux en concurrence (racine Nx)

# logs / debug (fichiers posés par le porteur)
#   C:\Users\Donwar\nighthub-logs\backend.log + frontend.log   (redirigés à chaque boot)
#   C:\Users\Donwar\nighthub-logs.bat (2 fenêtres tail) · nighthub-debug.bat (consoles visibles)

# arrêt d'un service
MSYS_NO_PATHCONV=1 taskkill /F /PID <pid>      # ⚠ taskkill en git-bash : //F échoue
```

## 4. Architecture
- **Backend** (`server/`, hors graphe Nx, `package.json` propre) : `src/app.ts` en *listen-first* (connexion Prisma → `app.listen()` → tâches lourdes seulement APRÈS, d'où le boot passé de 60-120 s à ~5,8 s). `routes/` (health, auth, api, dashboard, market, news, preferences, twitch, youtube) · `services/` (aggregator, twitch, youtube, twitter/Nitter, trump.* : scoring/trainer/archive/weak-scorer/severity/ai/news-veille, news, weather, market, market-intel, backend.runtime) · `jobs/aggregator.cron.ts` · `middleware/` (validation Zod, rate limit `/api` 100/min, refresh 10/min) · `db/prisma.client.ts`.
- **Cron** : refresh global `*/30`, Twitch live `*/5`, vérification des lives YouTube `*/5`, tweets Trump `*/15`, ré-entraînement du profil Trump toutes les 6 h (snapshot persistant, pas de retrain à froid au boot).
- **Frontend** (racine Nx, projet `nighthub`) : Angular 21.2 zoneless (`provideZonelessChangeDetection` dans `app.config.ts`), composants par source (stream, video, tweet, trump, ai-news, weather, market) + `settings-modal`, composant réutilisable `sparkline.component.ts` (**Chart.js** — canvas, plugin `edgePricePlugin` pour les prix aux extrémités), `api.service.ts` sur `:3001`. Le nom de projet Nx est `nighthub` (`project.json`) — `npx nx serve nighthub`.
- **Docs** : `PROJECT-DOC.md` (fonctionnel + technique), `PLAN.md` (phases et état), `README.md`, `docs/DASHBOARD_GOAL.md` (UX de refresh, bandes de criticité Trump, groupes de tickers), `docs/rss-youtube-analysis.md`, `docs/design-system/` (maquettes HTML/PNG + `DESIGN.md`), `docs/review/PROJECT-DOCUMENTATION.md`.

## 5. Données & dépendances externes
- **Base** : SQLite via Prisma (`server/prisma/dev.db`, `DATABASE_URL="file:./dev.db"`), schéma poussé avec `npm run db:push` / `db:migrate`.
- **Caches/snapshots** (survivent au redémarrage, dans `server/data/`) : `dashboard-snapshot.json`, `market-snapshot.json`, `trump-trained-profile.json` (~6 Mo).
- **APIs tierces** : Twitch Helix (+ GQL public en repli), YouTube RSS/API v3/Piped, Nitter (rate-limité → repli multi-instances), RSS médias pour la veille Trump, météo, marchés (Binance + klines 7 j, Yahoo chart, Alpha Vantage, newsapi.org), Fear & Greed `api.alternative.me`, provider OpenAI-compatible optionnel (`TRUMP_AI_*` — sans clé, repli automatique sur le scoring de criticité).
- **Config** : `server/.env` (présent sur la machine, `PORT=3001`) ; gabarit complet et commenté dans `server/.env.example`. CORS sur `4200` + `4201`.
- **Autres apps** : DevHub lance les deux process ; le micro-frontend vanilla de LifeHub (branche `feat/nighthub`) consomme `/api/nh/*` → `:3001`.

## 6. Points sensibles / pièges connus
- **Le front n'écoute qu'en IPv6** (`[::1]:4201`, vérifié le 19/09) : `curl http://127.0.0.1:4201/` échoue alors que `http://[::1]:4201/` répond 200 et que le navigateur marche. Diagnostic : regarder `netstat -ano | grep ":4201"`, pas le curl IPv4.
- **Des worktrees d'agents traînent dans le repo** (`.freebuff/worktrees/<uuid>/`, `.claude/worktrees/<slug>/`) : `npx jest` les ramasse et affiche des suites en échec qui n'ont rien à voir avec `src/` (constaté le 19/09 : 20 suites « failed » toutes situées dans un worktree). `jest.config.ts` ignore `node_modules`, `dist`, `server/`, `.claude/`, `.opencode/` — **pas** `.freebuff/`. Run de référence : `npx jest --testPathIgnorePatterns "/node_modules/" "/dist/" "/server/" "/.claude/" "/.opencode/" "/.freebuff/"` → 28 suites / 194 tests verts. `.nxignore` (`.freebuff/`) existe pour éviter le doublon de projets Nx.
- **Le front se teste avec Jest, pas avec Nx** : `nx test` utilise le builder `@angular/build:unit-test` (Vitest) et casse sur `jest.setup.ts`. Toujours `npx jest`.
- **Nx + worktree** → « The following projects are defined in multiple locations » : le graph voit deux fois le projet. Garder `.nxignore`.
- **`ng serve` peut échouer en silence** : une erreur de compilation (méthode supprimée encore référencée dans un template) laisse le serveur servir l'ANCIENNE version. Quand un changement ne se voit pas : lire la sortie de `nx serve` (chercher `✘ [ERROR]`) AVANT de conclure au cache navigateur.
- **Prisma pendant que le serveur tsx tourne** : `db push` peut échouer en EPERM sur `query_engine-windows.dll.node` (dll verrouillée) — non bloquant, le client JS est régénéré, mais il faut redémarrer le serveur pour charger le nouveau code.
- **`npm install X` peut purger les devDependencies** sur cette machine (`npm config get omit` = dev) : utiliser `npm install --include=dev`.
- **Changements non commités fréquents** (passes d'agents) : `git status` avant d'éditer ; commiter par fichiers explicites, jamais `git add -A`.
- `PROJECT-DOC.md` s'ouvre comme du binaire dans certains lecteurs (accents/encodage) : le décoder en `utf-8` (`errors='replace'`) avant édition, réécrire en UTF-8.
- `taskkill` en git-bash : `MSYS_NO_PATHCONV=1 taskkill /F /PID <pid>`.
- **« NO STREAMS LIVE » n'est pas un bug** (correction explicite du porteur) : aucun stream en cours = état normal. Ne pas « corriger ».
- Le port du backend est **3001** (le `README.md` racine dit encore 3000, `.env.example` aussi) — la vérité est `server/.env`.

## 7. Tests & non-régression
```bash
cd C:/Bureau/Dev/nighthub

# frontend (Jest) — 194/194 verts, 28 suites (vérifié 2026-09-19)
npx jest --testPathIgnorePatterns "/node_modules/" "/dist/" "/server/" "/.claude/" "/.opencode/" "/.freebuff/"

# backend (Vitest) — 246/246 verts, 18 fichiers (vérifié 2026-09-19)
cd server && npm test            # vitest run
npm run typecheck                # tsc --noEmit — à faire passer avant de déclarer une modif backend OK
npm run lint

# santé après démarrage (le boot doit rester rapide)
curl -s http://127.0.0.1:3001/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/api/dashboard
```
Règle du porteur : **1 feature = 1 commit + push + docs à jour** ; le backend doit passer `typecheck` + `test` avant d'être déclaré OK. Pas de nouveaux tests unitaires front par défaut (éco de tokens) — en revanche tout chantier produit un `docs/<chantier>.md` « FAIT / RESTE À FAIRE ».

## 8. Diagnostic express
| Symptôme | Commande | Cause probable |
|---|---|---|
| Dashboard vide / stale au premier affichage | `curl -s http://127.0.0.1:3001/api/dashboard \| head -c 200` | caches en cours de remplissage au boot → `server/data/dashboard-snapshot.json` absent ou invalidé |
| « No streams live » alors que des chaînes sont en live | `curl -s http://127.0.0.1:3001/api/streams` puis tester `api.twitch.tv` | GQL bloqué par le DNS du VPN (résolution 198.18.x.x) → vérifier le repli Helix et les identifiants Twitch dans `server/.env` |
| Front injoignable depuis le navigateur mais le port écoute | `netstat -ano \| grep ":4201"` | écoute IPv6 `[::1]` uniquement (curl IPv4 donne 000) |
| Build front qui ne se met pas à jour | relire la sortie de `nx serve` (chercher `✘ [ERROR]`) | erreur de compilation servie en silence (ancienne version) |
| Suites Jest en échec sans rapport avec le code | `ls -d .freebuff/worktrees/*/ .claude/worktrees/*/` | worktrees d'agents ramassés par Jest → relancer avec les `testPathIgnorePatterns` |
| `nx serve` : projet en double | `cat .nxignore` | worktree Freebuff dupliquant le projet Nx |
| EADDRINUSE au boot | `netstat -ano \| grep -E ":(3001\|4201)"` | un instance tourne déjà (vbs déjà lancé) |
| `npm run db:push` en EPERM | — | serveur tsx actif qui verrouille la dll Prisma → arrêter le serveur, puis redémarrer après le push |
| Météo d'une autre source | — | la carte météo de la page LifeHub appelle le service org (:4313) et non le backend NightHub : le repli sur NightHub est normal |

## 9. Liens
- Plan en cours : `PLAN.md` (racine) — état détaillé et chantier « chargement au lancement »
- Décisions : `docs/decisions/` **n'existe pas encore** ; les décisions de refonte sont dans `docs/review/` et `docs/DASHBOARD_GOAL.md`
- Runbook : `<repo>/docs/RUNBOOK.md` **à créer** — démarrage/arrêt décrits ci-dessus et dans `README.md`
- Doc fonctionnelle : `PROJECT-DOC.md` · design : `docs/design-system/`
- Dépôt : https://github.com/JFoissac/nighthub
