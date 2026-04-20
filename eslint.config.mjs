// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

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
      '**/*.test.*',
      '**/*.spec.*',
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
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Prettier DEVE ser o último — desativa regras de formatação do ESLint
  prettierConfig,
);
