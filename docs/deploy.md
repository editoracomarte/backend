# Deploy de produção

Runbook para publicar o backend (Strapi) e o SPA (React + Vite) numa VM da USP,
sob o domínio `comarte.eca.usp.br`.

## O ambiente

- **Existe um nginx institucional da ECA na frente, e não é nosso.** Ele termina
  o TLS, força HTTPS (301 + HSTS de 2 anos) e repassa o domínio inteiro para a
  VM em `10.2.0.156:80`. Não controlamos esse proxy nem o certificado.
- **Só temos um nome de DNS.** Não há `api.comarte.eca.usp.br`. O roteamento
  entre SPA e Strapi é por **path**, feito por um proxy nginx **nosso**, dentro
  do compose, escutando na porta que a ECA aponta (`EDGE_PORT`, default 80).
- **Dois deployables:** o Strapi (que serve `/admin` e a content API, com o
  painel React já compilado dentro da própria imagem) e o `dist/` estático do
  SPA. O `dist/` do frontend **não é escopo deste repo** — é montado pronto no
  container `proxy` via `FRONTEND_DIST`.

```
Internet
  └── nginx da ECA  (TLS, comarte.eca.usp.br)        ← não controlamos
       └── VM:${EDGE_PORT}
            └── proxy interno (container nginx)       ← controlamos
                 ├── /api, /uploads, /admin, /content-manager, …  → strapi:1337
                 └── qualquer outra coisa             → SPA estático (try_files → index.html)
```

O painel fica **público** em `comarte.eca.usp.br/admin`, para a equipe editorial
entrar de qualquer lugar com e-mail e senha.

---

> ℹ️ **Onde os dados realmente moram** (checado — está tudo certo, mas entenda antes de mexer)
>
> Clonar em `/mnt/data` **não** é o que faz os dados irem para `/mnt/data`. O
> repositório contém só código, `docker-compose.prod.yml` e `.env`. Os dados de
> verdade — o banco (`postgres_data`), as capas (`uploads`) e as imagens e
> camadas do Docker — vivem onde o **daemon** guarda suas coisas, o `data-root`.
>
> Na VM isso **já está configurado**: `Docker Root Dir: /mnt/data/docker`. A
> infra fez isso antes de entregar a máquina.
>
> Consequência prática: **não mexa no `data-root` depois que a stack subir.**
> Trocá-lo com volumes já criados faz o Docker olhar para um diretório novo e os
> volumes antigos "sumirem" da vista (continuam no disco, invisíveis).

---

## Passos

### 1. Porta 80 livre

A ECA entrega em `10.2.0.156:80`, e é onde o container `proxy` vai subir.
Garanta que nada mais ocupa a porta:

```sh
sudo ss -ltnp | grep :80
```

**Esperado:** nenhuma saída (porta livre).

### 2. Docker instalado e repo clonado

Instale o Docker na VM e clone o repo em **`/mnt/data/comarte`** (caminho
definido pela infra — não é convenção nossa).

### 2b. Confirmar que o Docker grava na partição de dados

Verificação, não ação — a VM já vem assim:

```sh
docker info | grep "Docker Root Dir"
```

**Esperado:** `/mnt/data/docker`.

Se disser `/var/lib/docker`, **pare aqui**: crie `/etc/docker/daemon.json` com
`{ "data-root": "/mnt/data/docker" }`, `sudo systemctl restart docker`, e
confirme de novo — **antes** do primeiro `up`. Com volumes já criados, trocar o
`data-root` não os move; ele passa a olhar para outro lugar e os volumes antigos
somem da vista.

### 3. Criar o `.env`

A partir do **[.env.production.example](../.env.production.example)**, com secrets
**novos gerados na VM** — nunca reaproveitar os de dev:

```sh
openssl rand -base64 32   # rode para cada secret
```

> ⚠️ **Uma única exceção:** o `STRAPI_IMPORT_ENCRYPTION_KEY` **não** pode ser
> gerado novo. Ele precisa ser exatamente a chave que cifrou o
> `seed/strapi-export.tar.gz.enc`, senão o import do passo 8 falha ao decifrar.

