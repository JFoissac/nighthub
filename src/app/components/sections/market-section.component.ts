import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketStore } from '../../stores/market.store';
import { MarketTicker } from '../../models';
import { ApiService } from '../../services/api.service';
import { SparklineComponent } from './sparkline.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface MarketSentiment {
  fearGreed: { value: number; classification: string; source: string };
  vix: { value: number | null; changePercent24h: number | null };
  tcsd: { delta: number; signals: { text: string; sentiment: string; source: string }[]; source: string };
  score: number;
  label: string;
  computedAt: string;
}

@Component({
  selector: 'app-market-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SparklineComponent, SkeletonComponent, EmptyStateComponent],
  templateUrl: './market-section.component.html',
})
export class MarketSectionComponent implements OnInit, OnDestroy {
  readonly store = inject(MarketStore);
  readonly api = inject(ApiService);
  readonly viewMode = signal<'grid' | 'list' | 'news'>('list');
  readonly expanded = signal<MarketTicker | null>(null);
  readonly sentiment = signal<MarketSentiment | null>(null);
  readonly marketNews = signal<any[]>([]);
  private refreshInterval?: ReturnType<typeof setInterval>;

  Math = Math;

  ngOnInit() {
    this.store.reload();
    this.loadSentiment();
    this.loadMarketNews();
    this.refreshInterval = setInterval(() => {
      this.store.reload();
      this.loadSentiment();
      this.loadMarketNews();
    }, 60000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  private loadSentiment() {
    this.api.getMarketSentiment().subscribe({
      next: (s) => this.sentiment.set(s),
      error: () => { /* garde le dernier état */ },
    });
  }

  private loadMarketNews() {
    this.api.getMarketNews().subscribe({
      next: (n) => this.marketNews.set(n),
      error: () => { /* garde le dernier état */ },
    });
  }

  toggleExpand(ticker: MarketTicker) {
    this.expanded.update(current => current?.symbol === ticker.symbol ? null : ticker);
  }

  sentimentColor(score: number): string {
    if (score <= 25) return '#ef4444';   // peur extrême
    if (score <= 45) return '#f59e0b';   // peur
    if (score <= 60) return '#94a3b8';   // neutre
    if (score <= 80) return '#34d399';   // avidité
    return '#22d3ee';                    // avidité extrême
  }

  formatPrice(price: number): string {
    if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toPrecision(4);
  }

  formatStockPrice(price: number): string {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatCap(cap: number): string {
    if (cap >= 1e12) return '$' + (cap / 1e12).toFixed(2) + 'T';
    if (cap >= 1e9) return '$' + (cap / 1e9).toFixed(1) + 'B';
    if (cap >= 1e6) return '$' + (cap / 1e6).toFixed(1) + 'M';
    if (cap >= 1e3) return '$' + (cap / 1e3).toFixed(1) + 'K';
    return '$' + cap.toLocaleString();
  }

  /** Mini-échelle du sparkline : min et max formatés. */
  sparklineRange(data: number[]): string {
    if (!data.length) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const fmt = (v: number) => v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(2);
    return `▁ ${fmt(min)} · ${fmt(max)} ▔`;
  }
}
