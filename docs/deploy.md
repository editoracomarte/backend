# Deploy de atualizações

Runbook do **dia a dia**: como publicar mudanças de código no back (Strapi) e no
front (React + Vite) que **já estão no ar** em produção.

> Isto não cobre a configuração inicial da VM (primeiro deploy, criação do
> `.env`, import do seed, criação do super admin). Isso já foi feito uma vez;
> consulte o histórico do repo ou a pessoa responsável pela infra se precisar
> repetir esse processo.

## Como o deploy funciona (resumo)

Existe **um único** `docker compose` na VM (o do back). Ele sobe a stack de
produção, incluindo o proxy que serve o front:

- O **back** é um serviço Docker: publica-se **reconstruindo a imagem** e
  recriando o container (`docker compose up -d --build`).
- O **front** não é um processo: é o `dist/` estático servido pelo container
  `proxy`. Publica-se **rebuildando o `dist/`** no lugar que o `proxy` já monta
  (caminho definido por `FRONTEND_DIST` no `.env` do back). Não há container do
  front para reiniciar — os arquivos novos entram no ar assim que o build
  termina.

| O quê | Onde |
|-------|------|
| Repo do back | diretório clonado na VM que tem o `docker-compose.prod.yml` |
| Repo do front | outro diretório clonado na VM, separado do back |
| `dist/` servido pelo nginx | valor de `FRONTEND_DIST` no `.env` do back |

## Acessar a VM

Acesso por SSH. Credenciais e endereço não ficam neste repo.

## 1. Deploy de mudanças no back (Strapi)

Já dentro da VM, no diretório do repo do back:

```sh
git pull                         # traz o código novo

# fixa o registro npm em IPv4 durante o build da imagem
export NPM_REGISTRY_IP=$(getent ahostsv4 registry.npmjs.org | head -1 | awk '{print $1}')

docker compose up -d --build     # reconstrói a imagem do strapi e recria o container
```

Acompanhe a subida:

```sh
docker compose logs -f strapi
```

## 2. Deploy de mudanças no front (React + Vite)

O front se publica rebuildando o `dist/`. Como o `proxy` monta esse diretório
como bind-mount e o nginx lê do disco a cada request, os arquivos novos entram
no ar ao vivo — **sem reiniciar nada**.

No diretório do repo do front, dentro da VM:

```sh
git pull                             # traz o código novo

# rebuild dentro de um container Node descartável, com IPv4 pinado
export NPM_REGISTRY_IP=$(getent ahostsv4 registry.npmjs.org | head -1 | awk '{print $1}')
docker run --rm \
  --add-host registry.npmjs.org:$NPM_REGISTRY_IP \
  -v "$PWD":/app -w /app \
  node:22-alpine \
  sh -c 'npm ci && npm run build'
```
