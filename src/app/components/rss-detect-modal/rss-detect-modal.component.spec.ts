import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RssDetectModalComponent } from './rss-detect-modal.component';
import { ApiService } from '../../services/api.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of, throwError } from 'rxjs';

describe('RssDetectModalComponent', () => {
  let component: RssDetectModalComponent;
  let fixture: ComponentFixture<RssDetectModalComponent>;
  let detectFeedResult$: Observable<{ feedUrl: string }>;
  const detectFeedCalls: string[] = [];

  beforeEach(async () => {
    detectFeedCalls.length = 0;
    detectFeedResult$ = of({ feedUrl: 'https://example.com/feed.xml' });

    await TestBed.configureTestingModule({
      imports: [RssDetectModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ApiService,
          useValue: {
            detectFeed: (url: string) => {
              detectFeedCalls.push(url);
              return detectFeedResult$;
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RssDetectModalComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit close when close button is clicked', () => {
    fixture.detectChanges();
    const emitted: void[] = [];
    component.close.subscribe(() => emitted.push(undefined));

    const closeButton = fixture.nativeElement.querySelector('button');
    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(emitted.length).toBe(1);
  });

  it('should detect feed and display result', () => {
    fixture.detectChanges();

    component.siteUrl = 'https://example.com';
    component.detect();

    expect(detectFeedCalls).toContain('https://example.com');
    expect(component.isDetecting()).toBe(false);
    expect(component.detectedFeed()).toBe('https://example.com/feed.xml');
    expect(component.error()).toBeNull();
  });

  it('should emit feedAdded when addFeed is called', () => {
    fixture.detectChanges();
    const emitted: string[] = [];
    component.feedAdded.subscribe((v) => emitted.push(v));

    component.detectedFeed.set('https://example.com/feed.xml');
    component.addFeed();

    expect(emitted).toEqual(['https://example.com/feed.xml']);
  });

  it('should close on backdrop click', () => {
    fixture.detectChanges();
    const emitted: void[] = [];
    component.close.subscribe(() => emitted.push(undefined));

    const backdrop = fixture.nativeElement.querySelector('.fixed');
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(emitted.length).toBe(1);
  });

  it('should not close when clicking inside modal content', () => {
    fixture.detectChanges();
    const emitted: void[] = [];
    component.close.subscribe(() => emitted.push(undefined));

    const modalContent = fixture.nativeElement.querySelector('.relative');
    modalContent.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(emitted.length).toBe(0);
  });

  it('should show error when detection fails', () => {
    detectFeedResult$ = throwError(() => new Error('fail'));
    fixture.detectChanges();

    component.siteUrl = 'https://bad-example.com';
    component.detect();

    expect(component.isDetecting()).toBe(false);
    expect(component.detectedFeed()).toBeNull();
    expect(component.error()).toBe('Aucun flux RSS trouvé pour ce site.');
  });
});
