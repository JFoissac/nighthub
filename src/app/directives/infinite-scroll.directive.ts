import {
  Directive,
  ElementRef,
  OnInit,
  OnDestroy,
  output,
  input,
  inject,
} from '@angular/core';

@Directive({
  selector: '[appInfiniteScroll]',
  standalone: true,
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  disabled = input(false);

  scrolledToEnd = output<void>();

  private removeScrollListener: (() => void) | null = null;
  private isTicking = false;
  private readonly bottomOffsetPx = 24;

  private readonly el: ElementRef<HTMLElement> = inject(ElementRef);

  ngOnInit() {
    const scrollRoot = this.findScrollRoot(this.el.nativeElement);
    if (!scrollRoot) return;

    const onScroll = () => {
      if (this.isTicking) return;
      this.isTicking = true;

      requestAnimationFrame(() => {
        this.isTicking = false;
        if (this.disabled()) return;

        const distanceToBottom = scrollRoot.scrollHeight - (scrollRoot.scrollTop + scrollRoot.clientHeight);
        if (distanceToBottom <= this.bottomOffsetPx) {
          this.scrolledToEnd.emit();
        }
      });
    };

    scrollRoot.addEventListener('scroll', onScroll, { passive: true });
    this.removeScrollListener = () => scrollRoot.removeEventListener('scroll', onScroll);
  }

  ngOnDestroy() {
    this.removeScrollListener?.();
    this.removeScrollListener = null;
  }

  private findScrollRoot(start: HTMLElement): HTMLElement | null {
    let parent = start.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      const overflowY = style.overflowY;
      const canScroll = overflowY === 'auto' || overflowY === 'scroll';
      if (canScroll) return parent;
      parent = parent.parentElement;
    }
    return null;
  }
}