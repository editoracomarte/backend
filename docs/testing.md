# Testes

A suíte tem duas camadas.

- **Testes unitários** (`tests/unit/`) — validações puras e helpers que não
  dependem do Strapi (ex.: scoring de obras relacionadas, seleção de destaques,
  parsing do feed do Instagram). Rodam em
  milissegundos, sem subir nada.
- **Testes de integração** (`tests/integration/`) — sobem uma instância do Strapi
  com banco SQLite descartável (`.tmp/test.db`, recriado a cada run) e exercitam
  os endpoints REST (CRUD, validações, relações `manyToMany`, draft/publish,
  rotas customizadas). Não precisam do Postgres rodando.

O Strapi compila e carrega **uma vez por suíte** via `globalSetup` do Jest. Os
testes de integração têm timeout de **30s** por teste.

## Comandos

| Comando                    | O que faz                                                 |
| -------------------------- | --------------------------------------------------------- |
| `npm test`                 | Roda toda a suíte (unit + integration)                    |
| `npm run test:unit`        | Só os testes unitários (rápido, sem boot do Strapi)       |
| `npm run test:integration` | Só os testes de integração (sobe Strapi com SQLite local) |
| `npm run test:watch`       | Modo watch para desenvolvimento                           |
| `npm run test:coverage`    | Roda com relatório de cobertura                           |

Rodar um único arquivo:

```bash
npm run test:integration -- tests/integration/book.test.ts
```

## Convenção de cobertura (importante)

Código executado dentro do runtime do Strapi (só alcançado pela camada HTTP nos
testes de integração) **não é instrumentável** pelo Jest e sempre reporta 0%, o
que distorceria a métrica. Por isso o [`jest.config.ts`](../jest.config.ts) o
remove da cobertura:

- **Controllers/services gerados pela factory** — via um regex em
  `coveragePathIgnorePatterns`: `src/api/([^/]+)/(?:controllers|services)/\1\.ts$`.
  A backreference codifica a convenção do Strapi de que o arquivo gerado tem o
  nome da sua pasta de API (`src/api/book/services/book.ts`), então **novos
  content types criados no admin são excluídos automaticamente** — sem editar a
  config. O regex vive em `coveragePathIgnorePatterns`, não em
  `collectCoverageFrom`, porque este usa globs, que não suportam backreference.
- **Routes e schemas de content type** — excluídos por inteiro em
  `collectCoverageFrom`; ambos são puramente declarativos.

**Consequência:** lógica escrita direto num arquivo com o nome da factory (ex.:
`services/book.ts`) é invisível à cobertura. Para torná-la mensurável, coloque-a
num helper com **nome próprio** (ex.: `services/featured.ts`, `services/by-slug.ts`,
`services/related.ts`, `services/feed.ts`) que recebe `strapi` por parâmetro, faça
o service gerado apenas delegar, e cubra o helper com **testes unitários** que o
importam direto e mockam `strapi`/`fetch`. Helpers assim nomeados entram na
cobertura automaticamente — a regra acima só pula arquivos cujo nome bate com a
pasta.
