import { Injectable, signal } from '@angular/core';
import { YoutubeVideo } from '../models';

@Injectable({ providedIn: 'root' })
export class YoutubeService {
  private videos = signal<YoutubeVideo[]>([
    {
      id: '1',
      title: 'I Built a Full AI Agent in 48 Hours',
      thumbnailUrl: 'https://picsum.photos/seed/yt1/320/180',
      channelName: 'TechCrunch',
      channelAvatar: 'https://picsum.photos/seed/ytavatar1/50/50',
      duration: '18:42',
      views: 245000,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      url: 'https://youtube.com/watch?v=1',
      isNew: true,
    },
    {
      id: '2',
      title: 'The Future of Web Development in 2025',
      thumbnailUrl: 'https://picsum.photos/seed/yt2/320/180',
      channelName: 'Fireship',
      channelAvatar: 'https://picsum.photos/seed/ytavatar2/50/50',
      duration: '12:35',
      views: 189000,
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      url: 'https://youtube.com/watch?v=2',
      isNew: true,
    },
    {
      id: '3',
      title: 'Inside TikTok Algorithm (Leaked Data)',
      thumbnailUrl: 'https://picsum.photos/seed/yt3/320/180',
      channelName: 'Veritasium',
      channelAvatar: 'https://picsum.photos/seed/ytavatar3/50/50',
      duration: '24:18',
      views: 1200000,
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
      url: 'https://youtube.com/watch?v=3',
      isNew: false,
    },
    {
      id: '4',
      title: 'Rust for Beginners - Complete Course',
      thumbnailUrl: 'https://picsum.photos/seed/yt4/320/180',
      channelName: 'The Rust Programming Language',
      channelAvatar: 'https://picsum.photos/seed/ytavatar4/50/50',
      duration: '1:45:22',
      views: 89000,
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
      url: 'https://youtube.com/watch?v=4',
      isNew: false,
    },
  ]);

  getVideos() {
    return this.videos;
  }

  refresh() {
    this.videos.update(videos =>
      videos.map(v => ({
        ...v,
        views: v.views + Math.floor(Math.random() * 1000),
      }))
    );
  }
}