# Nighthub TODO - Remarks & Analysis

**Date**: 2026-04-29
**Author**: AI Analysis

---

## 1. Déporter chargement RSS YouTube après le chargement du dashboard (plus de loading visible)

**Status**: Already partially addressed

Le dashboard utilise déjà un pattern SSE avec `getDashboardStream()` qui stream les données progressivement. On observe:
- `loadingStatus` qui change: 'CONNECTING...' → messages de progression
- `isSyncing` affiche un message "INITIAL SYNC IN PROGRESS" avec spin
- Les données arrivent au fur et à mesure

**Problème restant**: Le loader global (`isLoading`) bloque toujours l'affichage tant que toutes les données ne sont pas reçues. YouTube/RSS est la section la plus lente car elle nécessite des appels externes.

**Approches possibles**:

| Approche | Pros | Cons |
|----------|------|------|
| Lazy-load section YouTube après paint | UI immédiate, percepçu plus rapide | Flash de contenu qui apparaît |
| Skeleton placeholders par section | Feedback visuel constant | Plus de code UI |
| Parallèle: dashboard sans YouTube, puis merge | Simple à implémenter | Peut créer des re-renders |

**Recommandation**: Skeleton placeholders + streaming optimiste. Chaque section (Twitter, YouTube, Streams, News, Trump) affiche un skeleton state dès le mount, puis remplit quand les données arrivent. C'est déjà le pattern naturel du SSE.

---

## 2. Améliorer parsing YouTube pour ne rechercher que les vidéos de la semaine

**Status**: Non implémenté

Le `YoutubeService` actuel (`src/app/services/youtube.service.ts`) utilise des données mock static. Le vrai parsing est côté serveur (`server/src/services/youtube.service.ts`).

**Problème**: Currently fetches all videos without time filtering, causing unnecessary bandwidth and processing.

