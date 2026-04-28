import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VideoPlayerPanelComponent } from './video-player-panel.component';
import { YoutubeVideo } from '../../models';

describe('VideoPlayerPanelComponent', () => {
  let fixture: ComponentFixture<VideoPlayerPanelComponent>;

  const baseVideo: YoutubeVideo = {
    id: 'yt2',
    youtubeId: 'xyz987',
    title: 'Panel Video',
    thumbnailUrl: 'https://example.com/thumb2.jpg',
    channelName: 'Panel Channel',
    channelAvatar: '',
    duration: '5:20',
    views: 3456,
    url: 'https://www.youtube.com/watch?v=xyz987',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoPlayerPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoPlayerPanelComponent);
  });

  it('renders channel handle when present', () => {
    fixture.componentRef.setInput('video', { ...baseVideo, channelHandle: '@panelchannel' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('Panel Channel');
    expect(text).toContain('@panelchannel');
  });

  it('does not render handle text when absent', () => {
    fixture.componentRef.setInput('video', baseVideo);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('Panel Channel');
    expect(text).not.toContain('@panelchannel');
  });

  it('does not render channel ID when handle is not an @handle', () => {
    fixture.componentRef.setInput('video', { ...baseVideo, channelHandle: 'UCVScf_hK_5tpcpxaKZ2NTcQ' });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).not.toContain('UCVScf_hK_5tpcpxaKZ2NTcQ');
  });
});
