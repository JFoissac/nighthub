export type TrumpSeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface TrumpSeverityDescriptor {
  level: TrumpSeverityLevel;
  label: 'FAIBLE' | 'MOYEN' | 'IMPORTANT' | 'CRITIQUE';
}

export const TRUMP_BREAKING_THRESHOLD = 7;

export function getTrumpSeverity(criticality: number): TrumpSeverityDescriptor {
  if (criticality >= 8) {
    return { level: 'critical', label: 'CRITIQUE' };
  }

  if (criticality >= 6) {
    return { level: 'high', label: 'IMPORTANT' };
  }

  if (criticality >= 4) {
    return { level: 'medium', label: 'MOYEN' };
  }

  return { level: 'low', label: 'FAIBLE' };
}

export function isTrumpBreaking(criticality: number): boolean {
  return criticality >= TRUMP_BREAKING_THRESHOLD;
}

export function annotateTrumpSeverity<T extends { criticality: number; isBreaking?: boolean }>(item: T) {
  const severity = getTrumpSeverity(item.criticality);

  return {
    ...item,
    isBreaking: item.isBreaking ?? isTrumpBreaking(item.criticality),
    severityLevel: severity.level,
    severityLabel: severity.label,
  };
}
