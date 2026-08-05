import { createWeatherService } from './weather.service';
import { createNewsService } from './news.service';
import { createYoutubeService } from './youtube.service';
import { createTwitchService } from './twitch.service';
import { createTrumpService } from './trump.service';
import { trumpTrainingService as sharedTrumpTrainingService } from './trump.trainer';
import { createMarketService } from './market.service';
import { createAggregatorService } from './aggregator.service';

export function createBackendServices() {
  const weatherService = createWeatherService();
  const newsService = createNewsService();
  const youtubeService = createYoutubeService();
  const twitchService = createTwitchService();
  const trumpService = createTrumpService();
  const marketService = createMarketService();
  const aggregatorService = createAggregatorService({
    weatherService,
    newsService,
    youtubeService,
    twitchService,
    trumpService,
    marketService,
  });

  return {
    weatherService,
    newsService,
    youtubeService,
    twitchService,
    trumpService,
    trumpTrainingService: sharedTrumpTrainingService,
    marketService,
    aggregatorService,
  };
}

export const backendServices = createBackendServices();

export const {
  weatherService,
  newsService,
  youtubeService,
  twitchService,
  trumpService,
  trumpTrainingService,
  marketService,
  aggregatorService,
} = backendServices;
