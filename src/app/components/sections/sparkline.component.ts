import { Component, input, viewChild, ElementRef, AfterViewInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Chart } from 'chart.js/auto';

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
  readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  ngAfterViewInit() {
    const el = this.canvas()!.nativeElement;
    const color = this.positive() ? '#22c55e' : '#ef4444';
    const ctx = el.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height() * 2);
    gradient.addColorStop(0, this.positive() ? 'rgba(34,197,94,0.28)' : 'rgba(239,68,68,0.28)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.data().map((_, i) => i),
        datasets: [{
          data: this.data(),
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
        animation: { duration: 900, easing: 'easeOutQuart' },
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
          x: { display: false },
          y: { display: false },
        },
      },
    });
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
