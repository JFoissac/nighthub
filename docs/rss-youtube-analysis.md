# Analyse & Faisabilité — Flux RSS par Chaîne YouTube

**Projet :** NightHub  
**Date :** 25 avril 2026  
**Statut :** Solution retenue et implémentée (Couche 1 du pipeline YouTube)

---

## 1. Principe du flux RSS par chaîne

Chaque chaîne YouTube publique dispose d'un flux RSS natif, accessible sans clé API :

```
https://www.youtube.com/feeds/videos.xml?channel_id={CHANNEL_ID}
```

### Obtention du `channel_id`

- **Depuis l'URL de la chaîne** : `https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxxxx`
- **Depuis le code source** de la page d'accueil de la chaîne (recherche `"channelId"`)
- **Via scraping** ( NightHub utilise une résolution HTML côté backend )

### Structure du flux

Le retour est un XML standard RSS/Atom contenant :
- `title`, `link`, `published`, `updated`
- `media:group` avec `media:title`, `media:description`, `media:thumbnail`
- Jusqu'à **15 dernières vidéos** par chaîne

---

## 2. Avantages

| Critère | Évaluation |
|---------|------------|
| **Coût** | Gratuit, 0 clé API requise |
| **Latence** | Très faible (< 200ms par flux) |
| **Fiabilité** | Généralement stable, mais erreurs 404 sporadiques signalées |
| **Volume** | 15 vidéos/chaîne → suffisant pour un dashboard d'actualité |
| **Complexité** | Parsing XML simple avec `rss-parser` |

---

## 3. Limites identifiées

### 3.1 Instabilités sporadiques
- **Erreurs 404** : certains utilisateurs rapportent des indisponibilités temporaires des flux officiels
- **Rate-limiting implicite** : pas de documentation officielle sur les limites

### 3.2 Absence de métadonnées avancées
- **Pas de durée** : impossible de filtrer les Shorts par durée exacte
- **Pas de statut "live"** : difficile de distinguer un live d'une VOD
- **Pas de nombre de vues** : uniquement le titre, la description et la miniature

### 3.3 Pas de flux global
- Un flux par chaîne uniquement
- Pour N chaînes suivies → N requêtes HTTP
- NightHub gère actuellement ~50 chaînes → 50 requêtes en parallèle (limité à 20 concurrences)

---

## 4. Alternatives évaluées

### 4.1 YouTube Data API v3

| Aspect | Détail |
|--------|--------|
| `search.list` | 100 unités/appel — **trop coûteux** pour un refresh régulier |
| `videos.list` | 1 unité / 50 IDs — **économique** si on a déjà les IDs |
| Coût quotidien estimé | 5 000 unités avec `search.list` vs **15 unités** avec `videos.list` |

**Verdict :** Utilisable uniquement en complément (Couche 2) pour obtenir les durées exactes.

### 4.2 Piped / Invidious (instances publiques)

| Aspect | Détail |
|--------|--------|
| API REST | `/streams/{videoId}` retourne la durée directement |
| Disponibilité | Dépend de l'instance (rate-limiting variable) |
| Fiabilité | Moins stable que le RSS officiel sur le long terme |

**Verdict :** Fallback optionnel (Couche 3) configurable dans les Settings.

### 4.3 Scraping HTML YouTube

| Aspect | Détail |
|--------|--------|
| Résolution handle → ID | Fonctionne mais fragile (changements fréquents de DOM) |
| Extraction vidéos | Trop risqué (bot detection, CAPTCHA, changements de layout) |

**Verdict :** Utilisé uniquement pour la résolution handle → channelId, pas pour le fetch vidéos.

### 4.4 Outils tiers (FreeTube, PocketTube, vfeed.app)

| Outil | Usage | Intégrable dans NightHub ? |
|-------|-------|---------------------------|
| **FreeTube** | Desktop open-source, import abonnements | Non (application autonome) |
| **PocketTube** | Extension navigateur, dossiers d'abonnements | Non (extension) |
| **vfeed.app** | Agrégateur via API YouTube | Non (service externe fermé) |

**Verdict :** Non intégrables directement, mais valident le besoin d'une solution centralisée comme NightHub.

---

## 5. Architecture retenue : Hybrid RSS + API v3

