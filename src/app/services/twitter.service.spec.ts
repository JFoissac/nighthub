import { TestBed } from '@angular/core/testing';
import { TwitterService } from './twitter.service';

describe('TwitterService', () => {
  let service: TwitterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TwitterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTweets', () => {
    it('should return a signal of tweets', () => {
      const tweets = service.getTweets();
      expect(tweets).toBeDefined();
      expect(typeof tweets).toBe('function');
    });

    it('should return initial mock data', () => {
      const tweets = service.getTweets()();
      expect(tweets).toBeDefined();
      expect(Array.isArray(tweets)).toBe(true);
      expect(tweets.length).toBeGreaterThan(0);
    });

    it('should have tweets with required properties', () => {
      const tweets = service.getTweets()();
      const firstTweet = tweets[0];
      expect(firstTweet).toHaveProperty('id');
      expect(firstTweet).toHaveProperty('authorName');
      expect(firstTweet).toHaveProperty('authorHandle');
      expect(firstTweet).toHaveProperty('authorAvatar');
      expect(firstTweet).toHaveProperty('content');
      expect(firstTweet).toHaveProperty('timestamp');
      expect(firstTweet).toHaveProperty('likes');
      expect(firstTweet).toHaveProperty('retweets');
    });

    it('should have numeric engagement counts', () => {
      const tweets = service.getTweets()();
      tweets.forEach(tweet => {
        expect(typeof tweet.likes).toBe('number');
        expect(typeof tweet.retweets).toBe('number');
      });
    });
  });

  describe('refresh', () => {
    it('should not throw when called', () => {
      expect(() => service.refresh()).not.toThrow();
    });
  });
});