import { Injectable, signal } from '@angular/core';
import { TweetItem } from '../models';

@Injectable({ providedIn: 'root' })
export class TwitterService {
  private tweets = signal<TweetItem[]>([
    {
      id: '1',
      authorName: 'Elon Musk',
      authorHandle: '@elonmusk',
      authorAvatar: 'https://picsum.photos/seed/tweet1/50/50',
      content: 'Grok 3 is getting scary good at reasoning. We are living in interesting times.',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      likes: 45000,
      retweets: 12000,
    },
    {
      id: '2',
      authorName: 'Yann LeCun',
      authorHandle: '@ylecun',
      authorAvatar: 'https://picsum.photos/seed/tweet2/50/50',
      content: 'Open source AI models are catching up to closed ones faster than expected. The community is incredible.',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
      likes: 23000,
      retweets: 5400,
    },
    {
      id: '3',
      authorName: 'Kylie Jenner',
      authorHandle: '@kyliejenner',
      authorAvatar: 'https://picsum.photos/seed/tweet3/50/50',
      content: 'I hate when my skin looks bad 😫 anyone have recommendations for good skincare?',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      likes: 89000,
      retweets: 2300,
    },
    {
      id: '4',
      authorName: 'Tech Insider',
      authorHandle: '@techinsider',
      authorAvatar: 'https://picsum.photos/seed/tweet4/50/50',
      content: 'BREAKING: Apple is reportedly developing a new AI chip for data centers. Could change the AI landscape.',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      likes: 34000,
      retweets: 8900,
    },
  ]);

  getTweets() {
    return this.tweets;
  }

  refresh() {
    this.tweets.set([...this.tweets()].sort(() => Math.random() - 0.5));
  }
}