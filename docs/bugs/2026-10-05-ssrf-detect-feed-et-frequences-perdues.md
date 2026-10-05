---
titre: SSRF sur detect-feed, et 5 fréquences de rafraîchissement jamais enregistrées
projet: Nighthub
type: bug
date: 2026-10-05
---

# Deux défauts côté API : une lecture d'URL interne possible, et des réglages jetés

## 1. SSRF — `POST /api/sites/detect-feed`

### Reproduction

`newsService.detectFeed()` faisait `fetch(siteUrl)` sur **l'URL fournie par l'appelant**, sans le
garde-fou `isAllowedExtractionUrl()` qu'utilise `/news/extract` (celui-ci bloque `localhost`, les
adresses privées et `169.254.169.254`). L'appelant pouvait donc faire lire au serveur une adresse
interne.

### Correctif

`server/src/services/news.service.ts` : la même vérification est appliquée à `detectFeed`, avec une
trace explicite en cas de refus (jamais de refus silencieux).

### Vérification en service (05/10/2026, backend relancé)

| Cas testé | Résultat |
|---|---|
| URL interne `http://127.0.0.1:3001/health` | **HTTP 404 en 0,028 s** — aucune requête émise, journal : `[news] detectFeed refuse une adresse interne ou invalide : 127.0.0.1` |
| URL légitime `https://www.lemonde.fr` | **HTTP 200** → `{"feedUrl":"https://www.lemonde.fr/rss/une.xml"}` (fonctionnalité intacte) |

## 2. Cinq fréquences de rafraîchissement jamais persistées

### Reproduction (mesurée)

Le modèle Prisma porte **5 fréquences par domaine** (`marketRefreshInterval`, `trumpRefreshInterval`,
`newsRefreshInterval`, `streamsRefreshInterval`, `youtubeRefreshInterval`) mais le schéma Zod de
`/api/preferences` ne déclarait que `refreshInterval`. Un `z.object()` **supprime les clés non
déclarées** : ces valeurs n'étaient ni enregistrables, ni renvoyées par le `GET`.

Preuve après correctif : `GET /api/preferences` renvoie **5 / 210 / 160 / 10 / 60** — des valeurs
réelles, différentes des valeurs par défaut du modèle (60 / 144 / 30 / 5 / 30). L'utilisateur les avait
donc réglées, et l'API les jetait.

### Correctif

`server/src/routes/preferences.routes.ts` : les 5 champs ajoutés au schéma (bornés 5..1440), à la
réponse `getPreferences` et à l'écriture `savePreferences`.

## Vérifications

- `npx tsc --noEmit` : propre. Tests serveur : **246/246**, exit 0.
- Backend relancé (même commande que `nighthub-start.vbs`, console cachée) : `/health` → 200.

## Reste ouvert (décision porteur)

- **Clés réelles dans l'historique d'un dépôt public** : `server/.env` (bearer Twitter + clé
  OpenWeatherMap) est encore dans l'historique de `main`, `develop` et `feat/evo`. La rotation des clés
  et la purge (`git filter-repo` + `push --force`) attendent l'accord du porteur — seule la rotation
  côté Google/Twitch peut invalider l'exposition.
- API sans authentification sur `0.0.0.0` (exposition LAN) : à trancher (jeton partagé ou bind local),
  sachant que l'accès depuis le téléphone au réseau local doit rester possible.
- Bruit restant : polling front redondant (7 boucles), modules de sécurité morts
  (`env.manager.ts`, `security.rules.ts`, `sanitizeForLog` jamais appelé), aucune CI.
