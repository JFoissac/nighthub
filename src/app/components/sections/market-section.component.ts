import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketStore } from '../../stores/market.store';
import { MarketTicker } from '../../models';
import { ApiService } from '../../services/api.service';

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
  imports: [CommonModule],
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
    // Longueurs réelles des courbes au premier rendu (mini sparklines GRID/LIST)
    setTimeout(() => this.measureSparklineLengths(), 300);
    this.refreshInterval = setInterval(() => {
      this.store.reload();
      this.loadSentiment();
      this.loadMarketNews();
    }, 60000);
  }

  private measureSparklineLengths() {
    document.querySelectorAll<SVGPathElement>('.sparkline-draw').forEach((p) => {
      try {
        const len = Math.max(1, p.getTotalLength());
        p.style.setProperty('--draw-length', String(len));
      } catch { /* path non rendu */ }
    });
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
    // Après le rendu du bloc déplié : longueur réelle de la courbe (getTotalLength)
    setTimeout(() => this.measureSparklineLengths(), 0);
  }

  sentimentColor(score: number): string {
    if (score <= 25) return '#ef4444';   // peur extrême
    if (score <= 45) return '#f59e0b';   // peur
    if (score <= 60) return '#94a3b8';   // neutre
    if (score <= 80) return '#34d399';   // avidité
    return '#22d3ee';                    // avidité extrême
  }

  /** Mini-échelle du sparkline : min et max formatés. */
  sparklineRange(data: number[]): string {
    if (!data.length) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const fmt = (v: number) => v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(2);
    return `▁ ${fmt(min)} · ${fmt(max)} ▔`;
  }

  /** Path "M..L.." pour l'animation de tracé (stroke-dashoffset). */
  sparklinePath(data: number[], width: number, height: number): string {
    if (!data.length) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = width / (data.length - 1 || 1);
    const pts = data.map((val, i) => ({
      x: i * step,
      y: height - ((val - min) / range) * (height - 4) - 2,
    }));
    if (pts.length < 3) {
      return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    }
    // Lissage Catmull-Rom → Bézier (rendu "smooth" type ApexCharts)
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }

  /** Points [x,y] pour les cercles animés en cascade. */
  sparklinePointsArray(data: number[], width: number, height: number): { x: number; y: number }[] {
    if (!data.length) return [];
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = width / (data.length - 1 || 1);
    return data.map((val, i) => ({
      x: i * step,
      y: height - ((val - min) / range) * (height - 4) - 2,
    }));
  }

  /** Points en % (HTML absolute, non étirés par le SVG preserveAspectRatio=none). */
  sparklineDots(data: number[], width: number, height: number): { xPct: number; yPct: number; price: number }[] {
    if (!data.length) return [];
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = width / (data.length - 1 || 1);
    return data.map((val, i) => ({
      xPct: (i * step / width) * 100,
      yPct: ((height - ((val - min) / range) * (height - 4) - 2) / height) * 100,
      price: val,
    }));
  }

  /** Index du point le plus proche de la souris (tooltip prix au survol). */
  readonly hoverIndex = signal(-1);

  onGraphHover(event: MouseEvent, ticker: MarketTicker) {
    const svg = (event.currentTarget as SVGSVGElement);
    const rect = svg.getBoundingClientRect();
    const xRatio = (event.clientX - rect.left) / rect.width;
    const data = ticker.sparkline7d || [];
    if (!data.length) return;
    const idx = Math.round(xRatio * (data.length - 1));
    this.hoverIndex.set(Math.max(0, Math.min(data.length - 1, idx)));
  }

  onGraphLeave() {
    this.hoverIndex.set(-1);
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
    const path = this.sparklinePath(data, width, height);
    return `${path} L${width},${height} L0,${height} Z`;
  }
}
