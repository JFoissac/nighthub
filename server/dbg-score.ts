import { scoreTrumpContent, createDefaultTrumpScoringProfile } from './src/services/trump.scoring';

const profile = createDefaultTrumpScoringProfile();
const text = 'Our military has been attacked by Iran and we will respond immediately with force.';
const score = scoreTrumpContent(text, profile);
console.log('score:', score);

// inspect internals: does the military phrase match?
const lower = text.toLowerCase();
for (const p of ['attacked', 'attack', 'military', 'iran', 'war']) {
  const re = new RegExp(`\\b${p}\\b`, 'gi');
  console.log(`phrase "${p}" match:`, re.test(lower));
}
