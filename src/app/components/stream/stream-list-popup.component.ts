import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X } from 'lucide-angular';
import { TwitchStream } from '../../models';

@Component({
  selector: 'app-stream-list-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div role="presentation" class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="closed.emit()"></div>

      <!-- Modal -->
      <div class="relative z-10 w-full max-w-lg mx-4 neo-glass rounded-lg overflow-hidden max-h-[80vh] flex flex-col" role="dialog" aria-labelledby="streams-modal-title">
        <!-- Header -->
        <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
          <div class="flex items-center gap-2">
            <span class="status-pulse"></span>
            <span id="streams-modal-title" class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">LIVE STREAMS</span>
            <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{{ streams().length }}</span>
          </div>
          <button (click)="closed.emit()" class="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1E1E2E] text-text-muted hover:text-primary transition-colors" aria-label="Fermer">
            <lucide-icon [name]="X" size="16"></lucide-icon>
          </button>
        </div>

        <!-- Stream list -->
        <div class="flex-1 overflow-y-auto">
          @for (stream of streams(); track stream.twitchId || stream.id) {
            <button
              (click)="selectStream.emit(stream)"
              class="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1E1E2E]/60 transition-colors border-b border-[#1E1E2E]/30"
            >
              <img [src]="stream.thumbnailUrl" [alt]="stream.channelName" class="w-16 h-10 object-cover rounded" />
              <div class="flex-1 min-w-0 text-left">
                <p class="font-label-caps text-[10px] text-on-surface-variant truncate">{{ stream.channelName }}</p>
                <p class="text-[10px] text-text-muted truncate">{{ stream.title }}</p>
              </div>
              <div class="flex flex-col items-end gap-1 flex-shrink-0">
                <span class="font-label-caps text-[10px] px-1 py-0.5 rounded"
                  [class]="stream.gameName === 'YouTube Live' ? 'bg-red-500/20 text-red-400' : 'bg-secondary/20 text-secondary'">
                  {{ stream.gameName === 'YouTube Live' ? 'YOUTUBE' : 'TWITCH' }}
                </span>
                @if (stream.viewerCount) {
                  <span class="font-label-caps text-[10px] text-text-muted">{{ stream.viewerCount }} viewers</span>
                }
              </div>
            </button>
          }
          @if (!streams().length) {
            <div class="p-6 text-center">
              <p class="font-label-caps text-[10px] text-text-muted">NO STREAMS LIVE</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class StreamListPopupComponent {
  readonly X = X;

  streams = input.required<TwitchStream[]>();
  closed = output<void>();
  selectStream = output<TwitchStream>();
}
