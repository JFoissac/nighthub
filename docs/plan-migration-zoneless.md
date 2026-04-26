# Plan de Migration Angular Zoneless

**Date de création** : 26 avril 2026
**Projet** : NightHub
**Angular** : v21.2.0
**Statut** : Prêt à exécuter

---

## Contexte

Le projet utilise actuellement `zone.js` pour la détection de changements, alors qu'Angular 21 supporte nativement le mode **zoneless**. Passer en zoneless améliore les performances, réduit la taille du bundle, et évite les bugs de détection de changement liés aux callbacks natifs.

---

## Etat actuel

| Element | Statut | Fichier(s) concerné(s) |
|---------|--------|------------------------|
| `zone.js` en dépendance | ✅ Présent | `package.json` |
| `provideExperimentalZonelessChangeDetection()` | ❌ Non configuré | `src/app/app.config.ts` |
| `NgZone` injecté | ⚠️ Utilisé | `src/app/services/api.service.ts` |
| `setTimeout` natif | ⚠️ Utilisé | `dashboard.component.ts`, `header.component.ts` |
| `addEventListener` natif | ⚠️ Utilisé | `dashboard.component.ts` (scroll lazy loading) |
| `setInterval` natif | ⚠️ Utilisé | `header.component.ts` (horloge) |

---

## Checklist de migration

### 1. Configuration Angular (5 min)

#### 1.1 Retirer `zone.js` des dépendances
```diff
// package.json (devDependencies)
- "zone.js": "~0.15.0"
```

#### 1.2 Retirer le polyfill `zone.js`
```diff
// tsconfig.app.json (ou angular.json selon config du projet)
- "zone.js"
```

#### 1.3 Activer le mode zoneless dans `app.config.ts`
```typescript
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideExperimentalZonelessChangeDetection,
} from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(), // <-- AJOUTER
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withFetch()),
  ],
};
```

#### 1.4 Re-installer les dépendances
```bash
npm install
# ou
pnpm install
```

**Verification** : `pnpm nx build nighthub` doit compiler sans erreur. Si erreur "Zone.js not found", chercher la référence restante.

---

### 2. Remplacer `NgZone` dans `api.service.ts` (10 min)

**Fichier** : `src/app/services/api.service.ts`

**Problème** : `NgZone.run()` est utilisé pour le `EventSource` (SSE) car les events natifs ne sont pas détectés par Angular sans zone.js.

**Solution** : Remplacer `NgZone.run()` par `ApplicationRef.tick()` ou utiliser un `Observable` qui émet dans le contexte Angular.

```typescript
// AVANT
import { Injectable, NgZone } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient, private ngZone: NgZone) {}

  getDashboardStream(onProgress: (step: string) => void): Observable<DashboardData> {
    return new Observable(subscriber => {
      const es = new EventSource(`${this.baseUrl}/dashboard/stream`);
      es.addEventListener('progress', (event: MessageEvent) => {
        this.ngZone.run(() => {
          const data = JSON.parse(event.data);
          onProgress(data.step);
        });
      });
      // ...
    });
  }
}
```

```typescript
// APRES
import { Injectable, inject, ApplicationRef } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private appRef = inject(ApplicationRef);

  getDashboardStream(onProgress: (step: string) => void): Observable<DashboardData> {
    return new Observable(subscriber => {
      const es = new EventSource(`${this.baseUrl}/dashboard/stream`);
      es.addEventListener('progress', (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        onProgress(data.step);
        this.appRef.tick(); // Force la détection de changement
      });
      // ...
    });
  }
}
```

**Alternative (encore meilleure)** : Si `provideExperimentalZonelessChangeDetection()` est bien configuré, les events du `EventSource` qui modifient des signaux ou émettent via un `Observable` devraient être automatiquement détectés. Tester d'abord **sans** `appRef.tick()`.

---

### 3. Remplacer `setInterval` dans `header.component.ts` (5 min)

**Fichier** : `src/app/components/header/header.component.ts`

**Problème** : `setInterval` natif n'est pas intercepté par Angular sans zone.js.

**Solution** : Utiliser un `effect()` signal ou `ChangeDetectorRef.detectChanges()`.

```typescript
// AVANT
g export class HeaderComponent implements OnInit, OnDestroy {
  time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  private timer: any;

  ngOnInit() {
    this.timer = setInterval(() => {
      this.time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
```

