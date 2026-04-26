# NightHub - Session Log (25 avril 2026)

## Contexte de la session

L'utilisateur veut un dashboard personnel nocturne agrégeant Twitch, YouTube, Twitter/X, Trump Watch, AI News et Meteo. Le projet existait deja avec un frontend Angular 21 + backend Express/Prisma/SQLite. L'objectif de cette session etait de supprimer les donnees en dur, ajouter un systeme d'import automatique des follows (inspire de l'extension NowStreaming), et creer une interface de configuration.

---

## Ce qui a ete fait

### 1. Installation de skills Claude Code

Skills installes globalement (`~/.agents/skills/`) :

| Skill | Source |
|-------|--------|
| `angular-component` | analogjs/angular-skills |
| `angular-developer` | angular/skills |
| `angular-signals` | analogjs/angular-skills |
| `web-design-guidelines` | vercel-labs/agent-skills |
| `data-visualization` | anthropics/knowledge-work-plugins |
| `web-scraping` | mindrally/skills |
| `frontend-design` | plugin (Anthropic) |

### 2. Clone du depot de reference NowStreaming

- Cloné dans `/home/dev/nighthub/references/NowStreaming/`
- Extension Chrome qui recupere les follows Twitch d'un user via l'API Helix
- Mecanisme analyse : username -> user ID -> `/helix/channels/followed` avec pagination -> affichage live/offline
- Utilise OAuth Twitch avec scope `user:read:follows`

### 3. Backend — Import automatique de follows Twitch (Phase 1)

**Fichier modifie : `server/src/services/twitch.service.ts`**

Nouvelles methodes ajoutees a `TwitchService` :

- `importFollowsFromUsername(username)` : Tente de recuperer les follows d'un user Twitch via GQL publique (query `follows` sur un user). Si la query GQL ne retourne rien (certains profils ne l'exposent pas), fallback silencieux.
- `importFollowsFromList(channelNames[])` : Importe une liste de noms de chaines collee par l'utilisateur. Valide chaque chaine via GQL `users(logins:[...])` par batch de 50. Retourne `{ imported, channels, invalid }`.
- Les deux methodes **mergent** les follows avec les existants (pas de remplacement).

### 4. Backend — Import YouTube (Phase 2)

**Fichier modifie : `server/src/routes/api.routes.ts`**

Nouvel endpoint `POST /api/youtube/import-list` :
- Accepte un tableau de handles YouTube
- Normalise les handles (ajoute `@` si manquant)
- Merge avec les existants
- Sauvegarde dans `UserPreference.youtubeChannels`

### 5. Backend — Nouveaux endpoints API

