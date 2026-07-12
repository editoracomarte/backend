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
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/admin/**',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/api/**/content-types/**', // schemas
    '!src/api/**/routes/**', // rotas: declarativas, montadas pelo Strapi
  ],
  // Código gerado/executado pelo Strapi: não é instrumentável pelo Jest (roda no
  // processo do Strapi via testes de integração), então sempre apareceria como 0%
  // e distorceria a métrica. A factory sempre nomeia o arquivo igual à pasta da API
  // (src/api/obra/services/obra.ts) — o backreference \1 captura isso para qualquer
  // content-type novo, sem precisar editar esta config. Helpers co-localizados com
  // nome próprio (services/featured.ts, services/by-slug.ts) continuam medidos.
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'src/api/([^/]+)/(?:controllers|services)/\\1\\.ts$',
  ],
  // text/text-summary imprimem no log; json-summary + json geram
  // coverage/coverage-summary.json e coverage-final.json, consumidos pelo
  // scripts/coverage-summary.js para montar o Job Summary do CI (incl. as
  // linhas descobertas por arquivo).
  coverageReporters: ['text', 'text-summary', 'json-summary', 'json'],
};

export default config;
