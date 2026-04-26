import { Injectable, signal } from '@angular/core';
import { TwitchStream } from '../models';

@Injectable({ providedIn: 'root' })
export class TwitchService {
  private streams = signal<TwitchStream[]>([
    {
      id: '1',
      title: 'Playing Hades II - Endless Run Challenge',
      thumbnailUrl: 'https://picsum.photos/seed/twitch1/320/180',
      viewerCount: 12453,
      channelName: 'sanchitoc',
      channelAvatar: 'https://picsum.photos/seed/avatar1/50/50',
      gameName: 'Hades II',
      isLive: true,
      url: 'https://twitch.tv/sanchitoc',
    },
    {
      id: '2',
      title: 'Chill Lo-Fi Beats to Code To 🧘',
      thumbnailUrl: 'https://picsum.photos/seed/twitch2/320/180',
      viewerCount: 8234,
      channelName: 'dev_chill',
      channelAvatar: 'https://picsum.photos/seed/avatar2/50/50',
      gameName: 'Music',
      isLive: true,
      url: 'https://twitch.tv/dev_chill',
    },
    {
      id: '3',
      title: 'React + AI: Building an Agent | Part 5',
      thumbnailUrl: 'https://picsum.photos/seed/twitch3/320/180',
      viewerCount: 5621,
      channelName: 'techstreaming',
      channelAvatar: 'https://picsum.photos/seed/avatar3/50/50',
      gameName: 'Software & Game Dev',
      isLive: true,
      url: 'https://twitch.tv/techstreaming',
    },
    {
      id: '4',
      title: 'Speedrun Any% in 25 mins',
      thumbnailUrl: 'https://picsum.photos/seed/twitch4/320/180',
      viewerCount: 2341,
      channelName: 'speedrun_pro',
      channelAvatar: 'https://picsum.photos/seed/avatar4/50/50',
      gameName: 'Celeste',
      isLive: true,
      url: 'https://twitch.tv/speedrun_pro',
    },
  ]);

  getStreams() {
    return this.streams;
  }

  refresh() {
    this.streams.update(streams =>
      streams.map(s => ({
        ...s,
        viewerCount: s.viewerCount + Math.floor(Math.random() * 100 - 50),
      }))
    );
  }
}