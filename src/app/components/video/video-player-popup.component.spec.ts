import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VideoPlayerPopupComponent } from './video-player-popup.component';
import { YoutubeVideo } from '../../models';

describe('VideoPlayerPopupComponent', () => {
  let fixture: ComponentFixture<VideoPlayerPopupComponent>;

  const baseVideo: YoutubeVideo = {
    id: 'yt1',
    youtubeId: 'abc123',
    title: 'Test Video',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    channelName: 'Test Channel',
    channelAvatar: '',
    duration: '10:00',
    views: 1200,
    url: 'https://www.youtube.com/watch?v=abc123',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoPlayerPopupComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoPlayerPopupComponent);
  });

  it('renders channel handle when present', () => {
    fixture.componentRef.setInput('video', { ...baseVideo, channelHandle: '@testchannel' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('Test Channel');
    expect(text).toContain('@testchannel');
  });

  it('does not render handle text when absent', () => {
    fixture.componentRef.setInput('video', baseVideo);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('Test Channel');
    expect(text).not.toContain('@testchannel');
  });

  it('does not render channel ID when handle is not an @handle', () => {
    fixture.componentRef.setInput('video', { ...baseVideo, channelHandle: 'UCVScf_hK_5tpcpxaKZ2NTcQ' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).not.toContain('UCVScf_hK_5tpcpxaKZ2NTcQ');
  });
});
