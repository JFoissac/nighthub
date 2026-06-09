import { Component, input, output, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TwitchStream } from '../../models';

@Component({
  selector: 'app-stream-player-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
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
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15,3 21,3 21,9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              ONGLET
            </a>
            <!-- Close -->
            <button
              (click)="close.emit()"
              class="p-1.5 rounded hover:bg-[#1E1E2E] transition-colors text-text-muted hover:text-text-primary"
              title="Fermer"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
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
  stream = input.required<TwitchStream>();
  close = output<void>();

  private sanitizer = inject(DomSanitizer);

  panelWidth = signal(420);
  isResizing = signal(false);
  private cachedPlayerKey: string | null = null;
  private cachedPlayerUrl: SafeResourceUrl | null = null;

  private minWidth = 280;
  private maxWidth = 900;

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
    const key = `${login}|${parent}`;
    if (this.cachedPlayerUrl && this.cachedPlayerKey === key) {
      return this.cachedPlayerUrl;
    }
    const url = `https://player.twitch.tv/?channel=${encodeURIComponent(login)}&parent=${parent}&autoplay=true&muted=false`;
    this.cachedPlayerKey = key;
    this.cachedPlayerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    return this.cachedPlayerUrl;
  }
}
