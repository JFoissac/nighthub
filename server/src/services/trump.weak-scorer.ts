export interface TrumpWeakScore {
  score: number;
  bucket: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  triggeredRules: string[];
  reviewFlag: boolean;
}

const LOW_RULES = [
  ['promo_endorsement', /\b(complete and total endorsement|endorsement|re-election|telerally|thank you|great crowd|maga)\b/i],
  ['personal_or_generic', /\b(congratulations|happy birthday|great meeting|beautiful day|good luck)\b/i],
] as const;

const MID_RULES = [
  ['partisan_attack', /\b(cheaters|thieves|corrupt|crooked|fake news|witch hunt|hoax|rigged|enemy)\b/i],
  ['culture_war', /\b(crime|immigration|border|voter identification|voter id|illegal aliens)\b/i],
] as const;

const HIGH_RULES = [
  ['institutional', /\b(fbi|cia|doj|justice department|supreme court|treasury|fed|federal reserve|national guard|pentagon)\b/i],
  ['market_sensitive', /\b(tariff|tariffs|sanctions|trade war|trade deficit|economy|inflation|export controls)\b/i],
  ['geopolitical', /\b(iran|china|russia|ukraine|nato|north korea|israel)\b/i],
  ['military', /\b(troops|military|strike|strikes)\b/i],
] as const;

const EXTREME_RULES = [
  ['direct_escalation', /\b(bomb|bombardment|missile|missiles|blockade|invade|invasion|retaliation|respond immediately)\b/i],
  ['crisis_signaling', /\b(martial law|civil war|constitutional crisis|national emergency)\b/i],
  ['severe_rupture', /\b(secretary of state has resigned|secretary of defense has been fired|nuclear)\b/i],
] as const;

const LITERAL_CONFLICT_TERMS = /\b(attack|attacked|war|strike|strikes)\b/i;
const AGENCY_TERMS = /\b(we|i|our|my administration|united states|at my direction|i am ordering|i ordered|we will|i will|launch|launched)\b/i;
const BENIGN_CONFLICT_CONTEXT = /\b(attack ad|attack ads|war against|war on|culture war|stock market|emergency declaration|article|opinion|bluster|good conversation|cease all shooting|waging war against|war against gangs)\b/i;
const CALMING_CONTEXT = /\b(ceasefire|peace talks|agreed to cease|agreed to stop|good conversation)\b/i;

function normalizeText(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function scoreBucket(score: number): TrumpWeakScore['bucket'] {
  if (score <= 2) return 'LOW';
  if (score <= 5) return 'MEDIUM';
  if (score <= 8) return 'HIGH';
  return 'EXTREME';
}

function styleIntensityAdjustment(text: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const exclamations = (text.match(/!/g) || []).length;
  const questions = (text.match(/\?/g) || []).length;
  const capsWords = (text.match(/\b[A-Z]{4,}\b/g) || []).length;

  if (exclamations >= 3) {
    score += 1;
    reasons.push('many_exclamations');
  }
  if (questions >= 3) {
    score += 1;
    reasons.push('many_question_marks');
  }
  if (capsWords >= 3) {
    score += 1;
    reasons.push('many_all_caps_words');
  }

  return { score, reasons };
}

function matchedRuleNames(text: string, rules: readonly (readonly [string, RegExp])[]): string[] {
  return rules.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

export function scoreTrumpTextWeakly(rawText: string): TrumpWeakScore {
  const text = normalizeText(rawText);
  const lower = text.toLowerCase();
  const triggeredRules: string[] = [];
  let score = 0;

  if (!lower) {
    return { score: 0, bucket: 'LOW', triggeredRules: ['empty_or_non_text'], reviewFlag: false };
  }

  const benignConflict = BENIGN_CONFLICT_CONTEXT.test(lower);
  const literalConflict = LITERAL_CONFLICT_TERMS.test(lower);
  const directAgency = AGENCY_TERMS.test(lower);
  const calming = CALMING_CONTEXT.test(lower);

  const extremeHits = matchedRuleNames(lower, EXTREME_RULES);
  if (extremeHits.length > 0) {
    score = Math.max(score, 9);
    triggeredRules.push(...extremeHits);
    if (
      /\b(iran|china|russia|north korea|israel|ukraine)\b/i.test(lower) &&
      /\b(attack|attacked|bomb|missile|war|blockade|invade|invasion)\b/i.test(lower) &&
      directAgency
    ) {
      score = 10;
      triggeredRules.push('explicit_geopolitical_escalation');
    }
  }

  if (literalConflict && !benignConflict) {
    if (directAgency) {
      score = Math.max(score, 8);
      triggeredRules.push('literal_conflict_with_agency');
    } else {
      score = Math.max(score, 6);
      triggeredRules.push('literal_conflict_reference');
    }
  }

  const highHits = matchedRuleNames(lower, HIGH_RULES);
  if (highHits.length > 0) {
    triggeredRules.push(...highHits);
    if (highHits.includes('military') && highHits.includes('geopolitical')) {
      score = Math.max(score, 8);
    } else if (highHits.includes('institutional') || highHits.includes('market_sensitive')) {
      score = Math.max(score, 6);
    } else {
      score = Math.max(score, 5);
    }
  }

  const midHits = matchedRuleNames(lower, MID_RULES);
  if (midHits.length > 0) {
    triggeredRules.push(...midHits);
    score = Math.max(score, midHits.length === 1 ? 3 : 4);
  }

  const lowHits = matchedRuleNames(lower, LOW_RULES);
  if (lowHits.length > 0 && score === 0) {
    triggeredRules.push(...lowHits);
    score = 1;
  }

  const style = styleIntensityAdjustment(text);
  if (score >= 3) {
    score = Math.min(10, score + style.score);
    triggeredRules.push(...style.reasons);
  }

  if (benignConflict && score >= 8) {
    score = Math.max(4, score - 3);
    triggeredRules.push('benign_conflict_context');
  }
  if (calming && score >= 7) {
    score = Math.max(5, score - 2);
    triggeredRules.push('calming_context');
  }
  if (triggeredRules.includes('market_sensitive') && /\b(stock market|all-time high|economy)\b/i.test(lower) && score >= 7) {
    score = Math.max(4, score - 3);
    triggeredRules.push('non_escalatory_market_context');
  }
  if (/\bemergency declaration\b/i.test(lower) && score >= 7) {
    score = Math.max(3, score - 4);
    triggeredRules.push('administrative_emergency_context');
  }

  if (score === 0 && /\b(great|good|nice|meeting|crowd|watch|tonight)\b/i.test(lower)) {
    score = 1;
    triggeredRules.push('generic_political_chatter');
  }

  const uniqueRules = [...new Set(triggeredRules.length ? triggeredRules : ['default_low'])];
  return {
    score,
    bucket: scoreBucket(score),
    triggeredRules: uniqueRules,
    reviewFlag: uniqueRules.includes('benign_conflict_context') || uniqueRules.includes('administrative_emergency_context'),
  };
}
