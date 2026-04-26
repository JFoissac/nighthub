import { Injectable, signal } from '@angular/core';
import { TrumpItem } from '../models';

@Injectable({ providedIn: 'root' })
export class TrumpService {
  private items = signal<TrumpItem[]>([
    {
      id: '1',
      tweetId: 'tweet1',
      content: 'New executive order on AI regulation signed today.',
      title: 'New executive order on AI regulation',
      type: 'decision',
      url: 'https://whitehouse.gov',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
      tweetDate: new Date(Date.now() - 1 * 60 * 60 * 1000),
      criticality: 7,
      sentiment: 'neutral',
      keywords: 'AI, regulation, executive order',
      likes: 12000,
      retweets: 3400,
      isBreaking: false,
    },
    {
      id: '2',
      tweetId: 'tweet2',
      content: 'Breaking: Major policy announcement coming soon.',
      title: 'Breaking: Major policy announcement',
      type: 'tweet',
      url: 'https://x.com',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      tweetDate: new Date(Date.now() - 3 * 60 * 60 * 1000),
      criticality: 5,
      sentiment: 'positive',
      keywords: 'policy, announcement',
      likes: 8900,
      retweets: 2100,
      isBreaking: true,
    },
    {
      id: '3',
      tweetId: 'tweet3',
      content: 'International summit scheduled for next month.',
      title: 'International summit scheduled for next month',
      type: 'statement',
      url: 'https://whitehouse.gov',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      tweetDate: new Date(Date.now() - 5 * 60 * 60 * 1000),
      criticality: 3,
      sentiment: 'neutral',
      keywords: 'summit, international',
      likes: 5600,
      retweets: 1200,
      isBreaking: false,
    },
  ]);

  getItems() {
    return this.items;
  }

  refresh() {
    this.items.set([...this.items()].sort(() => Math.random() - 0.5));
  }
}
