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

O single type `instagram` expõe um campo `Postagem` repetível com **exatamente 3 itens** do componente `midia.url` (`url` obrigatório e único, `rotulo` opcional).

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

### `GET /api/author/:slug`

Retorna os detalhes de um autor publicado a partir da sua `slug`, com um payload enxuto: apenas `nome`, `descricao` (RichText) e a lista de obras do autor com `titulo` e `slug`.

**Autenticação:** rota **não pública** — exige um API token no header `Authorization: Bearer <token>`. A rota é protegida pelo seu próprio scope (`findOneBySlug`), que o role Public nunca possui, então ela permanece privada mesmo quando o catálogo de autores é público. Requisições sem token recebem `403`.

Um token **read-only não funciona** aqui: a strategy de api-token do Strapi só libera read-only para scopes terminando em `find`/`findOne`. Use um token **full-access** ou um token **custom** de menor privilégio com as permissões:

- `api::autor.autor.findOneBySlug` — a rota em si;
- `api::obra.obra.find` / `api::obra.obra.findOne` — para as obras aparecerem populadas na resposta (o `sanitizeOutput` remove a relação se o token não puder ler obra).

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
