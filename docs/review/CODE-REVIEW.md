# Code Review - NightHub

**Date**: 2026-06-09
**Reviewer**: AI Code Review Agent

---

## Review Summary

### Severity: MEDIUM

### Files Reviewed
- `server/src/routes/api.routes.ts` (472 lignes → refactoré en modules)
- `server/src/services/youtube.service.ts` (1397 lignes)
- `server/src/services/news.service.ts` (838 lignes)
- `src/app/pages/dashboard/dashboard.component.ts` (359 lignes → nettoyé)

### Issues Found

#### [MEDIUM] Routes Express monolithiques

**File**: `server/src/routes/api.routes.ts` (avant refactor)
**Problem**: 472 lignes dans un seul fichier, trop de responsabilités
**Impact**: Difficile à maintenir, impossible à tester isolément
**Recommendation**: ✅ REFACTORÉ - Extrait en modules:
- `dashboard.routes.ts`
- `youtube.routes.ts`
- `twitch.routes.ts`
- `news.routes.ts`
- `twitter.routes.ts`
- `preferences.routes.ts`

---

#### [MEDIUM] Console.log de debug

**File**: `src/app/pages/dashboard/dashboard.component.ts`
**Problem**: 8 console.log de debug présents
**Impact**: Pollue la console en production
**Recommendation**: ✅ FIXÉ - Tous les console.log de debug supprimés

---

#### [LOW] Magic numbers

**File**: `server/src/routes/api.routes.ts`
**Problem**: Limites hardcodées (20, 100, 50, 10000)
**Impact**: Configuration pas centralisée
**Recommendation**: Extraire en constantes partagées

---

#### [LOW] Error handling générique

**File**: Multiples fichiers
**Problem**: `catch (error) { res.status(500).json({ error: '...' }) }`
**Impact**: Pas de logging des erreurs réelles
**Recommendation**: Logger les erreurs avant de retourner 500

---

### Quick Wins Appliqués

1. ✅ **Console.log debug supprimés** - dashboard.component.ts nettoyé
2. ✅ **Angular runtime en dependencies** - Déjà correct dans package.json
3. ✅ **customRssFeeds utilisé** - news.service.ts les utilise déjà

---

### Technical Debt

| Item | Fichier | Complexité |
|------|---------|------------|
| Tests unitaires stores | `src/app/stores/*.spec.ts` | Moyenne |
| Tests intégration routes | `server/src/routes/*.test.ts` | Haute |
| Validation centralisée | Tous services | Basse |

---

### Test Coverage Gaps

**Frontend:**
- `videos.store.spec.ts` - incomplet
- `streams.store.spec.ts` - incomplet
- `news.store.spec.ts` - incomplet

**Backend:**
- Routes modulaires méritent des tests d'intégration
- `aggregator.service.ts` - tester le cron

---

### Architecture Notes

#### Points Positifs
- ✅ Pattern cache-first bien implémenté
- ✅ Validation Zod sur toutes les routes POST
- ✅ SSRF protection dans news.service.ts
- ✅ Circuit breaker pour résolution handles YouTube
- ✅ Signal stores pour state management Angular

#### Points à Améliorer
- ⚠️ Services singletons difficiles à tester (à corriger avec factories)
- ⚠️ Pas de pagination sur les endpoints de liste
- ⚠️ Retention policy pour les données cache (videos, tweets)

---

### Recommendations

1. **Court terme (1-2h)**:
   - Ajouter des tests pour les stores
   - Centraliser les constantes (limites, TTLs)
   - Logger les erreurs dans les catch blocks

2. **Moyen terme (demi-journée)**:
   - Ajouter pagination sur `/api/videos`, `/api/news`, `/api/tweets`
   - Implémenter retention policy pour le cache DB
   - Séparer les services en factories testables

3. **Long terme**:
   - Intégrer server/ dans Nx workspace
   - Ajouter tests e2e
   - Implémenter monitoring (logs structurés, métriques)