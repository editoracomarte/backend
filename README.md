# Com Arte — Backend

API backend do projeto Com Arte, construída com [Strapi 5](https://strapi.io/) e PostgreSQL.

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e Docker Compose

## Configuração

1. Copie o arquivo de exemplo e preencha as variáveis:

```bash
cp .env.example .env
```

2. Preencha o `.env`:

| Variável | Como obter |
|---|---|
| `APP_KEYS` | Gere dois valores separados por vírgula: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `API_TOKEN_SALT` | mesmo comando acima |
| `ADMIN_JWT_SECRET` | mesmo comando acima |
| `TRANSFER_TOKEN_SALT` | mesmo comando acima |
| `JWT_SECRET` | mesmo comando acima |
| `ENCRYPTION_KEY` | mesmo comando acima |
| `DATABASE_*` | peça ao time as credenciais do banco |
| `NODE_ENV` | `development` para editar content types, `production` para uso normal |
| `STRAPI_IMPORT_ENCRYPTION_KEY` | chave usada para decriptar o arquivo de seed — peça ao time |

## Rodando

```bash
docker compose up
```

O painel admin estará disponível em `http://localhost:1337/admin`.

Para rodar em background:

```bash
docker compose up -d
docker compose logs -f   # acompanhar logs
```

Para parar:

```bash
docker compose down
```

## Modos de operação

| `NODE_ENV` | Comportamento |
|---|---|
| `production` (padrão) | Edição de content types desabilitada |
| `development` | Permite criar e editar content types pelo admin |

## Content types

| Tipo | Rota base |
|---|---|
| `colecao` | `/api/colecaos` |
| `genero` | `/api/generos` |
| `obra` | `/api/obras` |

## Populando o banco com dados iniciais

O backend importa automaticamente os dados na primeira vez que sobe, caso o arquivo de seed esteja presente em `seed/`.

1. Coloque o arquivo `.tar.gz.enc` dentro da pasta `seed/`:

```
seed/
└── strapi-export.tar.gz.enc
```

2. Certifique-se que `STRAPI_IMPORT_ENCRYPTION_KEY` está preenchida no `.env`.

3. Suba normalmente:

```bash
docker compose up
```

O import roda automaticamente antes do Strapi iniciar. Nas próximas subidas ele é ignorado.

Para reimportar (ex: novo arquivo de seed), remova o marcador e reinicie:

```bash
docker compose exec strapi rm /app/.seeded
docker compose restart strapi
```

## Dados persistidos

O banco de dados é mantido no volume Docker `postgres_data` entre restarts. Para resetar completamente:

```bash
docker compose down -v
```