```typescript
// APRES
import { signal, effect, inject, ChangeDetectorRef } from '@angular/core';

export class HeaderComponent implements OnDestroy {
  time = signal(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  private timer: any;

  constructor() {
    this.timer = setInterval(() => {
      this.time.set(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
```

**Note** : Avec `provideExperimentalZonelessChangeDetection()`, les signaux (`signal.set()`) déclenchent automatiquement la change detection. Pas besoin de `detectChanges()`.

---

### 4. Corriger `setTimeout` dans `dashboard.component.ts` (10 min)

**Fichier** : `src/app/pages/dashboard/dashboard.component.ts`

**Problèmes identifiés** :
- `setTimeout(() => this.initVideoLazyLoading(), 1000)`
- `setTimeout(() => this.loadDashboard(), 15000)`
- `addEventListener('scroll', ...)`

**Solutions** :

#### 4.1 Lazy loading scroll → `ChangeDetectorRef`
Deja partiellement corrigé avec `cdr.detectChanges()`. S'assurer qu'il n'y a plus de `ngZone`.

#### 4.2 `setTimeout(() => this.loadDashboard(), 15000)`
Ajouter `cdr.detectChanges()` après `this.loadDashboard()` si nécessaire, ou utiliser un `signal` pour l'état.

```typescript
// Dans le callback error du getDashboardStream / getDashboard
setTimeout(() => {
  this.loadDashboard();
  this.cdr.detectChanges();
}, 15000);
```

---

### 5. Tester (15 min)

#### 5.1 Tests unitaires
```bash
pnpm nx test nighthub
pnpm nx test nighthub-server
```

#### 5.2 Build de production
```bash
pnpm nx build nighthub
```
Verifier la taille du bundle (doit être réduite sans zone.js).

#### 5.3 Tests manuels
- [ ] Le dashboard se charge correctement
- [ ] Le lazy loading des vidéos fonctionne
- [ ] L'horloge du header s'update
- [ ] Les modals s'ouvrent/ferment
- [ ] Le refresh global fonctionne
- [ ] Les SSE (progress bar) fonctionnent

---

### 6. Cleanup (5 min)

- [ ] Supprimer `NgZone` de tous les imports
- [ ] Supprimer les `ngZone.run()` restants
- [ ] Verifier qu'il n'y a plus de `zone.js` dans `package-lock.json` ou `pnpm-lock.yaml`
- [ ] Commit avec message : `refactor: migrate to Angular zoneless change detection`

---

## Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Oubli d'un `setTimeout` / `addEventListener` | Linter + tests manuels complets |
| `ApplicationRef.tick()` oublié | Tester chaque feature qui utilise des callbacks natifs |
| Performance dégradée | `provideExperimentalZonelessChangeDetection()` est plus performant que zone.js |
| Break de librairie tierce | Verifier que les libs n'utilisent pas `NgZone` |

---

## Ressources

- [Angular Zoneless Documentation](https://angular.dev/guide/experimental/zoneless)
- [Angular Signals Guide](https://angular.dev/guide/signals)
- [provideExperimentalZonelessChangeDetection API](https://angular.dev/api/core/provideExperimentalZonelessChangeDetection)

---

## Résumé des fichiers à modifier

| # | Fichier | Changement |
|---|---------|------------|
| 1 | `package.json` | Retirer `zone.js` |
| 2 | `tsconfig.app.json` | Retirer `zone.js` des polyfills |
| 3 | `src/app/app.config.ts` | Ajouter `provideExperimentalZonelessChangeDetection()` |
| 4 | `src/app/services/api.service.ts` | Retirer `NgZone`, utiliser signaux ou `ApplicationRef.tick()` |
| 5 | `src/app/components/header/header.component.ts` | Remplacer `setInterval` + propriété par `signal` |
| 6 | `src/app/pages/dashboard/dashboard.component.ts` | Verifier `setTimeout` + `addEventListener`, ajouter `cdr.detectChanges()` si nécessaire |
| 7 | `src/app/components/settings-modal/settings-modal.component.ts` | Verifier s'il y a des callbacks natifs |
| 8 | Tous les `.spec.ts` | S'assurer que les tests passent sans zone.js |

---

**Temps estimé total** : 45-60 minutes
**Priorité** : Moyenne (pas bloquant, mais améliore performances et maintenabilité)