O `.env.production.example` já traz `COMPOSE_FILE=docker-compose.prod.yml`, então
todos os `docker compose` abaixo usam o arquivo de produção sem precisar de `-f`.

### 4. Garantir que o `dist/` do frontend existe

O build do SPA **não é escopo deste repo** — só é pré-requisito. Confirme que o
`index.html` está no caminho apontado por `FRONTEND_DIST`:

```sh
ls "$FRONTEND_DIST/index.html"
```

**Esperado:** o arquivo existe.

> Se o caminho não existir, o Docker **cria um diretório vazio** no bind-mount em
> vez de falhar, e o nginx passa a servir 404 em tudo. Falha confusa: parece bug
> do proxy, é ausência do artefato.

### 5. Subir a stack

```sh
export NPM_REGISTRY_IP=$(getent ahostsv4 registry.npmjs.org | head -1 | awk '{print $1}')
docker compose up -d --build
```

Sobe com banco vazio. O `COMPOSE_FILE` do `.env` já aponta para o arquivo de
produção.

> ⚠️ **Por que o `export NPM_REGISTRY_IP`.** O IPv6 da VM é um buraco negro: o
> `npm ci` dentro do build tenta os endereços IPv6 do registro, cada conexão
> expira, e a imagem sai com o `node_modules` **vazio** — o build "termina" mas o
> container falha com `sh: strapi: not found`. O `docker-compose.prod.yml` passa
> esse IP para o `build.extra_hosts`, fixando o registro em IPv4 só durante o
> build (o `--add-host` é a única forma que funciona: o BuildKit monta o
> `/etc/hosts` como read-only, então não dá para editá-lo no Dockerfile).
> Resolvemos o IPv4 na hora porque a Cloudflare rotaciona os endereços. Se pular
> este `export`, cai no IP de fallback do compose — que costuma funcionar (edges
> anycast da Cloudflare), mas o `export` é o caminho garantido.
>
> O mesmo IPv6 quebrado afeta o **runtime** (o Strapi chamando a RapidAPI do
> Instagram): por isso o serviço `strapi` desliga o IPv6 dentro do container, via
> `net.ipv6.conf.all.disable_ipv6=1` na chave `sysctls` do compose.

### 6. Verificar a trava do `register-admin` — ANTES de qualquer outra coisa

```sh
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://comarte.eca.usp.br/admin/register-admin
```

**Esperado:** `404`.

> A partir do passo 5 o site **já está público**, com o banco vazio e **zero
> admins** — a janela de sequestro do super admin fica aberta até o passo 9. O
> que a fecha é **uma única linha** do [docker/nginx.conf](../docker/nginx.conf)
> (`location = /admin/register-admin { return 404; }`). Se vier `200` ou `400`
> em vez de `404`, **pare o deploy**.

### 7. Conferir a lista de prefixos do proxy contra a realidade

```sh
docker compose exec strapi npx strapi routes:list
```

Todo prefixo de raiz que aparecer ali precisa estar no `location ~ ^/(...)` do
[docker/nginx.conf](../docker/nginx.conf). (Exceção conhecida: `/_health`, que é
deliberadamente deixado de fora — ver o comentário no `nginx.conf`.)

### 8. Import do seed — manualmente, uma única vez

```sh
docker compose exec strapi \
  sh -c 'npx strapi import -f seed/strapi-export.tar.gz.enc --force -k "$STRAPI_IMPORT_ENCRYPTION_KEY"'
```

> ⚠️ **As aspas SIMPLES e o `sh -c` são obrigatórios.** Com aspas duplas, o
> `$STRAPI_IMPORT_ENCRYPTION_KEY` é expandido pelo shell **da VM** — onde ele não
> existe, porque o `.env` não é carregado no shell de login. O comando viraria
> `-k ""` e o import falharia ao decifrar, dando a impressão de que a chave está
> errada. Com `sh -c '...'`, quem expande é o shell **de dentro do container**,
> que tem a variável via `env_file`.

