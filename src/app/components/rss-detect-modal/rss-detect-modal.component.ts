import { Component, EventEmitter, Output, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-rss-detect-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" (click)="onBackdropClick($event)">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

      <div class="relative bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 class="font-headline font-semibold text-text-primary flex items-center gap-2 text-sm">
            <svg class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 11a9 9 0 0 1 9 9"/>
              <path d="M4 4a16 16 0 0 1 16 16"/>
              <circle cx="5" cy="19" r="1"/>
            </svg>
            Ajouter un flux RSS
          </h2>
          <button (click)="close.emit()" class="p-1.5 rounded hover:bg-background transition-colors text-text-muted hover:text-text-primary">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <button
            (click)="close.emit()"
            class="p-1.5 rounded hover:bg-background transition-colors text-text-muted hover:text-text-primary md:hidden"
          ></button>

        <!-- Body -->
        <div class="px-5 py-4 space-y-4">
          <div class="space-y-2">
            <label class="text-xs text-text-secondary">URL du site (la détection RSS est automatique)</label>
            <div class="flex gap-2">
              <input
                type="url"
                [(ngModel)]="siteUrl"
                placeholder="https://blog.cloudflare.com"
                class="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-mono focus:border-amber-500 focus:outline-none"
                (keydown.enter)="detect()"
              />
              <button
                (click)="detect()"
                [disabled]="!siteUrl.trim() || isDetecting()"
                class="px-3 py-2 bg-amber-600/20 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-600/30 transition-colors disabled:opacity-40 border border-amber-600/30 flex-shrink-0"
              >
                @if (isDetecting()) {
                  <span class="animate-pulse">...</span>
                } @else {
                  Détecter
                }
              </button>
            </div>
          </div>

          @if (error()) {
            <div class="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {{ error() }}
            </div>
          }

          @if (detectedFeed()) {
            <div class="space-y-3">
              <div class="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <p class="text-[10px] text-green-400/70 font-label-caps mb-1">FLUX DÉTECTÉ</p>
                <p class="text-xs text-green-300 font-mono break-all">{{ detectedFeed() }}</p>
              </div>
              <button
                (click)="addFeed()"
                class="w-full px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors"
              >
                Ajouter ce flux
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class RssDetectModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() feedAdded = new EventEmitter<string>();

  private apiService = inject(ApiService);

  siteUrl = '';
  isDetecting = signal(false);
  detectedFeed = signal<string | null>(null);
  error = signal<string | null>(null);

  detect() {
    const url = this.siteUrl.trim();
    if (!url) return;
    this.isDetecting.set(true);
    this.detectedFeed.set(null);
    this.error.set(null);

    this.apiService.detectFeed(url).subscribe({
      next: (res) => {
        this.isDetecting.set(false);
        this.detectedFeed.set(res.feedUrl);
      },
      error: () => {
        this.isDetecting.set(false);
        this.error.set('Aucun flux RSS trouvé pour ce site.');
      },
    });
  }

  addFeed() {
    const feed = this.detectedFeed();
    if (feed) this.feedAdded.emit(feed);
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.close.emit();
    }
  }
}
