import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TweetCardComponent } from './tweet-card.component';
import { TweetItem } from '../../models';

describe('TweetCardComponent', () => {
  let component: TweetCardComponent;
  let fixture: ComponentFixture<TweetCardComponent>;

  const mockTweet: TweetItem = {
    id: '1',
    twitterId: '123456',
    authorName: 'John Doe',
    authorHandle: '@johndoe',
    authorAvatar: 'https://example.com/avatar.jpg',
    content: 'This is a test tweet',
    timestamp: new Date(Date.now() - 3600000),
    likes: 1500,
    retweets: 300,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TweetCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TweetCardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have tweet input defined', () => {
    expect(component.tweet).toBeDefined();
  });

  it('should render nothing when tweet is null', () => {
    fixture.componentRef.setInput('tweet', null);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent?.trim()).toBe('');
  });

  it('should render tweet content', () => {
    fixture.componentRef.setInput('tweet', mockTweet);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('This is a test tweet');
  });

  it('should render author handle', () => {
    fixture.componentRef.setInput('tweet', mockTweet);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('@johndoe');
  });

  it('should render formatted likes and retweets', () => {
    fixture.componentRef.setInput('tweet', mockTweet);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('1.5K');
    expect(compiled.textContent).toContain('300');
  });

  it('should have target="_blank" on link', () => {
    fixture.componentRef.setInput('tweet', mockTweet);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a');
    expect(link).toBeTruthy();
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should compute tweetUrl with handle', () => {
    fixture.componentRef.setInput('tweet', mockTweet);
    fixture.detectChanges();
    expect(component.tweetUrl()).toBe('https://x.com/johndoe');
  });

  it('should compute tweetUrl with twitterId starting with http', () => {
    fixture.componentRef.setInput('tweet', {
      ...mockTweet,
      twitterId: 'https://twitter.com/status/123',
      authorHandle: '',
    } as TweetItem);
    fixture.detectChanges();
    expect(component.tweetUrl()).toBe('https://twitter.com/status/123');
  });

  it('should compute tweetUrl without handle', () => {
    fixture.componentRef.setInput('tweet', {
      ...mockTweet,
      authorHandle: '',
    } as TweetItem);
    fixture.detectChanges();
    expect(component.tweetUrl()).toBe('#');
  });

  it('should format numbers correctly', () => {
    expect(component.formatNum(0)).toBe('0');
    expect(component.formatNum(500)).toBe('500');
    expect(component.formatNum(1500)).toBe('1.5K');
    expect(component.formatNum(2500000)).toBe('2.5M');
  });
});
