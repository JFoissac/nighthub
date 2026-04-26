import {
  Directive,
  ElementRef,
  OnInit,
  OnDestroy,
  output,
  input,
} from '@angular/core';

@Directive({
  selector: '[appInfiniteScroll]',
  standalone: true,
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  /** When true, the observer ignores intersections (e.g. during loading) */
  disabled = input(false);

  /** Emitted when the host element becomes visible in its scroll container */
  scrolledToEnd = output<void>();

  private observer: IntersectionObserver | null = null;
  /** Skip the first intersection event fired on initial mount */
  private skipFirst = true;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit() {
    console.log('[InfiniteScroll] mounted on', this.el.nativeElement.parentElement?.className?.substring(0, 60));
    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (this.skipFirst) {
          console.log(`[InfiniteScroll] skipping initial fire`);
          this.skipFirst = false;
          return;
        }
        if (this.disabled()) {
          console.log(`[InfiniteScroll] disabled, ignoring intersection`);
          return;
        }
        console.log('[InfiniteScroll] → emitting scrolledToEnd');
        this.scrolledToEnd.emit();
      },
      {
        threshold: 0.1,
      }
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.observer = null;
  }
}
