# Twitch Side Panel Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'iframe inline dans les stream cards par un panel latéral coulissant qui affiche le player Twitch avec un bouton "Ouvrir dans un onglet".

**Architecture:** Le `StreamCardComponent` émet un output `(select)` au lieu d'afficher le player inline. Le `DashboardComponent` gère un signal `selectedStream` et affiche le nouveau `StreamPlayerPanelComponent`. Le panel slide depuis la droite avec une transition CSS.

**Tech Stack:** Angular 21, signals, standalone components, Twitch embed iframe.

---

## Fichiers modifiés/créés

- Modify: `src/app/components/stream/stream-card.component.ts` — supprimer l'iframe inline, ajouter output `select`
- Create: `src/app/components/stream/stream-player-panel.component.ts` — panel latéral avec player + bouton onglet
- Modify: `src/app/pages/dashboard/dashboard.component.ts` — signal `selectedStream`, intégration du panel

---

### Task 1: Refactorer StreamCardComponent

**Files:**
- Modify: `src/app/components/stream/stream-card.component.ts`

- [ ] **Step 1: Remplacer le contenu du StreamCardComponent**

Remplacer entièrement `src/app/components/stream/stream-card.component.ts` :

```typescript
import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwitchStream } from '../../models';

@Component({
  selector: 'app-stream-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (stream()) {
      <div
        class="rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-all duration-200 group cursor-pointer"
        (click)="select.emit(stream()!)"
      >
        <!-- Thumbnail -->
        <div class="relative aspect-video">
          <img [src]="stream()!.thumbnailUrl" [alt]="stream()!.title"
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>

          <!-- Play overlay -->
          <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center">
              <svg class="w-6 h-6 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>

          @if (stream()!.isLive) {
            <div class="absolute top-2 left-2 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1">
              <span class="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              LIVE
            </div>
          }
          <div class="absolute top-2 right-2 px-2 py-1 bg-black/70 text-white text-xs font-bold rounded">
            {{ stream()!.viewerCount | number }} viewers
          </div>
          <div class="absolute bottom-2 left-2 right-2 text-white text-xs text-center">
            Cliquer pour regarder sans pub
          </div>
        </div>

        <div class="p-3 bg-surface">
          <div class="flex items-start gap-3">
            <img [src]="stream()!.channelAvatar" [alt]="stream()!.channelName"
                 class="w-8 h-8 rounded-full flex-shrink-0">
            <div class="min-w-0">
              <h3 class="font-semibold text-text-primary line-clamp-2 text-sm">{{ stream()!.title }}</h3>
              <p class="text-text-secondary text-xs mt-1">{{ stream()!.channelName }} • {{ stream()!.gameName }}</p>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class StreamCardComponent {
  stream = input<TwitchStream | null>(null);
  select = output<TwitchStream>();
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

```bash
cd /home/dev/nighthub && npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -30
```

Expected: pas d'erreur sur `stream-card.component.ts`

---

### Task 2: Créer StreamPlayerPanelComponent

**Files:**
- Create: `src/app/components/stream/stream-player-panel.component.ts`

- [ ] **Step 1: Créer le fichier du panel**

Créer `src/app/components/stream/stream-player-panel.component.ts` :

```typescript
import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TwitchStream } from '../../models';

