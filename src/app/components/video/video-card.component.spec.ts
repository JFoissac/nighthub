import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VideoCardComponent } from './video-card.component';
import { YoutubeVideo } from '../../models';

describe('VideoCardComponent', () => {
  let component: VideoCardComponent;
  let fixture: ComponentFixture<VideoCardComponent>;

  const mockVideo: YoutubeVideo = {
    id: '1',
    title: 'Test Video Title',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    channelName: 'Test Channel',
    channelAvatar: 'https://example.com/avatar.jpg',
    duration: '10:30',
    views: 1500000,
    timestamp: new Date(Date.now() - 2 * 86400000),
    url: 'https://youtube.com/watch?v=1',
    isNew: true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoCardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have video input defined', () => {
    expect(component.video).toBeDefined();
  });

  it('should render nothing when video is null', () => {
    fixture.componentRef.setInput('video', null);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent?.trim()).toBe('');
  });

  it('should render video title', () => {
    fixture.componentRef.setInput('video', mockVideo);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Test Video Title');
  });

  it('should render channel name', () => {
    fixture.componentRef.setInput('video', mockVideo);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Test Channel');
  });

  it('should render formatted views', () => {
    fixture.componentRef.setInput('video', mockVideo);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('1.5M vues');
  });

  it('should render duration', () => {
    fixture.componentRef.setInput('video', mockVideo);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('10:30');
  });

  it('should show NEW badge when video is new', () => {
    fixture.componentRef.setInput('video', mockVideo);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('NEW');
  });

  it('should emit select event on click', () => {
    fixture.componentRef.setInput('video', mockVideo);
    fixture.detectChanges();

    const selected: typeof mockVideo[] = [];
    component.selected.subscribe((v) => selected.push(v));

    const card = fixture.nativeElement.querySelector('.cursor-pointer');
    card.click();

    expect(selected).toEqual([mockVideo]);
  });

  it('should format views correctly', () => {
    expect(component.formatViews(0)).toBe('');
    expect(component.formatViews(500)).toBe('500 vues');
    expect(component.formatViews(1500)).toBe('2K vues');
    expect(component.formatViews(1500000)).toBe('1.5M vues');
  });

  it('should compute relative date correctly', () => {
    expect(component.relativeDate(new Date())).toBe("aujourd'hui");
    expect(component.relativeDate(new Date(Date.now() - 86400000))).toBe('hier');
    expect(component.relativeDate(new Date(Date.now() - 3 * 86400000))).toBe('il y a 3j');
    expect(component.relativeDate(new Date(Date.now() - 14 * 86400000))).toBe('il y a 2sem');
    expect(component.relativeDate(new Date(Date.now() - 60 * 86400000))).toBe('il y a 2mois');
    expect(component.relativeDate(new Date(Date.now() - 400 * 86400000))).toBe('il y a 1an');
  });
});