**Solution required**:
1. Add `publishedAfter` parameter to YouTube API calls
2. Calculate `1 week ago` from current date
3. Cache aggressively since data is historical (won't change)

```typescript
// Approx implementation
const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
// Use: publishedAfter=oneWeekAgo in YouTube API search
```

**Note**: Tu as déjà un doc `docs/superpowers/youtube-recaps-optimization.md` - à consulter avant implémentation.

---

## 3. Mode jour/nuit/neon

**Status**: Partiellement implémenté

Le header a déjà un toggle OLED (`isOled` signal) qui ajoute `theme-oled` class au body. Mais c'est:
- Uniquement OLED (noir profond)
- Pas de mode "jour" (light theme)
- Pas de mode "neon" (couleurs cyberpunk brighter)

**Architecture actuelle**:
```typescript
// header.component.ts:89
isOled = signal(false);

// Toggle add/remove
document.body.classList.add('theme-oled');
```

**Tailwind config** définit uniquement des couleurs dark:
```js
background: '#0A0A0F',
primary: '#c0c1ff',
secondary: '#5de6ff',
```

**Approches**:

| Mode | Implementation |
|------|----------------|
| Light mode | Ajouter `theme-light` avec couleurs light dans Tailwind, inverser bg/text |
| OLED mode | Existing `theme-oled` with pure black |
| Neon mode | Augmenter saturation primary/secondary, ajouter glow effects |

**Recommandation**: Theme system avec CSS custom properties + Tailwind arbitrary values. Single `data-theme` attribute sur `<html>` qui contrôle tout.

```css
[data-theme="light"] {
  --bg: #f5f5f7;
  --text: #1d1d1f;
  --primary: #5e5ce6;
}
[data-theme="neon"] {
  --bg: #0a0a0f;
  --primary: #00ff88;
  --glow: 0 0 20px var(--primary);
}
```

---

## 4. Terminal search (recherche in-app et out-app)

**Status**: UI stub exists

Le header a un input placeholder "TERMINAL SEARCH..." mais:
- Pas de logique de recherche
- Pas d'activation (Enter, focus)
- Pas de résultats affichés

**Scope creep alert**: "Terminal search" peut signifier deux choses différentes:

| Interprétation | Description |
|----------------|-------------|
| In-app search | Rechercher dans les données dashboard (videos, streams, news, tweets) |
| Out-app search | Recherche web / navigation vers ressources externes |
| Both | Combination |

**Approches**:

1. **In-app seulement**: Filter local stores, affiche dropdown de résultats filtrés
2. **Out-app**: Intégration avec moteur de recherche (Google, DuckDuckGo) dans un nouvel onglet
3. **Full terminal**: Command palette style (Cmd+K), recherche tous azimuts + actions

**Recommandation**: Command palette (style Raycast/Linear) - plus moderne et extensible. Permet d'ajouter des actions (refresh, open settings) en plus de la recherche.

**Fichier à modifier**: `header.component.ts:64`

---

## 5. Données réelles Trump (CNN, Truth Social, etc)

**Status**: Mock data

Le `TrumpStore` et `TrumpSectionComponent` existent mais utilisent des mock data. Il y a déjà:
- `server/src/services/trump.service.ts` - probablement à améliorer
- `src/app/services/trump.service.ts` - service Angular

**Sources potentielles**:
- Truth Social API (officielle, mais rate-limited)
- RSS feeds de sites d'actualités (CNN, Fox, etc)
- Web scraping pour Truth Social (fragile)

**Problème connu**: Truth Social n'a pas de RSS public. Les approaches:
1. CNN/Fox RSS - simple mais pas "Trump-specific"
2. Dedicated Trump news aggregator APIs
3. Web scraping (anti-pattern, fragile)

**À clarifier**: Qu'est-ce que "données Trump"? Simply news about Trump? Ou ses posts Truth Social? Ou les deux?

**Note**: Il existe `src/app/components/trump/trump-card.component.ts` - à vérifier pour l'implémentation actuelle.

---

## 6. Fusion avec crypto dashboard

**Status**: Not started

Aucun code crypto dashboard n'existe actuellement. C'est un nouveau sous-projet.

**Questions critiques**:
1. Fusion physique: Merger dans le même repo/app?
2. Ou fusion logique: Dashboards liés mais séparés?
3. Quel crypto data? Prices? News? Portfolio?

**Si fusion physique**:
- Nx monorepo - les deux apps existent déjà probablement
- Partager stores/services communs (auth, user prefs)
- Unified header/navigation

**Si fusion logique**:
- Linking entre dashboards
- Shared authentication (single sign-on)

**Recommandation**: Clarifier d'abord le scope du crypto dashboard avant de designer la fusion.

---

## 7. Wrapper Perplexity, fonction IA

**Status**: Not started

Demande d'ajouter des capacités IA via Perplexity API.

**Use cases possibles**:
- Résumé automatique de news
- Recherche sémantique
- Suggestions de contenu
- Analyse de sentiment sur Trump/news

**Architecture suggérée**:
```
Frontend                    Server
   |                           |
   |--- API Perplexity ------->|
   |    (server-side)          |
   |                           |--- Perplexity API
   |<-- summarized response ---|
```

**Pourquoi server-side**: API keys doivent rester cachées, coûts à contrôler.

**Points à décider**:
1. Quel use case priorité?
2. Streaming responses (SSE) ou batch?
3. Cache des réponses?

---

## Priorisation suggérée

| # | Item | Complexité | Valeur | Quick Win? |
|---|------|------------|--------|------------|
| 1 | YouTube lazy load | Moyenne | Haute | Non |
| 2 | YouTube week filter | Basse | Moyenne | Oui |
| 3 | Theme system | Moyenne | Haute | Non |
| 4 | Terminal search | Moyenne | Haute | Non |
| 5 | Trump real data | Haute | Haute | Non |
| 6 | Crypto fusion | ??? | ??? | Non |
| 7 | Perplexity wrapper | Moyenne | Haute | Non |

**Quick wins** (1-2h chacun):
- YouTube week filter (#2)
- Terminal search skeleton (#4) - juste la structure, pas la logique

---

## Risks & Concerns

1. **#6 Crypto fusion**: Scope creep potentiel. Définir boundaries avant.
2. **#5 Trump data**: Sources instables (Truth Social API changes часто). Prévoir fallback.
3. **#7 Perplexity**: Coûts API. Need rate limiting + cache.
4. **#3 Theme system**: Peut devenir unwieldy si pas bien architected d'entrée.

---

## Files d'intérêt pour implémentation

```
Dashboard:
- src/app/pages/dashboard/dashboard.component.ts
- src/app/components/header/header.component.ts
- src/app/stores/*.store.ts

YouTube:
- server/src/services/youtube.service.ts
- src/app/services/youtube.service.ts
- src/app/components/sections/youtube-section.component.ts

Theme:
- tailwind.config.js
- src/app/app.config.ts (pour global styles)

Search:
- header.component.ts:64 (input stub)
```
