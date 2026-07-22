// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // Ignores globais (substitui .eslintignore)
  {
    ignores: [
      'dist/**',
      '.strapi/**',
      '.cache/**',
      '.tmp/**',
      'node_modules/**',
      'public/**',
      'src/admin/**',
      'src/plugins/**',
      'types/generated/**',
      '**/*.test.*',
      '**/*.spec.*',
      '.maysa/**',
    ],
  },

  // Regras JS recomendadas
  js.configs.recommended,

  // Regras TypeScript recomendadas (sem type-checking para manter velocidade)
  ...tseslint.configs.recommended,

  // Overrides específicos do projeto
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Scripts Node (CommonJS) — habilita globals do Node (require, process, ...)
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Prettier DEVE ser o último — desativa regras de formatação do ESLint
  prettierConfig
);
