import { Component, output, inject, ElementRef, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwitchStream } from '../../models';
import { StreamsStore } from '../../stores/streams.store';
import { StreamCardComponent } from '../stream/stream-card.component';

@Component({
  selector: 'app-streams-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, StreamCardComponent],
  template: `
    <section role="region" aria-label="Section des streams" class="mb-5 fade-in" style="animation-delay: 100ms">
      <div class="flex items-center justify-between mb-3">
        <button
          (click)="openStreamList.emit()"
          class="flex items-center gap-2 hover:text-primary transition-colors group cursor-pointer"
          aria-label="Voir la liste des streams"
        >
          <svg class="w-4 h-4 text-secondary" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
          <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant group-hover:text-primary">LIVE STREAMS</span>
        </button>
      </div>
      @if (store.isLoading() && !store.count()) {
        <div class="neo-glass rounded p-6 flex items-center gap-4">
          <div class="flex-1 space-y-3">
            <div class="h-3 w-28 rounded bg-[#1E1E2E]/60 animate-pulse"></div>
            <div class="h-3 w-40 rounded bg-[#1E1E2E]/40 animate-pulse"></div>
          </div>
          <div class="h-8 w-24 rounded bg-[#1E1E2E]/50 animate-pulse"></div>
        </div>
      } @else if (store.filteredStreams().length) {
        @if (store.gameList().length > 0) {
          <div class="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
            <button
              (click)="store.setGameFilter(null)"
              class="font-label-caps text-[9px] px-2 py-1 rounded whitespace-nowrap transition-colors"
              [class.bg-secondary]="!store.gameFilter()"
              [class.text-background]="!store.gameFilter()"
              [class.bg-[#1E1E2E]]="store.gameFilter()"
              [class.text-text-muted]="store.gameFilter()"
              [attr.aria-pressed]="!store.gameFilter()"
            >
              TOUS ({{ store.count() }})
            </button>
            @for (game of store.gameList(); track game.name) {
              <button
                (click)="store.setGameFilter(game.name)"
                class="font-label-caps text-[9px] px-2 py-1 rounded whitespace-nowrap transition-colors"
                [class.bg-secondary]="store.gameFilter() === game.name"
                [class.text-background]="store.gameFilter() === game.name"
                [class.bg-[#1E1E2E]]="store.gameFilter() !== game.name"
                [class.text-text-muted]="store.gameFilter() !== game.name"
                [attr.aria-pressed]="store.gameFilter() === game.name"
              >
                {{ game.name | uppercase }} ({{ game.count }})
              </button>
            }
          </div>
        }
        <div class="relative group/scroll">
          <div class="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x-mandatory" #scrollContainer>
            @for (stream of store.filteredStreams(); track stream.twitchId || stream.id || $index) {
              <app-stream-card [stream]="stream" (select)="selectStream.emit($event)"></app-stream-card>
            }
          </div>
          <button
            (click)="scrollBy(-320)"
            class="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full neo-glass border border-[#1E1E2E] flex items-center justify-center text-text-muted hover:text-primary hover:border-primary transition-colors opacity-0 group-hover/scroll:opacity-100"
            aria-label="Scroll left"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button
            (click)="scrollBy(320)"
            class="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full neo-glass border border-[#1E1E2E] flex items-center justify-center text-text-muted hover:text-primary hover:border-primary transition-colors opacity-0 group-hover/scroll:opacity-100"
            aria-label="Scroll right"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      } @else {
        <div class="neo-glass rounded p-6 flex items-center gap-4">
          <p class="font-label-caps text-[10px] text-text-muted">NO STREAMS LIVE —</p>
          <button (click)="openSettings.emit()" class="font-label-caps text-[10px] text-primary underline">CONFIGURE CHANNELS</button>
        </div>
      }
    </section>
  `,
})
export class StreamsSectionComponent {
  readonly store = inject(StreamsStore);
  readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');

  selectStream = output<TwitchStream>();
  openStreamList = output<void>();
  openSettings = output<void>();

  scrollBy(amount: number) {
    const el = this.scrollContainer()?.nativeElement;
    if (el) {
      el.scrollBy({ left: amount, behavior: 'smooth' });
    }
  }
}
