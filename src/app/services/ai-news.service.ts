import { Injectable, signal } from '@angular/core';
import { AiNewsItem } from '../models';

@Injectable({ providedIn: 'root' })
export class AiNewsService {
  private news = signal<AiNewsItem[]>([]);

  getNews() {
    return this.news;
  }

  refresh() {
    this.news.set([...this.news()].sort(() => Math.random() - 0.5));
  }
}
