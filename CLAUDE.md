# CLAUDE.md

Guia compartilhado para humanos e assistentes de IA que trabalham neste repo. A
referência detalhada (API, content types, testes, seed, deploy) vive em
[docs/](docs/) — este arquivo guarda a orientação e as convenções que **não** são
óbvias a partir do código.

## Comandos

```bash
# Desenvolvimento
npm run dev           # Fluxo padrão: docker compose up (Postgres + Strapi, hot reload)
npm run develop       # Roda o Strapi direto, sem Docker (requer Postgres já no ar)
npm run build         # Gera o bundle de produção
npm start             # Sobe o servidor de produção

# Qualidade de código
npm run lint          # Checa erros de lint (falha em warnings)
npm run lint:fix      # Corrige erros de lint automaticamente
npm run format        # Formata com Prettier
npm run format:check  # Verifica formatação sem alterar
npm run fix           # Roda lint:fix + format

# Testes
npm test                    # Toda a suíte (unit + integration)
npm run test:unit           # Só os testes unitários (sem boot do Strapi)
npm run test:integration    # Só os de integração (sobe Strapi com SQLite)
npm run test:coverage       # Relatório de cobertura

# Rodar um único arquivo de teste
npm run test:integration -- tests/integration/book.test.ts
```

## Arquitetura

Backend headless CMS em **Strapi 5** (TypeScript), com PostgreSQL em produção e SQLite nos testes.

### Content types (`src/api/`)

Os modelos foram migrados de português para inglês. **Tipos canônicos:** `book`, `author`, `collection`, `genre` (collection types), além dos single types `instagram`, `footer`, `about-us`, `book-submission`.

- Catálogo completo, campo a campo: [docs/content-types.md](docs/content-types.md)
- Endpoints que o front consome (rotas customizadas + rotas core de lista/single type): [docs/api.md](docs/api.md)

A maioria dos content types usa o workflow **draft & publish** (`genre` é a exceção).

### Components (`src/components/`)

`midia.url` (usado por `instagram.posts`) e `address.address` (usado por `footer.address`). Detalhes dos campos em [docs/content-types.md](docs/content-types.md).

### Layout dos testes (`tests/`)

- `unit/` — validações puras de schema e helpers, sem instância do Strapi
- `integration/` — testes de API completos com `supertest` contra um Strapi vivo em SQLite (`.tmp/test.db`)
- `helpers/strapi.ts` — utilitários `setupStrapi()` / `cleanupStrapi()` usados no setup/teardown global

Os testes de integração têm timeout de 30s por teste. O Strapi compila e carrega uma vez por suíte via `globalSetup` do Jest. Mais detalhes em [docs/testing.md](docs/testing.md).

### Convenção de cobertura (importante)

Código que roda dentro do runtime do Strapi (controllers/services alcançados só pela camada HTTP) **não é instrumentável** pelo Jest e reporta 0%, então o `jest.config.ts` exclui da cobertura os arquivos com nome de factory, as rotas e os schemas.

**Regra de autoria:** lógica de negócio que precisa ser coberta vai num **arquivo helper com nome diferente da pasta** (ex.: `services/featured.ts`, `services/by-slug.ts` — não `services/book.ts`), recebe `strapi` por parâmetro, e é exercitada por **testes unitários** que o importam direto e mockam `strapi`/`fetch`. O arquivo com nome de factory apenas delega ao helper. Racional completo e os padrões de exclusão exatos: [docs/testing.md](docs/testing.md).

### Banco de dados

- Produção: PostgreSQL 16 via Docker Compose
- Testes: SQLite (configurado automaticamente quando `NODE_ENV=test`)
- O import do seed é condicional e destrutivo — ver [docs/seed.md](docs/seed.md)

### Ambiente

Copie `.env.example` para `.env` e preencha — **esse arquivo é a fonte de verdade** das variáveis obrigatórias (secrets, `DATABASE_*`, `RAPIDAPI_KEY`, `INSTAGRAM_USER_ID`, `STRAPI_IMPORT_ENCRYPTION_KEY`, `SEED_ON_BOOT`).

O fluxo padrão (`npm run dev`) sobe Postgres e Strapi no Docker. Para rodar o Strapi direto (`npm run develop`), suba **só** o Postgres antes:

```bash
docker compose up -d postgres
```

## Armadilhas conhecidas (dev)

**Testes de integração "passando" com código antigo / rotas novas dando 404.** `npm run dev` grava `dist/` como **root** (bind mount do container). Depois disso o `compileStrapi()` do `globalSetup` não consegue sobrescrever os `.js` root-owned (`EACCES`, aparece como "Found N error(s)"), o Strapi carrega o `dist/` **antigo** e o código novo some — sem erro claro de teste. Sintoma: `ls -la dist/` mostra arquivos `root root`. Correção: `npm run docker:clean` (um `rm -rf dist` normal falha nos subdiretórios root-owned, ex.: `dist/config`). Para trabalho de schema, prefira `npm run develop` local.

**Admin quebra com `Cannot read properties of null (reading 'useContext')` ou "Failed to fetch dynamically imported module" em `.strapi/vite/deps/`.** É **cache velho do navegador** (Vite), não o servidor nem o schema. Sinal inequívoco: dois `?v=` **diferentes** no mesmo stack trace — a página mistura duas gerações de deps otimizados, carregando duas cópias do React. Correção: "Clear site data" no DevTools ou abrir o admin em aba anônima (`Ctrl+Shift+R` às vezes não basta). Não perca tempo com `docker:clean` / recriar content type — isso mexe no servidor, que já está consistente.
