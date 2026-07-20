# Content types

Modelagem de dados do backend. Cada content type gera controllers/services/routes
padrão do Strapi; as rotas customizadas de leitura estão em [api.md](api.md).

## Collection types

### `book` — Obras

Entidade central do acervo. Rota base `/api/books`.

| Campo             | Tipo                 | Observações                                  |
| ----------------- | -------------------- | -------------------------------------------- |
| `title`           | string (obrigatório) | Título da obra                               |
| `slug`            | uid (obrigatório)    | Identificador único usado nas rotas por slug |
| `description`     | blocks               | Descrição em rich blocks                     |
| `format`          | string               |                                              |
| `isbn`            | string (único)       |                                              |
| `issn`            | string (único)       |                                              |
| `page_num`        | integer              | Número de páginas                            |
| `publishing_year` | integer              | Ano de publicação                            |
| `store_url`       | string               | Link para compra                             |
| `cover`           | media (obrigatório)  | Capa (imagem/arquivo, único)                 |
| `sample`          | media                | Amostra/trecho (arquivo, único)              |
| `authors`         | relation manyToMany  | → `author`                                   |
| `collections`     | relation manyToMany  | → `collection`                               |
| `genres`          | relation manyToMany  | → `genre`                                    |

Draft & publish: **ativado**.

### `author` — Autoria

Rota base `/api/authors`.

| Campo         | Tipo                 | Observações                               |
| ------------- | -------------------- | ----------------------------------------- |
| `name`        | string (obrigatório) |                                           |
| `slug`        | uid (obrigatório)    | Gerado a partir de `name`                 |
| `lattes`      | string               | URL do Lattes, validada por regex do CNPq |
| `orcid`       | string               | URL do ORCID, validada por regex          |
| `description` | richtext             |                                           |
| `books`       | relation manyToMany  | → `book`                                  |

Draft & publish: **ativado**.

### `collection` — Coleções

Rota base `/api/collections`.

| Campo         | Tipo                 | Observações               |
| ------------- | -------------------- | ------------------------- |
| `name`        | string (obrigatório) |                           |
| `slug`        | uid (obrigatório)    | Gerado a partir de `name` |
| `description` | richtext             |                           |
| `books`       | relation manyToMany  | → `book`                  |

Draft & publish: **ativado**.

### `genre` — Gêneros

Rota base `/api/genres`.

| Campo   | Tipo                        | Observações |
| ------- | --------------------------- | ----------- |
| `name`  | string (obrigatório, único) |             |
| `slug`  | uid (obrigatório)           |             |
| `books` | relation manyToMany         | → `book`    |

Draft & publish: **desativado** (gêneros são publicados diretamente).

## Single types

### `instagram` — Instagram

Rota base `/api/instagram` (ver a rota customizada em [api.md](api.md)).

Guarda um campo `posts` repetível com **exatamente 3 itens** do componente
`midia.url`. Serve de **fallback manual** — a rota prioriza os posts buscados via
RapidAPI. Draft & publish: **ativado**.

### `footer` — Rodapé

| Campo          | Tipo                        |
| -------------- | --------------------------- |
| `phone`        | string                      |
| `email`        | email                       |
| `organization` | string                      |
| `copyright`    | string                      |
| `address`      | component `address.address` |

### `about-us` — Quem somos

| Campo     | Tipo   |
| --------- | ------ |
| `content` | blocks |

### `book-submission` — Publique (Seleção de originais)

| Campo     | Tipo   |
| --------- | ------ |
| `content` | blocks |

## Components

### `midia.url`

| Campo   | Tipo                        |
| ------- | --------------------------- |
| `url`   | string (obrigatório, único) |
| `label` | string                      |

Usado por `instagram.posts`.

### `address.address`

Endereço estruturado: `street`, `district`, `complement1`, `complement2`, `cep`,
`city`, `state`, `country` (todos string). Usado por `footer.address`.
