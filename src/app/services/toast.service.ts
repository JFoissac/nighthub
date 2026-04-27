import { Injectable, signal } from '@angular/core';

export type ToastType = 'error' | 'warning' | 'success';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toasts = signal<Toast[]>([]);
  readonly toasts$ = this.toasts.asReadonly();

  private counter = 0;

  show(message: string, type: ToastType = 'error', duration = 5000) {
    const id = `toast-${++this.counter}`;
    const toast: Toast = {
      id,
      type,
      message,
      createdAt: Date.now(),
    };

    this.toasts.update(t => [...t.slice(-2), toast]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  error(message: string, duration = 5000) {
    return this.show(message, 'error', duration);
  }

  warning(message: string, duration = 5000) {
    return this.show(message, 'warning', duration);
  }

  success(message: string, duration = 5000) {
    return this.show(message, 'success', duration);
  }

  dismiss(id: string) {
    this.toasts.update(t => t.filter(toast => toast.id !== id));
  }

  dismissAll() {
    this.toasts.set([]);
  }
}