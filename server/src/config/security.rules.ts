/**
 * Security Rules for NightHub Agents
 *
 * These rules enforce environment isolation and prevent access to sensitive data.
 * All agents MUST comply with these rules.
 */

export const SECURITY_RULES = {
  /**
   * Allowed environments for agent operations
   */
  allowedEnvironments: ['development', 'test'] as const,

  /**
   * Blocked environments (require explicit authorization)
   */
  blockedEnvironments: ['production'] as const,

  /**
   * Sensitive variable patterns that agents should never access directly
   */
  sensitivePatterns: [
    /.*SECRET.*/i,
    /.*PASSWORD.*/i,
    /.*API_KEY.*/i,
    /.*TOKEN.*/i,
    /.*CREDENTIAL.*/i,
    /.*PRIVATE.*/i,
    /.*BEARER.*/i,
    /DATABASE_URL/,
    /YOUTUBE_CLIENT_SECRET/,
    /TWITCH_CLIENT_SECRET/,
    /OPENWEATHERMAP_API_KEY/,
  ] as RegExp[],

  /**
   * File patterns that should never be modified by agents
   */
  protectedFiles: [
    'server/.env.prod',
    'server/.env.production',
    '*.env.local',
    '*.env.production.local',
  ] as string[],

  /**
   * Commands that require explicit authorization
   */
  restrictedCommands: [
    {
      pattern: /NODE_ENV=production/,
      message: 'Production environment requires explicit authorization',
    },
    {
      pattern: /--prod/,
      message: 'Production build requires explicit authorization',
    },
    {
      pattern: /ALTER.*TABLE.*production/i,
      message: 'Production database modifications are blocked',
    },
  ] as { pattern: RegExp; message: string }[],
} as const;

/**
 * Check if a variable name is sensitive
 */
export function isSensitiveVariable(variableName: string): boolean {
  return SECURITY_RULES.sensitivePatterns.some((pattern) =>
    pattern.test(variableName)
  );
}

/**
 * Check if a command is restricted
 */
export function isRestrictedCommand(command: string): {
  restricted: boolean;
  message?: string;
} {
  for (const rule of SECURITY_RULES.restrictedCommands) {
    if (rule.pattern.test(command)) {
      return { restricted: true, message: rule.message };
    }
  }
  return { restricted: false };
}

/**
 * Get safe environment info for agents
 */
export function getSafeEnvInfo(): {
  allowed: boolean;
  environments: string[];
  message: string;
} {
  return {
    allowed: true,
    environments: [...SECURITY_RULES.allowedEnvironments],
    message: 'Agents can only access development and test environments',
  };
}

/**
 * Validate environment access
 */
export function validateEnvironmentAccess(
  requestedEnv: string
): { allowed: boolean; message?: string } {
  if (
    SECURITY_RULES.allowedEnvironments.includes(requestedEnv as any)
  ) {
    return { allowed: true };
  }

  if (SECURITY_RULES.blockedEnvironments.includes(requestedEnv as any)) {
    return {
      allowed: false,
      message: `Environment '${requestedEnv}' is blocked. Only ${SECURITY_RULES.allowedEnvironments.join(' and ')} are allowed without explicit authorization.`,
    };
  }

  return {
    allowed: false,
    message: `Unknown environment '${requestedEnv}'. Allowed: ${SECURITY_RULES.allowedEnvironments.join(', ')}`,
  };
}
