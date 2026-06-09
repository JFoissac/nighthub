/**
 * Environment Manager for NightHub
 *
 * Manages environment-specific configurations and enforces security rules.
 * Agents should ALWAYS use environments through this module to ensure:
 * - No accidental access to production credentials
 * - Proper environment isolation
 * - Audit trail for environment access
 */

import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

export type Environment = 'development' | 'test' | 'production';

/**
 * Environment configuration for agents
 * Agents should use these configurations when performing operations
 */
export interface AgentEnvironmentConfig {
  env: Environment;
  displayName: string;
  description: string;
  allowedOrigins: string[];
  databaseUrl: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  rateLimit: {
    windowMs: number;
    max: number;
  };
  features: {
    enableDebugMode: boolean;
    enableDetailedErrors: boolean;
    enableExperimentalFeatures: boolean;
  };
}

const ENVIRONMENTS: Record<Environment, AgentEnvironmentConfig> = {
  development: {
    env: 'development',
    displayName: 'Development',
    description: 'Local development environment with debug features enabled',
    allowedOrigins: ['http://localhost:4200', 'http://127.0.0.1:4200'],
    databaseUrl: 'file:./dev.db',
    logLevel: 'debug',
    rateLimit: {
      windowMs: 60 * 1000,
      max: 100,
    },
    features: {
      enableDebugMode: true,
      enableDetailedErrors: true,
      enableExperimentalFeatures: true,
    },
  },
  test: {
    env: 'test',
    displayName: 'Test',
    description: 'Isolated test environment with mock data',
    allowedOrigins: ['http://localhost:4201', 'http://127.0.0.1:4201'],
    databaseUrl: 'file:./test.db',
    logLevel: 'info',
    rateLimit: {
      windowMs: 60 * 1000,
      max: 200, // More requests allowed in test for parallel operations
    },
    features: {
      enableDebugMode: true,
      enableDetailedErrors: true,
      enableExperimentalFeatures: false,
    },
  },
  production: {
    env: 'production',
    displayName: 'Production',
    description: 'Production environment with real credentials - ACCESS RESTRICTED',
    allowedOrigins: [], // Must be configured via environment variables
    databaseUrl: '', // Must be configured via environment variables
    logLevel: 'warn',
    rateLimit: {
      windowMs: 60 * 1000,
      max: 50, // Stricter limits in production
    },
    features: {
      enableDebugMode: false,
      enableDetailedErrors: false,
      enableExperimentalFeatures: false,
    },
  },
};

/**
 * Sensitive environment variables that should never be exposed to agents
 */
const SENSITIVE_VARIABLES = [
  'YOUTUBE_CLIENT_SECRET',
  'TWITCH_CLIENT_SECRET',
  'OPENWEATHERMAP_API_KEY',
  'YOUTUBE_API_KEY',
  'DATABASE_URL',
  'PIPED_INSTANCE_URL',
];

class EnvironmentManager {
  private currentEnv: Environment = 'development';
  private initialized = false;

  /**
   * Initialize environment from file or defaults
   */
  initialize(env: Environment = 'development'): AgentEnvironmentConfig {
    if (this.initialized) {
      return this.getConfig();
    }

    this.currentEnv = env;

    // Load environment file if exists
    const envFile = this.getEnvFilePath(env);
    if (existsSync(envFile)) {
      dotenv.config({ path: envFile });
    }

    // Override with process.env if set
    if (process.env.NODE_ENV) {
      const envFromProcess = process.env.NODE_ENV as Environment;
      if (ENVIRONMENTS[envFromProcess]) {
        this.currentEnv = envFromProcess;
      }
    }

    this.initialized = true;
    return this.getConfig();
  }

  /**
   * Get the path to an environment file
   */
  private getEnvFilePath(env: Environment): string {
    const basePath = resolve(__dirname, '../..');
    switch (env) {
      case 'development':
        return `${basePath}/.env.dev`;
      case 'test':
        return `${basePath}/.env.test`;
      case 'production':
        return `${basePath}/.env.prod`;
      default:
        return `${basePath}/.env`;
    }
  }

  /**
   * Get the current environment configuration
   */
  getConfig(): AgentEnvironmentConfig {
    return ENVIRONMENTS[this.currentEnv];
  }

  /**
   * Get the current environment name
   */
  getCurrentEnv(): Environment {
    return this.currentEnv;
  }

  /**
   * Check if the current environment is production
   */
  isProduction(): boolean {
    return this.currentEnv === 'production';
  }

  /**
   * Check if the current environment is test
   */
  isTest(): boolean {
    return this.currentEnv === 'test';
  }

  /**
   * Check if the current environment is development
   */
  isDevelopment(): boolean {
    return this.currentEnv === 'development';
  }

  /**
   * Get a sanitized version of environment variables
   * Removes sensitive values for agent consumption
   */
  getSanitizedEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    const rawEnv = process.env;

    for (const [key, value] of Object.entries(rawEnv)) {
      if (SENSITIVE_VARIABLES.includes(key)) {
        env[key] = '[REDACTED]';
      } else {
        env[key] = value || '';
      }
    }

    return env;
  }

  /**
   * Get all available environments
   */
  getAvailableEnvironments(): AgentEnvironmentConfig[] {
    return Object.values(ENVIRONMENTS);
  }

  /**
   * Validate that access to production is authorized
   */
  validateProductionAccess(): { allowed: boolean; reason?: string } {
    if (this.currentEnv !== 'production') {
      return { allowed: true };
    }

    // Production access requires explicit authorization
    const hasExplicitAuth = process.env.ALLOW_PRODUCTION_ACCESS === 'true';
    const hasApiKey = Boolean(process.env.PROD_ACCESS_API_KEY);

    if (!hasExplicitAuth && !hasApiKey) {
      return {
        allowed: false,
        reason: 'Production environment access requires explicit authorization. Set ALLOW_PRODUCTION_ACCESS=true or provide PROD_ACCESS_API_KEY.',
      };
    }

    return { allowed: true };
  }

  /**
   * Check if a variable name is sensitive
   */
  isSensitiveVariable(variableName: string): boolean {
    return SENSITIVE_VARIABLES.some(
      (sv) => variableName.toLowerCase().includes(sv.toLowerCase())
    );
  }

  /**
   * Get masked value for a sensitive variable
   */
  maskSensitiveValue(value: string | undefined): string {
    if (!value) return '[NOT SET]';
    if (value.length <= 4) return '****';
    return `****${value.slice(-4)}`;
  }
}

export const envManager = new EnvironmentManager();

// Export for use in other modules
export const {
  getConfig,
  getCurrentEnv,
  isProduction,
  isTest,
  isDevelopment,
  getSanitizedEnv,
  getAvailableEnvironments,
  validateProductionAccess,
  isSensitiveVariable,
  maskSensitiveValue,
} = envManager;
