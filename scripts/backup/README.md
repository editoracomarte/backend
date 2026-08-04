# Backup — `scripts/backup/backup.sh`

Backup mensal do Com-Arte: banco Postgres + uploads do Strapi + export de configuração
do Strapi, enviados criptografados para o Google Drive. Feito para rodar via cron.

```
pg_dump      ─┐
tar uploads   ─┤─► gzip/tar em BACKUP_DIR ─► rclone ─► Google Drive (crypt)
strapi export ┘    (cópia local, 90 dias)   (cópia offsite, últimos DRIVE_KEEP_BACKUPS)
```

- **`comarte-db-AAAA-MM-DD_HH-MM-SS.sql.gz`** — `pg_dump --clean --if-exists` do banco inteiro.
- **`comarte-uploads-AAAA-MM-DD_HH-MM-SS.tar.gz`** — `public/uploads` do Strapi (não fica no banco).
- **`comarte-config-AAAA-MM-DD_HH-MM-SS.tar.gz.enc`** — `strapi export --only config`: o que não
  está no dump nem nos uploads (ex.: view configurada dos collection types no
  content-manager). Não inclui `admin_users` nem tokens, por isso reaproveita a
  `STRAPI_IMPORT_ENCRYPTION_KEY` do seed sem expor nada de novo.

**Cópia local** (`/var/backups/comarte/`): descartável, apagada sozinha depois de 90 dias.
**Cópia offsite** (Google Drive): a que importa para desastre. O script mantém só os
`DRIVE_KEEP_BACKUPS` mais recentes (default **2**) e só apaga o resto depois que os 3
arquivos novos já subiram com sucesso — nunca fica sem nenhuma cópia no ar.

> **Por que criptografado:** o dump inclui `admin_users` (hashes bcrypt) e tokens de API.
> O rclone cifra antes de enviar pro Drive de terceiros — o Google só vê blocos cifrados.
> A senha do crypt **não está no repositório**; peça ao time para configurar ou restaurar.

---

## Rodar manualmente

```bash
sudo /caminho/absoluto/para/scripts/backup/backup.sh; echo "exit: $?"
```

Sempre caminho absoluto. O script não imprime nada no terminal — a saída vai toda para
`LOG_FILE`:

```bash
sudo tail -f  /var/log/comarte-backup.log     # ao vivo
grep duracao  /var/log/comarte-backup.log     # tempo por etapa, histórico
```

Rodar manual com o cron agendado é seguro: o `flock` faz a segunda execução sair na hora.

**Antes de agendar, teste no ambiente pobre do cron** (sem PATH, sem HOME):

```bash
env -i bash /caminho/absoluto/para/scripts/backup/backup.sh; echo "exit: $?"
```

Se passar aí, passa no cron.

---

## Agendar no cron

Precisa de root (por causa dos caminhos `/var/...`):

```bash
chmod +x /caminho/absoluto/para/scripts/backup/backup.sh
sudo crontab -e
```

Dia 1 de cada mês, 03:00:

```cron
0 3 1 * * /caminho/absoluto/para/scripts/backup/backup.sh >> /var/log/comarte-backup-cron.log 2>&1
```

Esse redirecionamento só pega falhas *antes* do script assumir o log; se o arquivo estiver
vazio mas algo falhou, o erro está no `LOG_FILE`.

Para validar sem esperar um mês, agende `*/5 * * * *` temporariamente e volte para a agenda
mensal depois — cada execução de teste vira um arquivo novo (o nome inclui a hora), mas
todas as do mesmo dia contam como 1 backup só para a retenção do Drive (`DRIVE_KEEP_BACKUPS`
agrupa por data, não por arquivo).

---

## Restaurar

> O dump usa `--clean --if-exists`: o restore **derruba** os objetos existentes antes de
> recriar. Não rode contra um banco que você quer preservar.

### Passo 0 — baixar do Drive (se o arquivo não estiver em disco)

Peça a senha do remote `gdrive-crypt` ao time. Liste o que tem no Drive pra saber o nome
exato (o timestamp completo, `AAAA-MM-DD_HH-MM-SS`, não dá pra adivinhar):

```bash
sudo rclone lsl gdrive-crypt:
```

```bash
mkdir -p /var/backups/comarte
rclone --config ~/.config/rclone/rclone.conf copy \
  gdrive-crypt:comarte/backups/comarte-db-AAAA-MM-DD_HH-MM-SS.sql.gz /var/backups/comarte/
rclone --config ~/.config/rclone/rclone.conf copy \
  gdrive-crypt:comarte/backups/comarte-uploads-AAAA-MM-DD_HH-MM-SS.tar.gz /var/backups/comarte/
rclone --config ~/.config/rclone/rclone.conf copy \
  gdrive-crypt:comarte/backups/comarte-config-AAAA-MM-DD_HH-MM-SS.tar.gz.enc /var/backups/comarte/
```

Se o `lsl` lista os nomes mas o download vem corrompido, a senha do crypt está errada —
ela não falha ao listar, só ao decifrar.

### Banco

```bash
cd /caminho/para/backend && source .env   # PGPASSWORD

gunzip -c /var/backups/comarte/comarte-db-AAAA-MM-DD_HH-MM-SS.sql.gz \
  | docker compose exec -T -e PGPASSWORD="$DATABASE_PASSWORD" postgres \
      psql -U "$DATABASE_USERNAME" -d "$DATABASE_NAME"
```

### Uploads

Na VM os uploads ficam num volume nomeado, sem pasta equivalente no host — extraia dentro
do container:

```bash
gunzip -c /var/backups/comarte/comarte-uploads-AAAA-MM-DD_HH-MM-SS.tar.gz \
  | docker compose exec -T strapi tar -xf - -C /app/public
```

### Configuração

Restaura só `config` — não toca em conteúdo nem mídia, então é seguro mesmo o `import`
exigindo `--force` para rodar sem prompt interativo:

```bash
cd /caminho/para/backend && source .env   # STRAPI_IMPORT_ENCRYPTION_KEY

docker compose cp /var/backups/comarte/comarte-config-AAAA-MM-DD_HH-MM-SS.tar.gz.enc \
  strapi:/tmp/comarte-config-restore.tar.gz.enc
docker compose exec -T -e STRAPI_IMPORT_ENCRYPTION_KEY strapi \
  sh -c 'npm run strapi import -- -f /tmp/comarte-config-restore.tar.gz.enc --force --only config -k "$STRAPI_IMPORT_ENCRYPTION_KEY"'
docker compose exec -T strapi rm -f /tmp/comarte-config-restore.tar.gz.enc
```

### Conferir

```bash
docker compose exec -T strapi sh -c 'ls /app/public/uploads | wc -l'
```
