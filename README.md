# Com Arte — Backend

API backend do projeto Com Arte, construída com [Strapi 5](https://strapi.io/) e
PostgreSQL.

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e Docker Compose
- [Node.js](https://nodejs.org/) 20–24 e npm (para rodar os scripts `npm run …`)

## Configuração

1. Copie o arquivo de exemplo:

   ```bash
   cp .env.example .env
   ```

2. Preencha o `.env`:

   | Variável                       | Como obter                                                                                                             |
   | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
   | `APP_KEYS`                     | Gere dois valores separados por vírgula: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
   | `API_TOKEN_SALT`               | mesmo comando acima                                                                                                    |
   | `ADMIN_JWT_SECRET`             | mesmo comando acima                                                                                                    |
   | `TRANSFER_TOKEN_SALT`          | mesmo comando acima                                                                                                    |
   | `JWT_SECRET`                   | mesmo comando acima                                                                                                    |
   | `ENCRYPTION_KEY`               | mesmo comando acima                                                                                                    |
   | `DATABASE_*`                   | peça ao time as credenciais do banco                                                                                   |
   | `NODE_ENV`                     | `development` para editar content types, `production` para uso normal                                                  |
   | `SEED_ON_BOOT`                 | `true` importa o seed na primeira subida com banco vazio (ignorado em produção). Ver [docs/seed.md](docs/seed.md)      |
   | `STRAPI_IMPORT_ENCRYPTION_KEY` | chave usada para decriptar o arquivo de seed — peça ao time                                                            |
   | `RAPIDAPI_KEY`                 | chave da RapidAPI (`instagram-looter2`) usada para buscar os posts do Instagram — peça ao time (rotacione se vazar)    |
   | `INSTAGRAM_USER_ID`            | id numérico da conta de Instagram da editora (ex.: `536626219`)                                                        |

## Rodando

```bash
npm run dev
```

O painel admin fica disponível em `http://localhost:1337/admin`.

Para rodar em background e acompanhar os logs:

```bash
npm run dev -- -d
docker compose logs -f
```

Para parar:

```bash
docker compose down
```

Na primeira subida com o banco vazio, os dados iniciais são importados
automaticamente — ver [docs/seed.md](docs/seed.md).

## Modos de operação

| `NODE_ENV`              | Comportamento                                   |
| ----------------------- | ----------------------------------------------- |
| `development` (default) | Permite criar e editar content types pelo admin |
| `production`            | Edição de content types desabilitada            |

O `.env.example` já vem com `NODE_ENV=development`, e o `docker-compose.yml` usa
`development` quando a variável não está definida. Em produção, o
`docker-compose.prod.yml` força `production`.

## Qualidade de código

| Comando                | O que faz                                |
| ---------------------- | ---------------------------------------- |
| `npm run lint`         | Verifica erros de lint (ESLint)          |
| `npm run lint:fix`     | Corrige automaticamente erros de lint    |
| `npm run format`       | Formata o código (Prettier)              |
| `npm run format:check` | Verifica formatação sem alterar arquivos |
| `npm run fix`          | Corrige lint e formatação de uma vez     |

Use `npm run fix` antes de abrir um PR. Em CI, use `npm run lint` e
`npm run format:check` para apenas verificar sem alterar arquivos.

## Documentação

| Documento                                      | Conteúdo                                         |
| ---------------------------------------------- | ------------------------------------------------ |
| [docs/api.md](docs/api.md)                     | Referência das rotas customizadas da content API |
| [docs/content-types.md](docs/content-types.md) | Modelagem de dados: content types e components   |
| [docs/testing.md](docs/testing.md)             | Camadas de teste e convenção de cobertura        |
| [docs/seed.md](docs/seed.md)                   | Popular o banco, gerar export, reimportar        |
| [docs/deploy.md](docs/deploy.md)               | Runbook de deploy de produção                    |
