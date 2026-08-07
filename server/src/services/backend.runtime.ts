import { createWeatherService } from './weather.service';
import { createNewsService } from './news.service';
import { createYoutubeService } from './youtube.service';
import { createTwitchService } from './twitch.service';
import { createTrumpService } from './trump.service';
import { createTrumpNewsService } from './trump-news.service';
import { trumpTrainingService as sharedTrumpTrainingService } from './trump.trainer';
import { createMarketService } from './market.service';
import { createMarketIntelService } from './market-intel.service';
import { createAggregatorService } from './aggregator.service';

export function createBackendServices() {
  const weatherService = createWeatherService();
  const newsService = createNewsService();
  const youtubeService = createYoutubeService();
  const twitchService = createTwitchService();
  const trumpService = createTrumpService();
  const trumpNewsService = createTrumpNewsService();
  const marketService = createMarketService();
  const marketIntelService = createMarketIntelService(marketService, trumpService, trumpNewsService);
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
    trumpNewsService,
    trumpTrainingService: sharedTrumpTrainingService,
    marketService,
    marketIntelService,
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
  trumpNewsService,
  trumpTrainingService,
  marketService,
  marketIntelService,
  aggregatorService,
} = backendServices;
