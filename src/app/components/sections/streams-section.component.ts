import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwitchStream } from '../../models';
import { StreamsStore } from '../../stores/streams.store';
import { StreamCardComponent } from '../stream/stream-card.component';

@Component({
  selector: 'app-streams-section',
  standalone: true,
  imports: [CommonModule, StreamCardComponent],
  template: `
    <section class="mb-5 fade-in" style="animation-delay: 100ms">
      <div class="flex items-center justify-between mb-3">
        <button
          (click)="openStreamList.emit()"
          class="flex items-center gap-2 hover:text-primary transition-colors group cursor-pointer"
        >
          <svg class="w-4 h-4 text-secondary" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
          <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant group-hover:text-primary">LIVE STREAMS</span>
        </button>
      </div>
      <div class="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        @for (stream of store.streams(); track stream.twitchId || stream.id || $index) {
          <app-stream-card [stream]="stream" (select)="selectStream.emit($event)"></app-stream-card>
        }
        @if (!store.count()) {
          <div class="neo-glass rounded p-6 flex items-center gap-4">
            <p class="font-label-caps text-[10px] text-text-muted">NO STREAMS LIVE —</p>
            <button (click)="openSettings.emit()" class="font-label-caps text-[10px] text-primary underline">CONFIGURE CHANNELS</button>
          </div>
        }
      </div>
    </section>
  `,
})
export class StreamsSectionComponent {
  readonly store = inject(StreamsStore);

  selectStream = output<TwitchStream>();
  openStreamList = output<void>();
  openSettings = output<void>();
}