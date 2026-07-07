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
    // Código gerado/executado pelo Strapi: não é instrumentável pelo Jest
    // (roda no processo do Strapi via testes de integração), então sempre
    // apareceria como 0% e distorceria a métrica. Helpers puros co-localizados
    // (ex.: services/featured.ts) NÃO são excluídos, e por isso são medidos.
    '!src/index.ts',
    '!src/api/**/content-types/**', // schemas
    '!src/api/**/{obra,autor,colecao,genero,instagram}.ts', // controllers/services/routes gerados pela factory
    '!src/api/**/01-custom-*.ts', // rotas custom (montam rotas no Strapi)
  ],
};

export default config;
