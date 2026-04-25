export interface AiNewsItem {
  id: string;
  title: string;
  source: 'anthropic' | 'openai' | 'kimi';
  url: string;
  summary: string;
  timestamp: Date;
  isNew?: boolean;
}

export interface TrumpItem {
  id: string;
  tweetId: string;
  content: string;
  title?: string;
  type: 'tweet' | 'decision' | 'scandal' | 'statement';
  criticality: number;
  sentiment: 'negative' | 'neutral' | 'positive';
  keywords: string;
  url: string;
  likes: number;
  retweets: number;
  isBreaking: boolean;
  tweetDate: Date;
  timestamp?: Date;
}

export interface WeatherDay {
  city: string;
  temp: number;
  tempMin: number;
  tempMax: number;
  condition: string;
  icon: string;
  wind: number;
  humidity: number;
  precipitation: number;
  forecastDate: Date;
  dayIndex: number;
}

export interface WeatherForecast {
  city: string;
  days: WeatherDay[];
  // Legacy single-day compatibility
  date?: Date;
  temp?: number;
  condition?: string;
  icon?: string;
  wind?: number;
  humidity?: number;
  precipitation?: number;
}

export interface TwitchStream {
  id: string;
  twitchId?: string;
  title: string;
  thumbnailUrl: string;
  viewerCount: number;
  channelName: string;
  channelLogin?: string;
  channelAvatar: string;
  gameName: string;
  isLive: boolean;
  url: string;
}

export interface TwitchFollow {
  channelId: string;
  channelName: string;
  channelAvatar: string;
  isLive: boolean;
  gameName?: string;
}

export interface YoutubeVideo {
  id: string;
  youtubeId?: string;
  title: string;
  thumbnailUrl: string;
  channelName: string;
  channelAvatar: string;
  duration: string;
  views: number;
  timestamp?: Date;
  publishedAt?: Date;
  url: string;
  isNew?: boolean;
}

export interface TweetItem {
  id: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  content: string;
  timestamp: Date;
  mediaUrl?: string;
  likes: number;
  retweets: number;
}
