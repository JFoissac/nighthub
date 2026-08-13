export interface AiNewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  summary: string;
  pubDate?: string;
  isNew?: boolean;
  categories?: string;
  author?: string;
  timestamp?: Date;
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
  severityLevel?: 'low' | 'medium' | 'high' | 'critical';
  severityLabel?: 'FAIBLE' | 'MOYEN' | 'IMPORTANT' | 'CRITIQUE';
  tweetDate: Date;
  timestamp?: Date;
  mediaUrls?: string;
  mediaType?: string;
  isImageOnly?: boolean;
  aiRelevance?: number;
  aiSummary?: string;
  aiReason?: string;
  aiBreaking?: boolean;
}

export interface TrumpNewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  summary: string;
  pubDate: Date;
  criticality: number;
  aiRelevance?: number;
  aiSummary?: string;
  aiReason?: string;
  isBreaking: boolean;
  matchedKeywords?: string;
  isNew?: boolean;
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
  source?: 'live' | 'cached' | 'error';
}

export interface WeatherForecast {
  city: string;
  days: WeatherDay[];
  date?: Date;
  temp?: number;
  condition?: string;
  icon?: string;
  wind?: number;
  humidity?: number;
  precipitation?: number;
  source?: 'live' | 'cached' | 'error';
  error?: string;
}

export interface TwitchStream {
  id: string;
  twitchId?: string;
  title: string;
  thumbnailUrl: string;
  viewerCount: number;
  channelName: string;
  channelHandle?: string;
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
  channelHandle?: string;
  channelAvatar: string;
  duration: string;
  views: number;
  timestamp?: Date;
  publishedAt?: Date;
  url: string;
  isNew?: boolean;
  isLive?: boolean;
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

export interface MarketTicker {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  change7d: number;
  changePercent7d: number;
  type: 'crypto' | 'stock';
  marketCap?: number;
  sparkline7d?: number[];
  volume?: number;
  high24h?: number;
  low24h?: number;
  groupKey?: string;
  groupLabel?: string;
}

export interface UserPreferences {
  weatherCity: string;
  twitchFollows: string;
  twitchUsername: string;
  youtubeChannels: string;
  youtubeChannelIds: string;
  trumpMinCriticality: number;
  customRssFeeds: string;
  refreshInterval: number;
  themeOledBlack: boolean;
  marketRefreshInterval: number;
  trumpRefreshInterval: number;
  newsRefreshInterval: number;
  streamsRefreshInterval: number;
  youtubeRefreshInterval: number;
}