```
┌─────────────────────────────────────────────────────────────┐
│  COUCHE 1 (Principal) : Flux RSS par chaîne                 │
│  → https://www.youtube.com/feeds/videos.xml?channel_id=ID   │
│  → 15 dernières vidéos, pas de clé API                      │
│  → Retry exponentiel en cas de 404 (3 tentatives)           │
│  → Concurrence limitée à 20 requêtes parallèles             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  COUCHE 2 (Enrichissement) : YouTube Data API v3            │
│  → UNIQUEMENT `videos.list?part=contentDetails&id=...`      │
│  → 1 unité / 50 IDs                                         │
│  → 50 chaînes × 15 vidéos = 750 IDs → 15 appels/jour        │
│  → Filtrage Shorts par durée exacte (< 60s)                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  COUCHE 3 (Fallback) : Piped / Invidious                    │
│  → Si RSS instable pour une chaîne                          │
│  → Retourne `duration` directement                          │
│  → Configurable via Settings (`PIPED_INSTANCE_URL`)         │
└─────────────────────────────────────────────────────────────┘
```

### Gestion des Shorts

1. **Heuristique rapide** (toujours appliquée) :
   - `#shorts` dans le titre
   - `/shorts/` dans l'URL
2. **Durée précise** (si clé API configurée) :
   - `< 60s` via `contentDetails.duration`
3. **Fallback** :
   - Si pas de durée disponible → garder l'heuristique seule

### Gestion des IDs orphelins

**Problème :** Quand un handle est supprimé des préférences, son `channelId` résolu persistait en DB et alimentait `getCachedVideos()` via le `OR` Prisma.

**Solution implémentée :**
- `saveChannelHandles()` nettoore les IDs orphelins en comparant les anciens et nouveaux handles
- Les IDs résolus sont stockés dans `youtubeChannelIds` (préférences) avec une logique de synchronisation explicite

---

## 6. Implémentation dans NightHub

### Backend (`server/src/services/youtube.service.ts`)

- **`getChannelHandles()`** / **`saveChannelHandles()`** : gestion des handles avec nettoyage d'IDs
- **`resolveChannelIds()`** : scraping HTML pour obtenir les `channel_id` depuis les handles
- **`fetchRssFeed(channelId)`** : appel au flux RSS avec `rss-parser`
- **`getLatestVideos()`** : agrégation RSS + filtrage Shorts + enrichissement API v3
- **`parseDuration(iso8601)`** : conversion `PT4M32S` → secondes
- **`isShort(video)`** : heuristique titre/URL + durée exacte si disponible

### Frontend (`src/app/services/youtube.service.ts`)

- Signal `videos()` avec données mock initiales
- Méthode `refresh()` qui simule l'incrémentation des vues

### Tests

- `server/src/services/youtube.service.test.ts` : 27 tests couvrant :
  - Parsing/validation des handles
  - Résolution d'ID via HTML
  - Parsing RSS avec filtre anti-Shorts
  - Helpers de durée ISO 8601
  - Détection de vidéos récentes

---

## 7. Bilan de faisabilité

| Critère | Note | Commentaire |
|---------|------|-------------|
| **Faisabilité technique** | ✅ Excellent | RSS stable, parsing trivial, pas de dépendance à une API payante |
| **Coût** | ✅ Nul | 0 clé API obligatoire pour la couche principale |
| **Scalabilité** | ⚠️ Limitée | ~50 chaînes confortables, au-delà risque de rate-limit implicite |
| **Fiabilité** | ⚠️ Acceptable | Retry exponentiel + fallback Piped recommandé |
| **Maintenabilité** | ✅ Bonne | `rss-parser` bien maintenu, API RSS YouTube inchangée depuis des années |
| **Alternatives viables** | ❌ Aucune | L'API v3 seule est trop chère, le scraping trop fragile |

**Conclusion :** Le flux RSS par chaîne est la solution optimale pour NightHub. L'architecture hybride (RSS principal + API v3 pour les durées + Piped en fallback) offre le meilleur rapport coût/fiabilité/fonctionnalités.

---

## 8. Références

- [YouTube RSS Feeds Official Documentation](https://www.youtube.com/feeds/videos.xml?channel_id=)
- [rss-parser npm package](https://www.npmjs.com/package/rss-parser)
- [YouTube Data API v3 Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [Piped Documentation](https://docs.piped.video/)
- PLAN.md — Section "YouTube — Solution retenue (Hybrid RSS + API v3 optimisé)"
