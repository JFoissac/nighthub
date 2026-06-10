import { buildTrumpScoringProfile, type TrumpCorpusEntry } from './trump.scoring';
import { TRUMP_TRAINING_CORPUS } from './trump.training-corpus';

export function buildTrumpTrainedProfile(records: TrumpCorpusEntry[] = []) {
  return buildTrumpScoringProfile([
    ...TRUMP_TRAINING_CORPUS,
    ...records,
  ]);
}
