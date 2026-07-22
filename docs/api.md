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

**Resposta** (12 itens; um só mostrado):

```json
{
  "data": [
    {
      "id": 235,
      "documentId": "kssqw8yqweiwxcdddxh6mbyt",
      "title": "Rastros",
      "slug": "rastros",
      "publishing_year": 2019,
      "cover": { "url": "/uploads/Rastros_b3e834505b.webp" }
    }
  ]
}
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
      "id": 95,
      "documentId": "etg9plblr9ro0bhsdgq3h5v8",
      "title": "Desavessos",
      "slug": "desavessos",
      "publishing_year": 2014,
      "cover": { "url": "/uploads/Desavessos_9061f4c3e6.webp" }
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
curl http://localhost:1337/api/book/heleny-guariba-destinos-sequestrados \
  -H "Authorization: Bearer <api-token>"
```

**Resposta:**

```json
{
  "data": {
    "id": 156,
    "documentId": "a4mo3cilx235e4pk30rf8opb",
    "title": "Heleny Guariba: Destinos Sequestrados",
    "slug": "heleny-guariba-destinos-sequestrados",
    "description": [{ "type": "paragraph", "children": [{ "type": "text", "text": "..." }] }],
    "isbn": "978-65-89321-20-0",
    "issn": null,
    "format": "13 x 22 cm",
    "page_num": 272,
    "publishing_year": 2025,
    "store_url": "https://www.edusp.com.br/loja/produto/1848/heleny-guariba--destinos-sequestrados",
    "authors": [
      {
        "id": 132,
        "documentId": "d6ur3qctuh60hk7akqli6v1c",
        "name": "José Armando Pereira Silva",
        "slug": "jose-armando-pereira-silva"
      }
    ],
    "collections": [
      {
        "id": 14,
        "documentId": "gex7eadkfdhifs3siy6maov0",
        "name": "Memória Militante",
        "slug": "memoria-militante"
      }
    ],
    "genres": [
      {
        "id": 2,
        "documentId": "fjwvnkgeukoo8xrk1rfdoke4",
        "name": "Comunicação",
        "slug": "comunicacao"
      }
    ],
    "cover": {
      "id": 98,
      "documentId": "xn8m8j71oepcjjwru3y7gno6",
      "url": "/uploads/Memoria_Militante_Heleny_Guariba_Destinos_Sequestrados_d04283c3a3.webp"
    },
    "sample": {
      "id": 99,
      "documentId": "onl7ko74pqix8dhuacsq1moh",
      "url": "/uploads/978_65_89321_20_0_Heleny_Guariba_98caa03737.pdf"
    }
  }
}
```

Nem toda obra tem as três relações: `collections` costuma vir `[]`. Relação
vazia vem como `[]`, campo escalar não preenchido e mídia ausente vêm como
`null`.

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
    "id": 52,
    "documentId": "h8hm7ugms8ax55zduy3v8a9f",
    "name": "Machado de Assis",
    "description": [{ "type": "paragraph", "children": [{ "type": "text", "text": "..." }] }],
    "lattes": "http://lattes.cnpq.br/0000000000000000",
    "orcid": "https://orcid.org/0000-0000-0000-0000",
    "books": [
      {
        "id": 190,
        "documentId": "zrjy8mur6wevqopbz3id9bfx",
        "title": "Dom Casmurro",
        "slug": "dom-casmurro"
      }
    ]
  }
}
```

`id` e `documentId` acompanham toda entidade retornada pelo Strapi (inclusive
dentro das relações), mesmo quando a rota restringe os campos.

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
curl http://localhost:1337/api/collection/primeira-impressao \
  -H "Authorization: Bearer <api-token>"
```

**Resposta:**

```json
{
  "data": {
    "id": 13,
    "documentId": "lyzotp1rkcwv0h66xf6fso8s",
    "name": "Primeira Impressão",
    "description": [{ "type": "paragraph", "children": [{ "type": "text", "text": "..." }] }],
    "books": [
      {
        "id": 60,
        "documentId": "aoxmg6wafcl7osc2dnstkm5g",
        "title": "Av. Marginal",
        "slug": "av-marginal"
      }
    ]
  }
}
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

| Param                                          | Efeito                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `?fields=title,slug,publishing_year`           | Enxuga os campos escalares retornados (`id` e `documentId` vêm sempre) |
| `?populate[cover][fields][0]=url`              | Inclui a URL da capa                                                   |
| `?sort=publishing_year:desc`                   | Ordena (ex.: mais recentes primeiro)                                   |
| `?pagination[page]=1&pagination[pageSize]=24`  | Paginação                                                              |
| `?filters[genres][slug][$eq]=<genre-slug>`     | Filtra por gênero                                                      |
| `?filters[collections][slug][$eq]=<coll-slug>` | Filtra por coleção                                                     |
| `?filters[title][$containsi]=<termo>`          | Busca por título (case-insensitive)                                    |

```bash
curl "http://localhost:1337/api/books?fields=title,slug,publishing_year&populate[cover][fields][0]=url&sort=publishing_year:desc&pagination[pageSize]=24" \
  -H "Authorization: Bearer <api-token>"
