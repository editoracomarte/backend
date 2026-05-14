import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.strapi/', '/.cache/'],
  globalSetup: '<rootDir>/tests/helpers/global-setup.ts',
  globalTeardown: '<rootDir>/tests/helpers/global-teardown.ts',
  testTimeout: 30000,
  verbose: true,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/admin/**', '!src/**/*.d.ts'],
};

export default config;
