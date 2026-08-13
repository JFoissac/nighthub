export default {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Limiter Jest au frontend : le backend a ses propres tests Vitest
  // (voir server/package.json — `npm test` dans server/). Sans ce `roots`,
  // Jest essayait (et échouait) de charger les *.test.ts Vitest du serveur.
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/main.ts',
    '!src/index.html',
    '!src/**/*.module.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'lcov', 'cobertura'],
  transform: {
    '^.+.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  testEnvironment: 'jsdom',
};
