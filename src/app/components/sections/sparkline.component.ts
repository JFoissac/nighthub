import { Component, input, viewChild, ElementRef, AfterViewInit, OnDestroy, OnChanges, ChangeDetectionStrategy } from '@angular/core';
import { Chart, Plugin } from 'chart.js/auto';

/** Dessine les prix min/max aux extrémités réelles de la courbe (canvas = alignement parfait). */
const edgePricePlugin: Plugin = {
  id: 'edgePrices',
  afterDatasetsDraw(chart) {
    const meta = chart.getDatasetMeta(0);
    const dataset = chart.data.datasets[0]?.data as number[] | undefined;
    if (!dataset || dataset.length < 2) return;
    const first = meta.data[0];
    const last = meta.data[dataset.length - 1];
    if (!first || !last) return;
    const ctx = chart.ctx;
    const fmt = (v: number) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    ctx.save();
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textBaseline = 'middle';
    // Prix de début (gauche)
    const leftText = fmt(dataset[0]);
    ctx.fillStyle = 'rgba(10,10,14,0.85)';
    ctx.fillRect(first.x - 4, first.y - 6, ctx.measureText(leftText).width + 8, 12);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(leftText, first.x, first.y);
    // Prix de fin (droite)
    const rightText = fmt(dataset[dataset.length - 1]);
    const w = ctx.measureText(rightText).width;
    ctx.fillStyle = 'rgba(10,10,14,0.85)';
    ctx.fillRect(last.x - w - 4, last.y - 6, w + 8, 12);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(rightText, last.x - w, last.y);
    ctx.restore();
  },
};

/** Sparkline Chart.js réutilisable : courbe lissée animée, points, tooltip prix. */
@Component({
  selector: 'app-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div [style.height.px]="height()"><canvas #canvas></canvas></div>`,
})
export class SparklineComponent implements AfterViewInit, OnDestroy {
  readonly data = input<number[]>([]);
  readonly positive = input(true);
  readonly height = input(32);
  readonly showEdges = input(false);
  readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  ngAfterViewInit() {
    const el = this.canvas()!.nativeElement;
    const color = this.positive() ? '#22c55e' : '#ef4444';
    const ctx = el.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height() * 2);
    gradient.addColorStop(0, this.positive() ? 'rgba(34,197,94,0.28)' : 'rgba(239,68,68,0.28)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    const values = this.data();
    const fmtP = (v: number) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: values.map((_, i) => i),
        datasets: [{
          data: values,
          borderColor: color,
          backgroundColor: gradient,
          borderWidth: 1.5,
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointBackgroundColor: color,
          pointBorderColor: '#0A0A0F',
          pointBorderWidth: 1,
          pointHoverRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1100, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: '#1E1E2E',
            borderColor: '#2A2A3E',
            borderWidth: 1,
            titleFont: { family: 'JetBrains Mono', size: 9 },
            bodyFont: { family: 'JetBrains Mono', size: 10 },
            callbacks: {
              label: (c) => `$${(c.parsed.y ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
            },
          },
        },
        scales: {
          x: this.showEdges()
            ? {
                display: true,
                grid: { display: false },
                ticks: {
                  color: '#64748b',
                  font: { family: 'JetBrains Mono', size: 9 },
                  maxRotation: 0,
                  // Prix en abscisse : début, milieu, fin
                  callback: (_, index) => {
                    const n = values.length;
                    if (index === 0 || index === n - 1 || index === Math.floor(n / 2)) {
                      return fmtP(values[index] ?? 0);
                    }
                    return '';
                  },
                },
              }
            : { display: false },
          y: { display: false },
        },
      },
      plugins: this.showEdges() ? [edgePricePlugin] : [],
    });
  }

  ngOnChanges() {
    // Données mises à jour (refresh 60s) : re-trace animé sans recréer le chart
    if (!this.chart) return;
    const values = this.data();
    if (!values.length) return;
    const ds = this.chart.data.datasets[0];
    ds.data = values;
    ds.borderColor = this.positive() ? '#22c55e' : '#ef4444';
    this.chart.update();
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
