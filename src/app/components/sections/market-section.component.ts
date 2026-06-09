import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketStore } from '../../stores/market.store';
import { MarketTicker } from '../../models';

@Component({
  selector: 'app-market-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './market-section.component.html',
})
export class MarketSectionComponent implements OnInit, OnDestroy {
  readonly store = inject(MarketStore);
  readonly viewMode = signal<'grid' | 'list'>('list');
  readonly expanded = signal<MarketTicker | null>(null);
  private refreshInterval?: ReturnType<typeof setInterval>;

  Math = Math;

  ngOnInit() {
    this.store.reload();
    this.refreshInterval = setInterval(() => this.store.reload(), 60000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  toggleExpand(ticker: MarketTicker) {
    this.expanded.update(current => current?.symbol === ticker.symbol ? null : ticker);
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

  sparklinePoints(data: number[], width: number, height: number): string {
    if (!data.length) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = width / (data.length - 1 || 1);
    return data.map((val, i) => {
      const x = i * step;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  sparklineArea(data: number[], width: number, height: number): string {
    if (!data.length) return '';
    const points = this.sparklinePoints(data, width, height);
    return `0,${height} ${points} ${width},${height}`;
  }
}
