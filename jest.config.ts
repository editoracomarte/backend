import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.strapi/', '/.cache/'],
  testTimeout: 30000,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/admin/**', '!src/**/*.d.ts'],
};

export default config;