```

Retorna somente obras **publicadas**, e o objeto `meta.pagination` com o total de
páginas.

`fields` e `populate[…][fields]` restringem só os campos de conteúdo: cada
entidade — inclusive a mídia populada — continua vindo com `id` e `documentId`.
No exemplo acima, `cover` sai como `{ id, documentId, url }`.

**Resposta** (um item da página mostrado):

```json
{
  "data": [
    {
      "id": 58,
      "documentId": "e5c6gxsm8l4m9srcaqqg2led",
      "title": "Audiolivros e Edição",
      "slug": "audiolivros-e-edicao",
      "publishing_year": null,
      "cover": {
        "id": 44,
        "documentId": "sjgk29rj937ea855v5by0msm",
        "url": "/uploads/00_Imagem_nao_disponivel_e989d2b8e4.webp"
      }
    }
  ],
  "meta": {
    "pagination": { "page": 1, "pageSize": 24, "pageCount": 6, "total": 137 }
  }
}
```

## `GET /api/collections`

Índice de coleções.

```bash
curl "http://localhost:1337/api/collections?fields=name,slug" \
  -H "Authorization: Bearer <api-token>"
```

**Resposta** (um item mostrado):

```json
{
  "data": [
    {
      "id": 13,
      "documentId": "lyzotp1rkcwv0h66xf6fso8s",
      "name": "Primeira Impressão",
      "slug": "primeira-impressao"
    }
  ],
  "meta": {
    "pagination": { "page": 1, "pageSize": 25, "pageCount": 1, "total": 10 }
  }
}
```

Para trazer as obras de cada coleção: `?populate[books][fields][0]=title&populate[books][fields][1]=slug`.

## `GET /api/genres`

Lista de gêneros (para filtro do catálogo). `genre` **não** usa draft & publish —
todos os registros são retornados.

```bash
curl "http://localhost:1337/api/genres?fields=name,slug" \
  -H "Authorization: Bearer <api-token>"
```

**Resposta** (um item mostrado):

```json
{
  "data": [
    {
      "id": 13,
      "documentId": "iodnv5evtg4wgnlg3fn3asxp",
      "name": "Poesia",
      "slug": "poesia"
    }
  ],
  "meta": {
    "pagination": { "page": 1, "pageSize": 25, "pageCount": 1, "total": 18 }
  }
}
```

## `GET /api/authors`

Lista de autores.

```bash
curl "http://localhost:1337/api/authors?fields=name,slug" \
  -H "Authorization: Bearer <api-token>"
```

**Resposta** (um item da página mostrado):

```json
{
  "data": [
    {
      "id": 35,
      "documentId": "t0gz3obnu5vhnbklg13ltapz",
      "name": "Atílio Avancini",
      "slug": "atilio-avancini"
    }
  ],
  "meta": {
    "pagination": { "page": 1, "pageSize": 25, "pageCount": 6, "total": 136 }
  }
}
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
    "id": 2,
    "documentId": "ckad59crsjtw2f02lk65m5hq",
    "phone": "(11) 0000-0000",
    "email": "contato@comarte.eca.usp.br",
    "organization": "Com Arte",
    "copyright": "© Com Arte",
    "createdAt": "2026-07-19T20:29:56.153Z",
    "updatedAt": "2026-07-19T20:29:56.153Z",
    "publishedAt": "2026-07-19T20:29:56.165Z",
    "address": {
      "id": 2,
      "street": "Av. Prof. Lúcio Martins Rodrigues, 443",
      "complement1": "Prédio 2",
      "complement2": "Sala 10",
      "district": "Cidade Universitária",
      "cep": "05508-020",
      "city": "São Paulo",
      "state": "SP",
      "country": "Brasil"
    }
  }
}
```

Por ser rota core, o payload vem cru: além dos campos editáveis vêm `id`,
`documentId` e os timestamps (`createdAt`, `updatedAt`, `publishedAt`), mais um
`meta: {}` ao lado de `data`. Use `?fields=` para enxugar.

## `GET /api/about-us`

Conteúdo da página **Quem somos**: um campo `content` em blocks.

```bash
curl http://localhost:1337/api/about-us \
  -H "Authorization: Bearer <api-token>"
```

**Resposta:**

```json
{
  "data": {
    "id": 2,
    "documentId": "cs949gxdx7adsewgqnoqi0cn",
    "content": [
      {
        "type": "heading",
        "level": 1,
        "children": [{ "type": "text", "text": "Quem somos" }]
      },
      { "type": "paragraph", "children": [{ "type": "text", "text": "..." }] }
    ],
    "createdAt": "2026-07-19T20:29:56.153Z",
    "updatedAt": "2026-07-19T20:29:56.153Z",
    "publishedAt": "2026-07-19T20:29:56.165Z"
  },
  "meta": {}
}
```

## `GET /api/book-submission`

Conteúdo da página **Publique** (seleção de originais): um campo `content` em
blocks.

```bash
curl http://localhost:1337/api/book-submission \
  -H "Authorization: Bearer <api-token>"
```

**Resposta:**

```json
{
  "data": {
    "id": 2,
    "documentId": "yfashi7zn17alw9jay8ptj1n",
    "content": [
      {
        "type": "heading",
        "level": 1,
        "children": [{ "type": "text", "text": "Seleção de Originais" }]
      },
      { "type": "paragraph", "children": [{ "type": "text", "text": "..." }] }
    ],
    "createdAt": "2026-07-19T20:29:56.153Z",
    "updatedAt": "2026-07-19T20:29:56.153Z",
    "publishedAt": "2026-07-19T20:29:56.165Z"
  },
  "meta": {}
}
```