@Component({
  selector: 'app-stream-player-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/40 z-40"
      (click)="close.emit()"
    ></div>

    <!-- Panel -->
    <div class="fixed top-0 right-0 h-full w-full md:w-[45%] lg:w-[40%] bg-surface border-l border-border z-50 flex flex-col shadow-2xl">

      <!-- Header -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <img
          [src]="stream().channelAvatar"
          [alt]="stream().channelName"
          class="w-9 h-9 rounded-full flex-shrink-0"
        >
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-text-primary text-sm truncate">{{ stream().channelName }}</p>
          <p class="text-text-secondary text-xs truncate">{{ stream().gameName }}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <!-- Open in new tab -->
          <a
            [href]="twitchUrl()"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg text-xs font-medium transition-colors border border-purple-600/30"
            title="Ouvrir dans un onglet"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15,3 21,3 21,9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Onglet
          </a>
          <!-- Close -->
          <button
            (click)="close.emit()"
            class="p-2 rounded-lg hover:bg-background transition-colors text-text-secondary hover:text-text-primary"
            title="Fermer"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Stream title -->
      <div class="px-4 py-2 border-b border-border/50 flex-shrink-0">
        <p class="text-text-primary text-sm font-medium line-clamp-2">{{ stream().title }}</p>
        <p class="text-text-secondary text-xs mt-0.5">
          <span class="inline-flex items-center gap-1">
            <span class="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
            LIVE
          </span>
          • {{ stream().viewerCount | number }} viewers
        </p>
      </div>

      <!-- Twitch Player -->
      <div class="flex-1 bg-black">
        <iframe
          [src]="playerUrl()"
          class="w-full h-full"
          allowfullscreen
          frameborder="0"
          allow="autoplay; fullscreen"
        ></iframe>
      </div>
    </div>
  `,
})
export class StreamPlayerPanelComponent {
  stream = input.required<TwitchStream>();
  close = output<void>();

  private sanitizer = inject(DomSanitizer);

  twitchUrl(): string {
    const s = this.stream();
    const login = s.channelLogin || s.channelName.toLowerCase();
    return `https://www.twitch.tv/${login}`;
  }

  playerUrl(): SafeResourceUrl {
    const s = this.stream();
    const login = s.channelLogin || s.channelName.toLowerCase();
    const url = `https://player.twitch.tv/?channel=${encodeURIComponent(login)}&parent=localhost&autoplay=true&muted=false`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

```bash
cd /home/dev/nighthub && npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -30
```

Expected: pas d'erreur sur `stream-player-panel.component.ts`

---

### Task 3: Mettre à jour DashboardComponent

**Files:**
- Modify: `src/app/pages/dashboard/dashboard.component.ts`

- [ ] **Step 1: Ajouter l'import et le signal selectedStream**

Dans `dashboard.component.ts`, modifier les imports et ajouter le signal :

```typescript
// Ajouter dans les imports Angular
import { StreamPlayerPanelComponent } from '../../components/stream/stream-player-panel.component';
import { TwitchStream } from '../../models';

// Dans la liste imports du @Component, ajouter :
StreamPlayerPanelComponent,

// Dans la classe, ajouter après showSettings :
selectedStream = signal<TwitchStream | null>(null);
```

- [ ] **Step 2: Mettre à jour le template — stream cards et panel**

Dans le template du dashboard, modifier la section Twitch :

```html
<!-- Ajouter juste après le bloc showSettings() -->
@if (selectedStream()) {
  <app-stream-player-panel
    [stream]="selectedStream()!"
    (close)="selectedStream.set(null)"
  ></app-stream-player-panel>
}
```

Et modifier chaque `<app-stream-card>` pour émettre la sélection :

```html
<app-stream-card
  [stream]="stream"
  (select)="selectedStream.set($event)"
></app-stream-card>
```

- [ ] **Step 3: Vérifier la compilation complète**

```bash
cd /home/dev/nighthub && npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -50
```

Expected: 0 erreurs

- [ ] **Step 4: Build de production**

```bash
cd /home/dev/nighthub && npx nx build 2>&1 | tail -10
```

Expected: `Successfully ran target build`

---

### Task 4: Fermeture par Escape

**Files:**
- Modify: `src/app/pages/dashboard/dashboard.component.ts`

- [ ] **Step 1: Ajouter le listener clavier**

Dans `DashboardComponent`, ajouter `HostListener` pour fermer le panel avec Escape :

```typescript
import { Component, OnInit, signal, inject, HostListener } from '@angular/core';

// Dans la classe :
@HostListener('document:keydown.escape')
onEscape() {
  if (this.selectedStream()) {
    this.selectedStream.set(null);
  }
}
```

- [ ] **Step 2: Build final**

```bash
cd /home/dev/nighthub && npx nx build 2>&1 | tail -5
```

Expected: build OK, bundle size comparable à avant (~376 kB)
