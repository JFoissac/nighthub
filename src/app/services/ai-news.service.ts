import { Injectable, signal } from '@angular/core';
import { AiNewsItem } from '../models';

@Injectable({ providedIn: 'root' })
export class AiNewsService {
  private news = signal<AiNewsItem[]>([
    {
      id: '1',
      title: 'OpenAI announces GPT-5 training complete',
      source: 'openai',
      url: 'https://openai.com/blog',
      summary: 'GPT-5 shows unprecedented reasoning capabilities across multiple benchmarks.',
      pubDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      title: 'Anthropic releases new Claude model',
      source: 'anthropic',
      url: 'https://anthropic.com/news',
      summary: 'Claude 4 introduces multi-modal reasoning and extended context windows.',
      pubDate: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      title: 'Kimi k2 sets new coding benchmark record',
      source: 'kimi',
      url: 'https://kimi.moonshot.cn',
      summary: 'The new k2 model achieves SOTA on SWE-bench and HumanEval benchmarks.',
      pubDate: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  getNews() {
    return this.news;
  }

  refresh() {
    this.news.set([...this.news()].sort(() => Math.random() - 0.5));
  }
}