**Confira que as 144 obras entraram antes de seguir.**

### 9. Criar o super admin real por CLI

Sem depender da tela de registro (que está bloqueada pelo passo 6):

```sh
docker compose exec strapi \
  npx strapi admin:create-user --email=... --firstname=... --password=...
```

> A senha é validada: mínimo 8 caracteres, com pelo menos **uma minúscula, uma
> maiúscula e um número**. O `--lastname` é opcional; `--firstname` não é. Omitir
> qualquer flag obrigatória faz o comando **abrir um prompt interativo** em vez
> de falhar.

### 10. Smoke test do painel

É o que prova que a lista de prefixos do passo 7 está _certa_, não só _completa_.

Abra `https://comarte.eca.usp.br/admin`, logue, e navegue pelo Content Manager
**com o DevTools aberto na aba Network**.

**Esperado:** todo XHR responde `application/json`. Se algum receber `text/html`
em vez de JSON, um prefixo está faltando no nginx (ver [docker/nginx.conf](../docker/nginx.conf)).

### 11. Conferir a flag `Secure` no cookie de sessão

DevTools → Application → Cookies.

**Esperado:** o cookie de sessão do painel tem a flag `Secure`.

> É a única verificação do `ADMIN_COOKIE_SECURE`; sem ela, aquele setting é fé.
> A falha é silenciosa: o login funciona igual, e a proteção só não está lá.

### 12. Convidar os demais usuários

Pelo painel: **Settings → Administration Panel → Users**, com papel Editor ou
Author.

### 13. Auditar a autorização da content API

O site autentica por **API token** (não pelo papel Public — um `GET /api/obras`
sem credencial responde `403`). Duas conferências:

- **O API token do front** (**Settings → API Tokens**): confirme que é do tipo
  **Read-only**, e **recrie-o em produção** — o token de dev não deve viajar para
  a VM. O valor novo vai para o `VITE_API_TOKEN` do build do front. **Ele será
  público** (embutido no bundle) — isso é aceito: rota exige token, o token só lê,
  e o catálogo é público.
- **O papel Public** (**Settings → Users & Permissions → Roles → Public**):
  confirme que ele **não** concede `create`/`update`/`delete` em nada. Se algum
  estiver marcado por engano, qualquer pessoa na internet escreve no catálogo
  **sem token nenhum**.

---

## Notas de manutenção

### Atualizar a fixture de dev

Reexportar de produção e commitar o seed atualizado. **Mão única, sempre
prod → seed.** O seed é uma fixture (estado congelado, versionado no git), não um
backup.

### "Instalei um plugin e o painel quebrou"

Instalar um plugin novo no Strapi adiciona um prefixo de raiz novo, e o painel
para de funcionar em produção até que esse prefixo entre no `location ~ ^/(...)`
do [docker/nginx.conf](../docker/nginx.conf).

- **Sintoma:** o painel carrega mas as telas quebram; o DevTools mostra XHR
  recebendo HTML (o `index.html` do SPA) no lugar de JSON.
- **Conserto:** rodar `docker compose exec strapi npx strapi routes:list` e
  adicionar o prefixo faltante ao `nginx.conf`.

> Em dev esse bug **não existe** — o compose de desenvolvimento não tem o
> container `proxy`, o Strapi é acessado direto na 1337, e as rotas de raiz
> funcionam naturalmente. A falha só aparece em produção.

### ⚠️ Este projeto ainda não tem backup

O seed **não é backup** — é uma fixture congelada no git, sem os `admin_users`, e
que envelhece no instante em que alguém edita conteúdo em produção. Depois deste
deploy, se a VM morrer ou alguém apagar obras pelo painel, **não há de onde
restaurar**.

A estratégia de backup (ferramenta, destino off-site, retenção) é um plano à
parte, em discussão com o time. Até ela existir, a exposição é real e cresce a
cada obra cadastrada.