**Fichier modifie : `server/src/routes/api.routes.ts`**

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/twitch/import-follows` | POST | Import follows depuis un username Twitch |
| `/api/twitch/import-list` | POST | Import depuis une liste collee |
| `/api/youtube/import-list` | POST | Import chaînes YouTube depuis liste |
| `/api/preferences` | GET/POST | Etendu avec nouveaux champs |

### 6. Backend — Schema Prisma etendu

**Fichier modifie : `server/prisma/schema.prisma`**

Nouveaux champs dans `UserPreference` :
- `twitchUsername` (String) — username Twitch de l'utilisateur
- `trumpMinCriticality` (Int, default 0) — seuil minimum de criticite pour filtrer Trump Watch
- `customRssFeeds` (String) — URLs RSS personnalises
- `twitchFollows` augmente a 2000 chars (etait 500)
- `youtubeChannels` augmente a 2000 chars

Migration appliquee avec `prisma db push`.

### 7. Backend — Filtrage Trump par criticite

**Fichier modifie : `server/src/services/aggregator.service.ts`**

- `getDashboardData()` lit maintenant `trumpMinCriticality` depuis les preferences
- Filtre les tweets Trump dont `criticality < trumpMinCriticality`
- Utilise aussi `weatherCity` des preferences au lieu du "Caen" en dur

### 8. Frontend — ApiService etendu

**Fichier modifie : `src/app/services/api.service.ts`**

- Interface `UserPreferences` etendue : `twitchUsername`, `trumpMinCriticality`, `customRssFeeds`
- Nouvelles methodes : `importTwitchFollows()`, `importTwitchList()`, `importYoutubeList()`

### 9. Frontend — Settings Modal (Phase 3)

**Nouveau fichier : `src/app/components/settings-modal/settings-modal.component.ts`**

Modal de configuration accessible depuis le header du dashboard (icone engrenage). Sections :

1. **Twitch** — Input username + bouton "Importer" (auto-import GQL) + textarea pour coller une liste + affichage tags des chaines suivies avec bouton supprimer
2. **YouTube** — Textarea pour coller des handles + tags des chaines suivies avec suppression
3. **Twitter/X** — Input username
4. **Trump Watch** — Slider 0-10 pour criticite minimum
5. **Meteo** — Input ville
6. **Flux RSS** — Textarea pour URLs RSS personnalises
7. **Rafraîchissement** — Slider 5-60 minutes

Le modal est overlay fullscreen avec backdrop blur, scrollable, sticky header/footer.

### 10. Frontend — Header modifie

**Fichier modifie : `src/app/components/header/header.component.ts`**

- Le bouton settings ouvre maintenant le modal (`openSettings` output) au lieu de naviguer vers `/settings`
- L'ancienne page `/settings` existe toujours comme fallback

### 11. Frontend — Dashboard modifie

**Fichier modifie : `src/app/pages/dashboard/dashboard.component.ts`**

- Integration du `SettingsModalComponent`
- Signal `showSettings` pour toggle le modal
- `onSettingsSaved()` recharge le dashboard apres sauvegarde
- Empty states ameliores : chaque section vide affiche un lien "Configurer..." qui ouvre le modal settings

### 12. Frontend — Settings page (ancienne)

**Fichier modifie : `src/app/pages/settings/settings.component.ts`**

- Mis a jour pour supporter les nouveaux champs de `UserPreferences`

---

## Tests effectues

| Test | Resultat |
|------|----------|
| `npx nx build` (frontend) | OK - 376 kB |
| `npx tsc --noEmit` (backend) | OK - pas d'erreur |
| `prisma db push` | OK - schema synchronise |
| `GET /api/preferences` | OK - retourne tous les nouveaux champs |
| `POST /api/twitch/import-list` kamet0,squeezie,gotaga | OK - 3 imported, 0 invalid |
| `POST /api/youtube/import-list` @Fireship,@t3dotgg | OK - 2 imported |
| `GET /api/videos` (apres import) | OK - retourne des videos reelles de Fireship et Theo |
| `GET /api/streams` (apres import) | OK - [] (personne en live au moment du test) |

---

## Ce qui a ete fait (session courante 25 avril 2026 — suite)

### 13. Player Twitch — Panel lateral (Feature C)

**Fichiers modifies/crees :**
- `src/app/components/stream/stream-card.component.ts` — suppression iframe inline, ajout output `(select)`
- `src/app/components/stream/stream-player-panel.component.ts` — NOUVEAU : panel lateral coulissant
- `src/app/pages/dashboard/dashboard.component.ts` — signal `selectedStream`, integration panel, HostListener Escape

**Comportement :**
- Clic sur une stream card → panel lateral occupe 40% de l'ecran a droite
- Header du panel : avatar, nom, jeu, bouton "Onglet" (lien twitch.tv dans nouvel onglet), bouton fermer
- Player Twitch embed (`player.twitch.tv/?channel=X&parent=localhost`) dans le panel
- Fermeture : clic backdrop, bouton X, ou touche Escape
- Build verifie : OK 386 kB, 0 erreur TypeScript

### 14. Bugfixes session 2 — 5 correctifs

**Fix 1 — Twitch player `parent` dynamique**
- `stream-player-panel.component.ts` : `parent=window.location.hostname` au lieu de `localhost` hardcodé

**Fix 2 — Suppression import Twitch par username (GQL cassé depuis 2024)**
- `twitch.service.ts` : suppression `importFollowsFromUsername()` et `importFollowsFallback()`
- `api.routes.ts` : suppression endpoint `POST /api/twitch/import-follows`
- `api.service.ts` : suppression méthode `importTwitchFollows()`
- `settings-modal` : suppression section "Importer depuis un username"

**Fix 3 — Twitter : passage en mode "liste de comptes à surveiller"**
- `schema.prisma` : nouveau champ `twitterAccounts String` dans `UserPreference`
- `twitter.service.ts` : `getTimeline()` agrège les RSS de tous les comptes configurés en parallèle
- `settings-modal` : section Twitter remplacée par textarea + tags (pattern Twitch/YouTube)
- `api.routes.ts` + `api.service.ts` : `twitterAccounts` exposé dans GET/POST preferences

**Fix 4 — AI Blog tri chronologique**
- `schema.prisma` : nouveau champ `pubDate DateTime` dans `AiNewsItem`
- `news.service.ts` : `cacheNews()` stocke `pubDate`, `getCachedNews()` trie par `pubDate desc`

**Fix 5 — Import YouTube depuis Google Takeout CSV**
- `schema.prisma` : nouveau champ `youtubeChannelIds String` dans `UserPreference`
- `youtube.service.ts` : nouveaux `getChannelIds()` / `saveChannelIds()`, `getLatestVideos()` merge handles + channel IDs
- `api.routes.ts` : endpoint `POST /api/youtube/import-takeout`
- `api.service.ts` : méthode `importYoutubeTakeout()`
- `settings-modal` : bouton "Google Takeout CSV" avec file input, parsing CSV côté client

**Migration DB :** `prisma db push` appliqué — `pubDate`, `twitterAccounts`, `youtubeChannelIds` ajoutés
**Build :** OK, 0 erreur TS frontend + backend

---

## Ce qui reste a faire

### Phase 4 — A completer
- [ ] Tester le modal settings dans le navigateur (UI/UX)
- [ ] Verifier que le refresh post-save du dashboard fonctionne bien
- [ ] Ajouter un indicateur visuel "premiere fois" si aucun compte n'est configure (onboarding)

### Fonctionnalites manquantes
- [ ] **Import Twitch via username** : le GQL `follows` peut ne pas etre expose publiquement pour tous les users. Si ca ne marche pas, l'utilisateur peut coller sa liste manuellement. Envisager un scraping de la page Twitch du profil.
- [ ] **YouTube auto-import** : Pas d'equivalent simple a NowStreaming pour YouTube. L'approche actuelle est le collage de handles. Alternative : accepter un fichier OPML (export Google Takeout).
- [ ] **Flux RSS personnalises** : le champ est stocke dans les preferences mais `news.service.ts` ne les utilise pas encore pour fetcher.
- [ ] **Twitter timeline** : depend de Nitter qui est souvent rate-limited (429). Explorer des alternatives (scraping direct, RSS bridges).
- [ ] **Trump Watch** : Nitter aussi rate-limited. Les tweets caches fonctionnent mais pas de donnees fraiches si Nitter est down.
- [x] **Twitch player integre** : panel lateral avec player embed + bouton onglet — FAIT
- [x] **Import Twitch par username** : supprime (GQL verrouille), seul l'import par liste fonctionne — FAIT
- [x] **Twitter timeline** : mode "liste de comptes" (elonmusk,sama,...) au lieu du propre profil — FAIT
- [x] **AI Blog tri** : tri par pubDate stocke en DB — FAIT
- [x] **YouTube import Takeout** : bouton CSV dans settings → import direct par channel ID — FAIT
- [x] **Design polish** : theme "Terminal Luxe" applique — FAIT
- [ ] **Tests unitaires** : les specs existantes n'ont pas ete mises a jour pour les nouveaux composants.

### Bugs connus
- Nitter retourne 429 frequemment (rate limit) — le cache de fallback fonctionne
- Les channel avatars YouTube sont des URLs generiques (pas les vrais avatars)

---

## Session du 25 avril 2026 (suite — Performance + Features)

### 5. Performance YouTube — architecture cache-first + fetch parallèle

**Problème :** 300 chaînes YouTube importées → dashboard bloqué en "LOADING" ~90 secondes car `getLatestVideos()` faisait 300 requêtes RSS séquentielles.

**Solution :**
- `getLatestVideos()` lit uniquement le cache DB (rapide, <50ms) — appelé par le dashboard
- `fetchAndCacheLatestVideos()` fait les requêtes HTTP en lots parallèles de 10 — appelé par les cron jobs et refresh
- Filtre 3 jours : seules les vidéos publiées dans les 3 derniers jours sont gardées en cache
- Persist channelId résolu : quand un @handle est résolu en UCxxxxxx, l'ID est sauvegardé pour éviter la re-résolution
- Banner "INITIAL SYNC" si cache vide au premier lancement, auto-refresh après 15s
- `aggregator.service.ts` : `refreshAll()` utilise `fetchAndCacheLatestVideos()` (non-bloquant)

**Gain de performance :** 300 canaux → de ~90s à ~10-15s en background (sans bloquer le dashboard)

### 6. YouTube — Durée des vidéos + filtre Shorts amélioré

- **Backend** : ajout de `fetchDurations()` (YouTube Data API v3, optionnel), `parseDurationSeconds()`, `formatDuration()`
- **isShort()** amélioré : filtre aussi les vidéos < 60s (nécessite `YOUTUBE_API_KEY` dans `server/.env`)
- **Frontend** (`video-card.component.ts`) : overlay durée en bas-droite de la vignette (style YouTube)
- Config : ajouter `YOUTUBE_API_KEY=...` dans `server/.env`

### 7. Twitch — Side panel push (sans backdrop)

- `stream-player-panel.component.ts` : remplacé backdrop `fixed inset-0 bg-black/40` + panel `fixed` par un `<aside class="sticky top-12 h-[calc(100vh-3rem)]">`
- `dashboard.component.ts` : wrapper `<div class="flex pt-12">` autour de `<main>` + panel → le dashboard pousse à gauche au lieu d'être masqué

### 8. Scripts d'extraction

- **`scripts/x-follows.js`** : scroll automatique sur `x.com/{user}/following`, extrait les @handles via `[data-testid="UserCell"]`, copie CSV
- **`scripts/twitch-follows.js`** : lit `auth-token` cookie, appel GQL paginé `follows(first: 100)`, copie logins CSV
