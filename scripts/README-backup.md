# Backup — `scripts/backup.sh`

Backup mensal do Com-Arte: banco Postgres + uploads do Strapi, enviados
criptografados para o Google Drive. Feito para rodar via cron.

```
pg_dump  ─┐
          ├─► gzip/tar em BACKUP_DIR ─► rclone ─► Google Drive (crypt)
tar uploads ┘        (cópia local, 90 dias)      (cópia offsite, retenção manual)
```

- **`pg_dump`**: ferramenta do Postgres que exporta o banco inteiro (schema + dados) num
  arquivo `.sql` que reconstrói tudo no restore.
- **`tar` dos uploads**: empacota a pasta `public/uploads` do Strapi (imagens de capa
  etc., que ficam em arquivo no disco, não no banco) num único `.tar`.

- **Cópia local** (`/var/backups/comarte/`): descartável, some se a máquina morrer. O
  script apaga sozinho o que passa de 90 dias.
- **Cópia offsite** (Google Drive): a que importa para desastre. Criptografada.

> **Por que criptografado:** o dump inclui o `admin_users` (hashes bcrypt das senhas) e os
> tokens de API do Strapi. Como o backup fica num Drive de terceiros, o rclone cifra antes
> de enviar — o Google só vê blocos cifrados. A senha do crypt não fica nesta máquina: para
> configurar ou restaurar, **peça a senha ao time** (ela não está no repositório).

Nomes gerados: `comarte-db-AAAA-MM-DD.sql.gz` e `comarte-uploads-AAAA-MM-DD.tar.gz`.

---

## Setup (primeira vez, ou máquina/VM nova)

### 1. Dependências

`docker`, `rclone`, `flock`, `gzip`, `tar` no PATH. Os containers do projeto precisam
estar no ar quando o backup roda (o dump sai de dentro deles).

### 2. Remote do rclone

O script assume um remote **crypt** chamado `gdrive-crypt` já configurado (`rclone
config`). A estrutura esperada:

```
[gdrive]                          # a conta Google (type = drive)
type = drive

[gdrive-crypt]                    # camada de criptografia por cima (type = crypt)
type = crypt
remote = gdrive:Backup-Site-ComArte
```

Confirme que funciona antes de seguir:

```bash
rclone --config ~/.config/rclone/rclone.conf lsl gdrive-crypt:comarte/backups
```

### 3. Ajustar as variáveis do script

No topo de `backup.sh`, no bloco `CONFIGURACAO`. **Os defaults já são os da VM de
produção** — na VM não precisa mexer. Para rodar em dev, troque as três variáveis abaixo
(marcadas com `DEV:` no próprio script):

| Variável | O que é | Default (prod) | Em dev, troque para |
|---|---|---|---|
| `PROJECT_DIR` | raiz do repositório backend | `/mnt/data/comarte/backend` | onde você clonou |
| `COMPOSE_FILE` | arquivo compose a usar | `docker-compose.prod.yml` | `docker-compose.yml` |
| `RCLONE_CONFIG` | `rclone.conf` do usuário que roda o cron | `/root/.config/rclone/rclone.conf` | `.config/rclone/rclone.conf` do seu usuário |

> `RCLONE_CONFIG` precisa ser absoluto, não `~/...`: o cron roda sem `HOME` e não expande
> o `~`. Em prod o cron é do root, daí `/root/...`.

`BACKUP_DIR`, `LOG_FILE` e `LOCK_FILE` moram em `/var/...`, o que **exige root**. Para
testar como usuário comum, aponte os três para dentro de `$HOME`.

---

## Rodar manualmente

```bash
sudo /caminho/absoluto/para/scripts/backup.sh; echo "exit: $?"
```

Sempre caminho absoluto. **O script não imprime nada no terminal** — toda a saída vai para
`LOG_FILE`. Para ver o resultado:

```bash
sudo tail -20 /var/log/comarte-backup.log     # depois
sudo tail -f  /var/log/comarte-backup.log     # ao vivo, em outro terminal
grep duracao  /var/log/comarte-backup.log     # tempo por etapa, histórico
```

Cada etapa loga `duracao=Ns` e a última linha traz o total, para ver *qual* etapa ficou
lenta. Em caso de falha, a linha de erro diz a etapa e quanto tempo passou até ali.

Rodar manual com o cron agendado é seguro: o `flock` faz a segunda execução sair na hora,
sem as duas se atropelarem.

**Antes de agendar, teste no ambiente pobre do cron** (sem PATH, sem HOME, diretório
indefinido):

```bash
env -i bash /caminho/absoluto/para/scripts/backup.sh; echo "exit: $?"
```

Se passar aí, passa no cron.

---

## Agendar no cron

O script precisa de root (por causa dos caminhos `/var/...`), então use o crontab do root:

```bash
chmod +x /caminho/absoluto/para/scripts/backup.sh
sudo crontab -e
```

Dia 1 de cada mês, 03:00:

```cron
0 3 1 * * /caminho/absoluto/para/scripts/backup.sh >> /var/log/comarte-backup-cron.log 2>&1
```

O redirecionamento acima só pega falhas *antes* do script assumir o log (script não
encontrado, sem permissão). Se esse arquivo estiver vazio mas algo falhou, o erro está no
`LOG_FILE`.

Para validar sem esperar um mês, agende `*/5 * * * *` temporariamente, confirme com
`grep CRON /var/log/syslog`, e **volte para a agenda mensal** — cada execução sobe arquivo
para o Drive.

---

## Restaurar

> O dump usa `--clean --if-exists`: o restore **derruba** os objetos existentes antes de
> recriar. Não rode contra um banco que você quer preservar.

### Passo 0 — se o arquivo não estiver em disco (máquina nova)

Baixe do Drive primeiro. Precisa do `rclone.conf` com o remote `gdrive-crypt` configurado
(a senha do crypt você pede ao time — ver [Setup, passo 2](#2-remote-do-rclone)):

```bash
mkdir -p /var/backups/comarte
rclone --config ~/.config/rclone/rclone.conf copy \
  gdrive-crypt:comarte/backups/comarte-db-AAAA-MM-DD.sql.gz /var/backups/comarte/
rclone --config ~/.config/rclone/rclone.conf copy \
  gdrive-crypt:comarte/backups/comarte-uploads-AAAA-MM-DD.tar.gz /var/backups/comarte/
```

Se o `lsl` lista os nomes mas o download vem corrompido, a senha do crypt está errada —
ela não falha ao listar, só ao decifrar.

### Banco (igual em dev e prod)

```bash
cd /caminho/para/backend
source .env   # PGPASSWORD nao existe no shell interativo

gunzip -c /var/backups/comarte/comarte-db-AAAA-MM-DD.sql.gz \
  | docker compose exec -T -e PGPASSWORD="$DATABASE_PASSWORD" postgres \
      psql -U "$DATABASE_USERNAME" -d "$DATABASE_NAME"
```

### Uploads

Na VM os uploads ficam num volume nomeado, sem pasta equivalente no host, então extraia
dentro do container:

```bash
gunzip -c /var/backups/comarte/comarte-uploads-AAAA-MM-DD.tar.gz \
  | docker compose exec -T strapi tar -xf - -C /app/public
```

### Conferir

```bash
docker compose exec -T strapi sh -c 'ls /app/public/uploads | wc -l'
```
