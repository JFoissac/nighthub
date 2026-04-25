import { Injectable, signal } from '@angular/core';
import { TrumpItem } from '../models';

@Injectable({ providedIn: 'root' })
export class TrumpService {
  private items = signal<TrumpItem[]>([]);

  getItems() {
    return this.items;
  }

  refresh() {
    this.items.set([...this.items()].sort(() => Math.random() - 0.5));
  }
}
