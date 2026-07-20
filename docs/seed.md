# Seed do banco

O backend importa dados iniciais a partir de um export cifrado do Strapi,
versionado em `seed/strapi-export.tar.gz.enc`. O seed é uma **fixture** (estado
congelado no git), **não um backup**.

## Import automático no boot (desenvolvimento)

O [entrypoint do container](../docker/entrypoint.sh) roda o import antes de subir
o Strapi, mas **só** quando **todas** estas condições valem:

1. `SEED_ON_BOOT=true` (default `true` no [.env.example](../.env.example));
2. `NODE_ENV` **não** é `production` — o entrypoint **se recusa** a semear em
   produção e sai com erro, orientando a rodar o import manualmente;
3. `STRAPI_IMPORT_ENCRYPTION_KEY` está definida;
4. o arquivo `seed/strapi-export.tar.gz.enc` existe;
5. o banco está **vazio**. Se já houver dados, o seed é pulado.

> ⚠️ O import é **destrutivo**: roda com `--force`, que **apaga o banco** antes de
> importar. As condições acima (só com banco vazio, nunca em produção) existem
> para evitar apagar dados por engano.

Com a `.env` copiada do exemplo, basta subir:

```bash
npm run dev
```

O import roda uma vez; nas próximas subidas, com o banco já populado, é pulado.

## Reimportar (ex.: novo arquivo de seed)

Como o import só roda com o banco vazio, para reimportar é preciso zerar o volume:

```bash
docker compose down -v   # remove o volume postgres_data
npm run dev              # sobe com banco vazio → seed roda de novo
```

## Import manual

Para rodar o import à mão, com a stack no ar:

```bash
docker compose exec strapi \
  sh -c 'npx strapi import -f seed/strapi-export.tar.gz.enc --force -k "$STRAPI_IMPORT_ENCRYPTION_KEY"'
```

## Gerar um novo export

Para criar um novo arquivo de seed (substitui o export atual), com o container em
execução:

1. Descubra o ID do container Strapi:

   ```bash
   docker ps
   ```

2. Rode o export, substituindo `<STRAPI_IMPORT_ENCRYPTION_KEY>` e `<container-id>`:

   ```bash
   docker exec <container-id> \
     npm run strapi export -- --file seed/strapi-export --key <STRAPI_IMPORT_ENCRYPTION_KEY>
   ```

O arquivo gerado fica em `seed/strapi-export.tar.gz.enc`, substituindo o anterior.

> **Atualizar a fixture de dev é mão única: sempre `prod → seed`.** Reexporte de
> produção e commite o seed atualizado. Ele não carrega `admin_users` e envelhece
> assim que alguém edita conteúdo em produção — por isso não substitui um backup.
