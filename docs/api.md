# Referência da API

Rotas que o front consome. Duas famílias:

- **Rotas customizadas** — payload curado e enxuto, montadas sobre `book`,
  `author`, `collection` e o single type `instagram`.
- **Rotas core de leitura** — `find`/`findOne` gerados automaticamente pelo
  Strapi para cada content type. Devolvem o shape cru do Strapi e dependem de
  query params. Usadas para listagens (catálogo, navegação) e conteúdo de página.

## Autenticação

Nenhuma rota da content API é **pública**: o papel `Public` não concede acesso a
nada, então uma requisição sem credencial responde `403`.

Todas as rotas abaixo exigem um **API token read-only** no header:

```
Authorization: Bearer <api-token>
```

Cada rota customizada declara `config.auth.scope` como uma action de leitura
(`find`), que a strategy de API token do Strapi libera para tokens read-only. As
rotas core de leitura já exigem por padrão o scope `find`/`findOne`, também
concedido ao token read-only — então **o mesmo token vale para tudo abaixo**.

---

## `GET /api/books/featured`

Seleção curada de até 12 obras publicadas para o destaque da home, combinando as
mais recentes com uma parcela aleatória, embaralhadas antes de retornar.

**Seleção:**

- até 6 obras mais recentes (por `publishing_year` decrescente);
- até 6 obras aleatórias entre as restantes;
- resultado final embaralhado (Fisher-Yates), para a mesma obra não ficar sempre
  no topo.

**Payload por obra:** `{ id, documentId, title, slug, publishing_year, cover }`,
onde `cover` é `{ url }` ou `null`.

```bash
curl http://localhost:1337/api/books/featured \
  -H "Authorization: Bearer <api-token>"
```

---

## `GET /api/books/:slug/related`

Obras relacionadas à obra identificada pela `slug`, ranqueadas por **sobreposição
ponderada** de autor, coleção e gênero.

**Ranqueamento:** cada obra publicada recebe um score comparada à obra base:

```
score = 3·(autores em comum) + 2·(coleções em comum) + 1·(gêneros em comum)
```

Ordena por `score` decrescente, desempatando por `publishing_year` (mais recente
primeiro) e depois `title`. Autor é o sinal mais forte; gênero o mais fraco (uma
obra costuma ter vários gêneros).

**Fallback:** quando há menos obras com coincidência real (`score > 0`) do que o
pedido, a lista é completada com as **mais recentes** (excluindo a base e as já
incluídas), que entram com `score: 0`. A rota devolve sempre a quantidade pedida
— ou menos, apenas se o acervo for pequeno.

**Query params:**

| Param        | Efeito                                                                                                                             |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `?limit=N`   | Quantas obras retornar. Default `5`, limitado a `[1, 10]`. Ausente/inválido/`≤ 0` → `5`; acima do teto → `10`. Nunca retorna erro. |
| `?showScore` | Inclui o campo `score` em cada obra (apenas para depuração; o front não usa).                                                      |

**Comportamento:**

- busca pela `slug` (campo `uid` único), não pelo `documentId`;
- considera somente obras **publicadas**; `404` se a slug base não existir ou for
  apenas rascunho;
- payload padrão por obra: `{ id, documentId, title, slug, publishing_year, cover }`
  (`cover` é `{ url }` ou `null`).

**Resposta:**

```json
{
  "data": [
    {
      "id": 29,
      "documentId": "uv3d1i9gne4004hcfs7kwve4",
      "title": "Assalto ao Céu",
      "slug": "assalto-ao-ceu",
      "publishing_year": 2014,
      "cover": { "url": "/uploads/assalto_ao_ceu.jpg" }
    }
  ]
}
```

---

## `GET /api/book/:slug`

Detalhes de uma obra publicada a partir da sua `slug`.

> O segmento é **singular** (`/book`) de propósito, para não sombrear a rota core
> `GET /api/books/:documentId` gerada pelo router padrão.

**Comportamento:**

- busca pela `slug` (campo `uid` único), não pelo `documentId`;
- retorna somente conteúdo **publicado**; `404` se a slug não existir ou for
  apenas rascunho;
- campos expostos: `title`, `slug`, `description`, `isbn`, `issn`, `format`,
  `page_num`, `publishing_year`, `store_url`;
- relações populadas: `authors`, `collections`, `genres` (cada uma com `name` e
  `slug`), `cover` e `sample` (cada um com `url`).

```bash
curl http://localhost:1337/api/book/assalto-ao-ceu \
  -H "Authorization: Bearer <api-token>"
```

---

## `GET /api/author/:slug`

Detalhes de um autor publicado a partir da sua `slug`, com payload enxuto.

**Comportamento:**

- busca pela `slug` (campo `uid` único), não pelo `documentId`;
- retorna somente conteúdo **publicado**; `404` se a slug não existir ou for
  apenas rascunho;
- campos expostos: `name`, `description` (RichText), `lattes`, `orcid`;
- `books` populado com `title` e `slug` (campos fora desse escopo não são
  expostos).

**Resposta:**

```json
{
  "data": {
    "name": "Machado de Assis",
    "description": [{ "type": "paragraph", "children": [{ "type": "text", "text": "..." }] }],
    "lattes": "http://lattes.cnpq.br/0000000000000000",
    "orcid": "https://orcid.org/0000-0000-0000-0000",
    "books": [{ "title": "Dom Casmurro", "slug": "dom-casmurro" }]
  }
}
```

