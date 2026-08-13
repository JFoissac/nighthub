import { Component, input, output, inject, signal, effect, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LucideAngularModule, ExternalLink, X } from 'lucide-angular';
import { TwitchStream } from '../../models';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-stream-player-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="relative h-[calc(100vh-3rem)] flex" #wrapper>
      <!-- Resize handle — always visible, wide hit area -->
      <div
        class="absolute -left-2 top-0 h-full w-4 cursor-ew-resize z-20 flex items-center justify-center"
        (mousedown)="startResize($event)"
      >
        <!-- Gripper bar with dots -->
        <div class="w-1 h-10 rounded-full bg-border flex flex-col items-center justify-center gap-[3px]">
          <div class="w-[2px] h-[2px] rounded-full bg-text-muted"></div>
          <div class="w-[2px] h-[2px] rounded-full bg-text-muted"></div>
          <div class="w-[2px] h-[2px] rounded-full bg-text-muted"></div>
        </div>
      </div>

      <!-- Side panel -->
      <aside
        class="h-full border-l border-[#1E1E2E] bg-[#0e0e13] flex flex-col overflow-hidden shadow-[-8px_0_32px_rgba(0,0,0,0.4)] flex-shrink-0"
        [style.width.px]="panelWidth()"
        [class.select-none]="isResizing()"
      >
        <!-- Header -->
        <div class="flex items-center gap-3 px-4 py-3 border-b border-[#1E1E2E] bg-[#131318]/60 flex-shrink-0">
          <img
            [src]="stream().channelAvatar"
            [alt]="stream().channelName"
            class="w-8 h-8 rounded-full flex-shrink-0 border border-[#1E1E2E]"
          >
          <div class="min-w-0 flex-1">
            <p class="font-label-caps text-[11px] text-text-primary truncate">{{ stream().channelName }}</p>
            <div class="flex items-center gap-1.5 mt-0.5">
              <span class="status-pulse" [class.status-pulse-red]="stream().isLive"></span>
              <span class="font-label-caps text-[9px] text-text-muted">{{ stream().isLive ? 'LIVE' : 'OFFLINE' }}</span>
              @if (stream().gameName) {
                <span class="font-label-caps text-[9px] text-text-muted">· {{ stream().gameName }}</span>
              }
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            @if (isTurboPlayback()) {
              <span
                class="font-label-caps text-[9px] px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20"
                title="Lecture authentifiée — Twitch Turbo : pas de publicité"
              >TURBO</span>
            }
            <!-- Width badge -->
            <span class="font-label-caps text-[9px] text-text-muted opacity-50 select-none">{{ panelWidth() }}px</span>
            <!-- Open in new tab -->
            <a
              [href]="twitchUrl()"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1.5 px-2 py-1 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded text-[9px] font-label-caps transition-colors border border-secondary/20"
              title="Ouvrir dans un onglet"
            >
              <lucide-icon [name]="ExternalLink" size="12"></lucide-icon>
              ONGLET
            </a>
            <!-- Close -->
            <button
              (click)="closed.emit()"
              class="p-1.5 rounded hover:bg-[#1E1E2E] transition-colors text-text-muted hover:text-text-primary"
              title="Fermer"
            >
              <lucide-icon [name]="X" size="16"></lucide-icon>
            </button>
          </div>
        </div>

        <!-- Stream title + stats -->
        <div class="px-4 py-2 border-b border-[#1E1E2E]/50 bg-[#131318]/40 flex-shrink-0">
          <p class="text-[13px] text-text-secondary line-clamp-1">{{ stream().title }}</p>
          @if (stream().isLive) {
            <span class="font-label-caps text-[9px] text-text-muted">{{ stream().viewerCount | number }} VIEWERS</span>
          } @else {
            <span class="font-label-caps text-[9px] text-text-muted">OFFLINE</span>
          }
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
      </aside>
    </div>
  `,
})
export class StreamPlayerPanelComponent {
  readonly ExternalLink = ExternalLink;
  readonly X = X;

  stream = input.required<TwitchStream>();
  closed = output<void>();

  private sanitizer = inject(DomSanitizer);
  private apiService = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  panelWidth = signal(420);
  isResizing = signal(false);
  private cachedPlayerKey: string | null = null;
  private cachedPlayerUrl: SafeResourceUrl | null = null;
  private playbackAuth = signal<{ auth?: string; sig?: string } | null>(null);
  isTurboPlayback = signal(false);

  private minWidth = 280;
  private maxWidth = 900;

  constructor() {
    // Fetch a viewer-authenticated playback token whenever the stream changes.
    // With a linked Twitch account (Turbo/Prime), the embed gets an auth token
    // and Twitch serves the stream without preroll ads.
    effect(() => {
      const s = this.stream();
      const login = (s.channelLogin || s.channelName || '').toLowerCase();
      this.playbackAuth.set(null);
      this.isTurboPlayback.set(false);
      if (!login || !s.isLive) return;

      const sub = this.apiService.getTwitchPlayback(login).subscribe({
        next: (res) => {
          if (res && !res.anonymous && res.auth) {
            this.playbackAuth.set({ auth: res.auth, sig: res.sig });
            this.isTurboPlayback.set(true);
          }
        },
        error: () => {
          this.playbackAuth.set(null);
          this.isTurboPlayback.set(false);
        },
      });
      this.destroyRef.onDestroy(() => sub.unsubscribe());
    });
  }

  startResize(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = this.panelWidth();
    this.isResizing.set(true);

    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    const onMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidth = startWidth + delta;
      this.panelWidth.set(
        Math.min(this.maxWidth, Math.max(this.minWidth, newWidth))
      );
    };

    const onMouseUp = () => {
      this.isResizing.set(false);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  twitchUrl(): string {
    const s = this.stream();
    const login = s.channelLogin || s.channelName.toLowerCase();
    return `https://www.twitch.tv/${login}`;
  }

  playerUrl(): SafeResourceUrl {
    const s = this.stream();
    const login = s.channelLogin || s.channelName.toLowerCase();
    const parent = window.location.hostname;
    const auth = this.playbackAuth();
    const key = `${login}|${parent}|${auth?.auth ? 'auth' : 'anon'}`;
    if (this.cachedPlayerUrl && this.cachedPlayerKey === key) {
      return this.cachedPlayerUrl;
    }
    let url = `https://player.twitch.tv/?channel=${encodeURIComponent(login)}&parent=${parent}&autoplay=true&muted=false`;
    if (auth?.auth) {
      // Viewer-authenticated playback: Turbo/Prime subscribers get ad-free
      // streams from the embed (auth + sig come from the backend's Helix call).
      url += `&auth=${encodeURIComponent(auth.auth)}`;
      if (auth.sig) {
        url += `&sig=${encodeURIComponent(auth.sig)}`;
      }
    }
    this.cachedPlayerKey = key;
    this.cachedPlayerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    return this.cachedPlayerUrl;
  }
}
