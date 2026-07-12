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
| `STRAPI_IMPORT_ENCRYPTION_KEY` | chave usada para decriptar o arquivo de seed — peça ao time                                                            |
| `RAPIDAPI_KEY`                 | chave da RapidAPI (`instagram-looter2`) usada para buscar os posts do Instagram — peça ao time (rotacione se vazar)    |
| `INSTAGRAM_USER_ID`            | id numérico da conta de Instagram da editora (ex.: `536626219`)                                                        |

## Rodando

```bash
npm run dev
```

O painel admin estará disponível em `http://localhost:1337/admin`.

Para rodar em background:

```bash
npm run dev -- -d
docker compose logs -f   # acompanhar logs
```

Para parar:

```bash
docker compose down
```

## Modos de operação

| `NODE_ENV`            | Comportamento                                   |
| --------------------- | ----------------------------------------------- |
| `production` (padrão) | Edição de content types desabilitada            |
| `development`         | Permite criar e editar content types pelo admin |

## Content types

| Tipo                      | Rota base        |
| ------------------------- | ---------------- |
| `colecao`                 | `/api/colecaos`  |
| `genero`                  | `/api/generos`   |
| `obra`                    | `/api/obras`     |
| `instagram` (single type) | `/api/instagram` |

O single type `instagram` guarda um campo `posts` repetível com **exatamente 3 itens** do componente `midia.url` (`url` obrigatório e único, `label` opcional). Esses posts servem de **fallback manual** — a rota `GET /api/instagram` prioriza os posts buscados via RapidAPI (ver [Rotas customizadas](#rotas-customizadas)).

## Rotas customizadas

Além das rotas CRUD geradas automaticamente pelo Strapi, existem rotas customizadas adicionadas sobre os content types existentes.

### `GET /api/obras/featured`

Retorna uma seleção curada de até 12 obras publicadas para exibição em destaque, combinando as mais recentes (por `anoDePublicacao`) com uma parcela aleatória, embaralhadas antes de retornar.

**Seleção:**

- até 6 obras mais recentes (ordenadas por `anoDePublicacao` decrescente)
- até 6 obras aleatórias entre as restantes
- resultado final embaralhado (Fisher-Yates), para que a mesma obra não fique sempre no topo

**Exemplo:**

```bash
curl http://localhost:1337/api/obras/featured
```

### `GET /api/obras/:slug/related`

Retorna obras relacionadas à obra identificada pela `slug`, ranqueadas por **sobreposição ponderada** de autor, coleção e gênero.

**Ranqueamento:** cada obra publicada recebe um score comparada à obra base:

```
score = 3·(autores em comum) + 2·(coleções em comum) + 1·(gêneros em comum)
```

Ordena por `score` decrescente, desempatando por `anoDePublicacao` (mais recente primeiro) e depois `titulo`. Autor é o sinal mais forte; gênero o mais fraco (uma obra costuma ter vários gêneros).

**Fallback:** quando há menos obras com coincidência real (`score > 0`) do que o pedido, a lista é completada com as **mais recentes** (excluindo a base e as já incluídas), que entram com `score: 0`. Assim a rota devolve sempre a quantidade pedida — ou menos, apenas se o acervo for pequeno.

**Query params:**

| Param        | Efeito                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `?limit=N`   | Quantas obras retornar. Default `5`, limitado a `[1, 10]`. Valor ausente/inválido/`≤ 0` → `5`; acima do teto → `10`. Nunca retorna erro. |
| `?showScore` | Inclui o campo `score` em cada obra (apenas para depuração; o front não usa).                                                            |

**Comportamento:**

- busca pela `slug` (campo `uid` único), não pelo `documentId`
- considera somente obras **publicadas**; `404` se a slug base não existir ou for apenas rascunho
- payload padrão por obra: `{ id, documentId, titulo, slug, anoDePublicacao }`

**Resposta:**

```json
{
  "data": [
    {
      "id": 29,
      "documentId": "uv3d1i9gne4004hcfs7kwve4",
      "titulo": "Assalto ao Céu",
      "slug": "assalto-ao-ceu",
      "anoDePublicacao": 2014
    }
  ]
}
```

### `GET /api/author/:slug`

Retorna os detalhes de um autor publicado a partir da sua `slug`, com um payload enxuto: apenas `nome`, `descricao` (RichText) e a lista de obras do autor com `titulo` e `slug`.

**Autenticação:** rota **não pública** — exige um API token no header `Authorization: Bearer <token>`. Um token **read-only** já basta (o mesmo token usado nos demais endpoints de leitura): a rota declara `config.auth.scope` como uma action de leitura (`api::autor.autor.find`), que a strategy de api-token do Strapi libera para tokens read-only. Como nenhum acesso público é concedido ao role Public, a rota não é pública e requisições sem token recebem `403`.

**Comportamento:**

- busca pela `slug` (campo `uid` único), não pelo `documentId`
- retorna somente conteúdo **publicado**; `404` se a slug não existir ou for apenas rascunho
- as obras vêm populadas com `titulo` e `slug` (campos fora desse escopo não são expostos)

**Resposta:**

```json
{
  "data": {
    "nome": "Machado de Assis",
    "descricao": [{ "type": "paragraph", "children": [{ "type": "text", "text": "..." }] }],
    "obras": [{ "titulo": "Dom Casmurro", "slug": "dom-casmurro" }]
  }
}
```

**Exemplo:**

```bash
curl http://localhost:1337/api/author/machado-de-assis \
  -H "Authorization: Bearer <api-token>"
```

### `GET /api/instagram`

Retorna as URLs dos **3 últimos posts** do Instagram da editora, buscados via **RapidAPI** (`instagram-looter2`) e cacheados por **12h** (`strapi.store`). Fluxo:

1. cache fresco (< 12h) → retorna direto;
2. senão chama a RapidAPI (timeout 5s), mapeia cada `shortcode` para `https://www.instagram.com/p/<shortcode>/` e grava no cache;
3. se a API falhar (ex.: cota `429`), cai nos posts inseridos **manualmente** no dashboard;
4. sem cache, sem API e sem entry manual → **404**.

Requer as env vars `RAPIDAPI_KEY` e `INSTAGRAM_USER_ID`. A rota **não é pública** — exige um API token no header `Authorization: Bearer <token>` (um token **read-only** já basta).

**Exemplo:**

```bash
curl http://localhost:1337/api/instagram \
  -H "Authorization: Bearer <api-token>"
```

```json
{
  "data": {
    "posts": [
      { "url": "https://www.instagram.com/p/DaXsVGOlVks/" },
      { "url": "https://www.instagram.com/p/DaFqrZTie6c/" },
      { "url": "https://www.instagram.com/p/DZzpMt3hSob/" }
    ]
  }
}
```

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
npm run dev
```

O import roda automaticamente antes do Strapi iniciar. Nas próximas subidas ele é ignorado.

Para reimportar (ex: novo arquivo de seed), remova o marcador e reinicie:

```bash
docker compose exec strapi rm /app/.seeded
docker compose restart strapi
```

## Gerando um novo export do Strapi

Para criar um novo arquivo de backup/seed (substitui o export atual), execute com o container em execução:

1. Descubra o ID do container Strapi:

```bash
docker ps
```

2. Execute o export, substituindo `<STRAPI_IMPORT_ENCRYPTION_KEY>` e `<container-id>` pelo ID encontrado:

```bash
docker exec <container-id> npm run strapi export -- --file seed/strapi-export --key <STRAPI_IMPORT_ENCRYPTION_KEY>
```

O arquivo gerado ficará em `seed/strapi-export.tar.gz.enc`, substituindo o export anterior.

## Qualidade de código

| Comando                | O que faz                                |
| ---------------------- | ---------------------------------------- |
| `npm run lint`         | Verifica erros de lint (ESLint)          |
| `npm run lint:fix`     | Corrige automaticamente erros de lint    |
| `npm run format`       | Formata o código (Prettier)              |
| `npm run format:check` | Verifica formatação sem alterar arquivos |
| `npm run fix`          | Corrige lint e formatação de uma vez     |

Use `npm run fix` antes de abrir um PR para garantir que o código está limpo. Em CI, use `npm run lint` e `npm run format:check` para apenas verificar sem alterar arquivos.

## Testes

A suíte de testes tem duas camadas:

- **Testes unitários** (`tests/unit/`) — validações puras que não dependem do Strapi (ex: regex de ISBN/ISSN do schema da `obra`). Rodam em milissegundos, sem subir nada.
- **Testes de integração** (`tests/integration/`) — sobem uma instância do Strapi com banco SQLite descartável e exercitam os endpoints REST gerados (CRUD, validações, relações `manyToMany`, draft/publish). Cada arquivo cobre um content type.

| Comando                    | O que faz                                                 |
| -------------------------- | --------------------------------------------------------- |
| `npm test`                 | Roda toda a suíte (unit + integration)                    |
| `npm run test:unit`        | Só os testes unitários (rápido, sem boot do Strapi)       |
| `npm run test:integration` | Só os testes de integração (sobe Strapi com SQLite local) |
| `npm run test:watch`       | Modo watch para desenvolvimento                           |
| `npm run test:coverage`    | Roda com relatório de cobertura                           |

Os testes de integração usam um SQLite em `.tmp/test.db` (descartado a cada run) — não precisam do Postgres rodando.

## Dados persistidos

O banco de dados é mantido no volume Docker `postgres_data` entre restarts. Para resetar completamente:

```bash
docker compose down -v
```