```bash
curl http://localhost:1337/api/author/machado-de-assis \
  -H "Authorization: Bearer <api-token>"
```

---

## `GET /api/collection/:slug`

Detalhes de uma coleção publicada a partir da sua `slug`.

**Comportamento:**

- busca pela `slug` (campo `uid` único), não pelo `documentId`;
- retorna somente conteúdo **publicado**; `404` se a slug não existir ou for
  apenas rascunho;
- campos expostos: `name`, `description` (RichText);
- `books` populado com `title` e `slug`.

```bash
curl http://localhost:1337/api/collection/classicos \
  -H "Authorization: Bearer <api-token>"
```

---

## `GET /api/instagram`

URLs dos **3 últimos posts** do Instagram da editora, buscados via **RapidAPI**
(`instagram-looter2`) e cacheados por **12h** (`strapi.store`). Fluxo:

1. cache fresco (< 12h) → retorna direto;
2. senão chama a RapidAPI (timeout 5s), mapeia cada `shortcode` para
   `https://www.instagram.com/p/<shortcode>/` e grava no cache;
3. se a API falhar (ex.: cota `429`), cai nos posts inseridos **manualmente** no
   dashboard (single type `instagram`);
4. sem cache, sem API e sem entry manual → **404**.

Requer as env vars `RAPIDAPI_KEY` e `INSTAGRAM_USER_ID`.

**Resposta:**

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

```bash
curl http://localhost:1337/api/instagram \
  -H "Authorization: Bearer <api-token>"
```

---

# Rotas core de lista

Listagens geradas pelo Strapi (`find`). Ao contrário das rotas customizadas, o
payload **não vem curado**: por padrão retorna só os campos escalares, **sem
relações nem mídia** — é preciso pedi-las com `?populate`. Aceitam os
[query params do Strapi](https://docs.strapi.io/dev-docs/api/rest/parameters)
(`fields`, `populate`, `filters`, `sort`, `pagination`).

> Os params abaixo são **exemplos deduzidos do schema** (o que o front precisa
> popular/filtrar), não um contrato fixo — ajuste conforme cada tela.

## `GET /api/books`

Catálogo de obras. A capa (`cover`) e as relações não vêm por padrão; popule o
que a listagem exibir.

**Query params úteis:**

| Param                                          | Efeito                                |
| ---------------------------------------------- | ------------------------------------- |
| `?fields=title,slug,publishing_year`           | Enxuga os campos escalares retornados |
| `?populate[cover][fields][0]=url`              | Inclui a URL da capa                  |
| `?sort=publishing_year:desc`                   | Ordena (ex.: mais recentes primeiro)  |
| `?pagination[page]=1&pagination[pageSize]=24`  | Paginação                             |
| `?filters[genres][slug][$eq]=<genre-slug>`     | Filtra por gênero                     |
| `?filters[collections][slug][$eq]=<coll-slug>` | Filtra por coleção                    |
| `?filters[title][$containsi]=<termo>`          | Busca por título (case-insensitive)   |

```bash
curl "http://localhost:1337/api/books?fields=title,slug,publishing_year&populate[cover][fields][0]=url&sort=publishing_year:desc&pagination[pageSize]=24" \
  -H "Authorization: Bearer <api-token>"
```

Retorna somente obras **publicadas**, e o objeto `meta.pagination` com o total de
páginas.

## `GET /api/collections`

Índice de coleções.

```bash
curl "http://localhost:1337/api/collections?fields=name,slug" \
  -H "Authorization: Bearer <api-token>"
```

Para trazer as obras de cada coleção: `?populate[books][fields][0]=title&populate[books][fields][1]=slug`.

## `GET /api/genres`

Lista de gêneros (para filtro do catálogo). `genre` **não** usa draft & publish —
todos os registros são retornados.

```bash
curl "http://localhost:1337/api/genres?fields=name,slug" \
  -H "Authorization: Bearer <api-token>"
```

## `GET /api/authors`

Lista de autores.

```bash
curl "http://localhost:1337/api/authors?fields=name,slug" \
  -H "Authorization: Bearer <api-token>"
```

---

# Single types de conteúdo

Páginas cujo conteúdo é editável no admin. Cada uma é um single type, servido pela
rota `find` core (a mesma família das listas: token read-only, aceita `populate`).

## `GET /api/footer`

Dados do rodapé: `phone`, `email`, `organization`, `copyright` e o componente
`address`. O componente `address` não vem por padrão — popule-o:

```bash
curl "http://localhost:1337/api/footer?populate=address" \
  -H "Authorization: Bearer <api-token>"
```

**Resposta:**

```json
{
  "data": {
    "phone": "(11) 0000-0000",
    "email": "contato@comarte.eca.usp.br",
    "organization": "Com Arte",
    "copyright": "© Com Arte",
    "address": {
      "street": "Av. Prof. Lúcio Martins Rodrigues",
      "district": "Butantã",
      "cep": "05508-020",
      "city": "São Paulo",
      "state": "SP",
      "country": "Brasil"
    }
  }
}
```

## `GET /api/about-us`

Conteúdo da página **Quem somos**: um campo `content` em blocks.

```bash
curl http://localhost:1337/api/about-us \
  -H "Authorization: Bearer <api-token>"
```

## `GET /api/book-submission`

Conteúdo da página **Publique** (seleção de originais): um campo `content` em
blocks.

```bash
curl http://localhost:1337/api/book-submission \
  -H "Authorization: Bearer <api-token>"
```
