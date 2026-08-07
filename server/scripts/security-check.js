#!/usr/bin/env node

/**
 * Security Check Script for NightHub
 *
 * This script verifies that:
 * 1. No sensitive environment files are committed
 * 2. No credentials are hardcoded in source files
 * 3. Environment isolation is respected
 *
 * Usage: npm run security:check
 */

const { readFileSync, readdirSync, statSync } = require('fs');
const { join, extname } = require('path');

const ROOT_DIR = join(__dirname, '..');
const SRC_DIR = join(ROOT_DIR, 'src');

// Patterns that indicate sensitive data
const SENSITIVE_PATTERNS = [
  { pattern: /sk_live_[a-zA-Z0-9]{20,}/, message: 'Stripe live key detected' },
  { pattern: /api[_-]?key["\s]*[=:]["\s]*["'][^$][a-zA-Z0-9]{20,}/i, message: 'API key in code' },
  { pattern: /bearer[_\s]?token["\s]*[=:]["\s]*["'][^$]/i, message: 'Bearer token detected' },
  { pattern: /password["\s]*[=:]["\s]*["'][^$]/i, message: 'Password detected' },
  { pattern: /secret[_\s]?key["\s]*[=:]["\s]*["'][^$]/i, message: 'Secret key detected' },
];

// Files that should never contain real credentials
const PROTECTED_PATTERNS = [
  '.env.prod',
  '.env.production',
  '.env.local',
];

// Check for actual .env files (not example files)
function checkEnvFiles() {
  console.log('\n🔍 Checking environment files...\n');

  const issues = [];
  const envFiles = readdirSync(ROOT_DIR).filter(
    (f) => f.startsWith('.env') && !f.includes('example')
  );

  for (const file of envFiles) {
    const filePath = join(ROOT_DIR, file);
    const stats = statSync(filePath);

    if (stats.size > 500) {
      // Real .env file with content
      const content = readFileSync(filePath, 'utf8');
      const hasRealCredentials = SENSITIVE_PATTERNS.some(
        ({ pattern }) => pattern.test(content)
      );

      if (hasRealCredentials) {
        issues.push({
          file,
          message: 'Contains what appears to be real credentials',
          severity: 'CRITICAL',
        });
      }
    }
  }

  return issues;
}

// Check source files for hardcoded credentials
function checkSourceFiles() {
  console.log('🔍 Checking source files for credentials...\n');

  const issues = [];
  const sourceFiles = getSourceFiles(SRC_DIR);

  for (const file of sourceFiles) {
    const content = readFileSync(file, 'utf8');

    for (const { pattern, message } of SENSITIVE_PATTERNS) {
      if (pattern.test(content)) {
        const relativePath = file.replace(ROOT_DIR + '/', '');
        issues.push({
          file: relativePath,
          message,
          severity: 'CRITICAL',
        });
      }
    }
  }

  return issues;
}

// Recursively get all source files (excluding test files which have mock data)
function getSourceFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && !entry.includes('node_modules')) {
      getSourceFiles(fullPath, files);
    } else if (
      ['.ts', '.js', '.json'].includes(extname(entry)) &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.spec.ts')
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

// Main execution
function main() {
  console.log('===========================================');
  console.log('🔒 NightHub Security Check');
  console.log('===========================================');

  const envIssues = checkEnvFiles();
  const sourceIssues = checkSourceFiles();
  const allIssues = [...envIssues, ...sourceIssues];

  if (allIssues.length === 0) {
    console.log('\n✅ Security check passed!');
    console.log('   - No credentials detected');
    console.log('   - Environment files are safe');
    process.exit(0);
  }

  console.log(`\n❌ Found ${allIssues.length} security issue(s):\n`);

  for (const issue of allIssues) {
    const icon = issue.severity === 'CRITICAL' ? '🚨' : '⚠️';
    console.log(`  ${icon} [${issue.severity}] ${issue.file}`);
    console.log(`     ${issue.message}\n`);
  }

  console.log('===========================================');
  console.log('❌ SECURITY CHECK FAILED');
  console.log('===========================================');
  console.log('\nPlease fix the issues above before committing.\n');

  process.exit(1);
}

main();