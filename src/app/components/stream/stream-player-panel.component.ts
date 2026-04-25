import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TwitchStream } from '../../models';

@Component({
  selector: 'app-stream-player-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Sticky side panel — no backdrop, pushes dashboard left -->
    <aside class="w-[360px] xl:w-[420px] flex-shrink-0 h-[calc(100vh-3rem)] sticky top-12 border-l border-[#1E1E2E] bg-[#0e0e13] flex flex-col overflow-hidden shadow-[-8px_0_32px_rgba(0,0,0,0.4)]">

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
            <span class="status-pulse status-pulse-red"></span>
            <span class="font-label-caps text-[9px] text-text-muted">LIVE</span>
            @if (stream().gameName) {
              <span class="font-label-caps text-[9px] text-text-muted">· {{ stream().gameName }}</span>
            }
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
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
        <span class="font-label-caps text-[9px] text-text-muted">{{ stream().viewerCount | number }} VIEWERS</span>
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
    const parent = window.location.hostname;
    const url = `https://player.twitch.tv/?channel=${encodeURIComponent(login)}&parent=${parent}&autoplay=true&muted=false`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
