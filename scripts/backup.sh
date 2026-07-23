#!/usr/bin/env bash
#
# Backup do Com-Arte: dump do Postgres + tar dos uploads -> Google Drive (rclone).
# Feito para rodar via cron. Ver scripts/README-backup.md.
#
set -Eeuo pipefail

# ==============================================================================
# CONFIGURACAO — ajustar ao trocar de ambiente (local <-> VM de producao)
# ==============================================================================

# Os defaults abaixo sao os da VM de PRODUCAO. Para rodar em dev, troque os 3
# valores marcados com "DEV:" pelo comentario ao lado.

# Raiz do repositorio backend. DEV: /home/<voce>/.../com-arte/backend
PROJECT_DIR="/mnt/data/comarte/backend"

# Arquivo compose. DEV: docker-compose.yml
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"

# Onde os backups ficam no disco local/VM antes (e depois) do upload.
BACKUP_DIR="/var/backups/comarte"

# Log unico do script (cron nao mostra nada na tela).
LOG_FILE="/var/log/comarte-backup.log"

# Lock para impedir duas execucoes simultaneas (cron + execucao manual).
LOCK_FILE="/var/lock/comarte-backup.lock"

# Nomes dos servicos no compose (iguais em dev e prod hoje).
PG_SERVICE="postgres"
STRAPI_SERVICE="strapi"

# Caminho dos uploads DENTRO do container Strapi (nao no host — ver README).
UPLOADS_PATH_IN_CONTAINER="/app/public/uploads"

# Retencao LOCAL em dias. O que ja subiu pro Drive nao e' tocado por isso.
RETENTION_DAYS=90

# rclone: remote crypt ja configurado por fora + pasta destino dentro dele.
RCLONE_REMOTE="gdrive-crypt"
RCLONE_DEST="comarte/backups"
# Config do rclone do usuario que roda o cron. Absoluto: HOME nao existe no cron.
# Na VM o cron roda como root. DEV: /home/<voce>/.config/rclone/rclone.conf
RCLONE_CONFIG="/root/.config/rclone/rclone.conf"

# Teto de tempo por upload. Um upload travado falha e derruba o script em vez de
# ficar retentando e segurando o lock. Aumentar se o tar de uploads crescer muito.
RCLONE_MAX_DURATION="30m"
# Corta transferencia parada: sem bytes novos por esse tempo, a tentativa falha.
RCLONE_TIMEOUT="2m"

# O cron roda com PATH minimo. Fixamos um PATH previsivel.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# ==============================================================================
# FIM DA CONFIGURACAO
# ==============================================================================

ENV_FILE="${PROJECT_DIR}/.env"

# chunk-size maior que o padrao (8M) reduz as idas e voltas com o Drive, que e' onde
# o upload costuma travar. Custa RAM: o rclone bufferiza um chunk por transferencia.
RCLONE_OPTS=(
  --config "${RCLONE_CONFIG}"
  --max-duration "${RCLONE_MAX_DURATION}"
  --timeout "${RCLONE_TIMEOUT}"
  --retries 2
  --drive-chunk-size 64M
  --log-level INFO
  --stats-one-line
  --stats 30s
)

DATE="$(date +%F)"
DB_FILE="${BACKUP_DIR}/comarte-db-${DATE}.sql.gz"
UPLOADS_FILE="${BACKUP_DIR}/comarte-uploads-${DATE}.tar.gz"

mkdir -p "${BACKUP_DIR}" "$(dirname "${LOG_FILE}")" "$(dirname "${LOCK_FILE}")"
exec >>"${LOG_FILE}" 2>&1

log() {
  echo "[$(date '+%F %T')] $*"
}

die() {
  log "ERRO: $*"
  exit 1
}

on_error() {
  local rc=$?
  log "FALHOU (exit ${rc}) na linha ${BASH_LINENO[0]} apos ${SECONDS}s: ${BASH_COMMAND}"
  exit "${rc}"
}
trap on_error ERR

cleanup_partials() {
  rm -f "${DB_FILE}.part" "${UPLOADS_FILE}.part"
}

exec 200>"${LOCK_FILE}"
if ! flock -n 200; then
  log "Outra execucao ja esta em andamento (${LOCK_FILE}). Saindo."
  exit 1
fi

# So' depois do lock: os nomes dos .part dependem da data, entao duas execucoes no
# mesmo dia miram os mesmos arquivos. Registrado antes, o trap da execucao que perde
# o lock apagaria o .part de quem esta trabalhando.
trap cleanup_partials EXIT

log "===== inicio do backup (${DATE}) ====="

[ -f "${COMPOSE_FILE}" ] || die "compose nao encontrado: ${COMPOSE_FILE}"
[ -f "${ENV_FILE}" ] || die ".env nao encontrado: ${ENV_FILE}"
[ -f "${RCLONE_CONFIG}" ] || die "config do rclone nao encontrado: ${RCLONE_CONFIG}"

# O cron nao carrega .bashrc/.profile: as credenciais vem do .env do backend.
# shellcheck disable=SC1090
source "${ENV_FILE}"
: "${DATABASE_NAME:?ausente no .env}"
: "${DATABASE_USERNAME:?ausente no .env}"
: "${DATABASE_PASSWORD:?ausente no .env}"

compose() {
  docker compose -f "${COMPOSE_FILE}" --project-directory "${PROJECT_DIR}" "$@"
}

# SECONDS e' zerado no inicio do script pelo bash; cada etapa guarda o valor de
# entrada e loga a diferenca, para dar pra comparar duracoes entre execucoes.

# ---------- 1. dump do Postgres ----------
t_dump=${SECONDS}
log "[dump] pg_dump de ${DATABASE_NAME} via servico ${PG_SERVICE}"
compose exec -T -e PGPASSWORD="${DATABASE_PASSWORD}" "${PG_SERVICE}" \
  pg_dump -U "${DATABASE_USERNAME}" -d "${DATABASE_NAME}" --clean --if-exists \
  | gzip -9 >"${DB_FILE}.part"
mv "${DB_FILE}.part" "${DB_FILE}"
log "[dump] ok: ${DB_FILE} ($(du -h "${DB_FILE}" | cut -f1)) duracao=$((SECONDS - t_dump))s"

# ---------- 2. tar dos uploads ----------
t_tar=${SECONDS}
log "[tar] uploads de ${UPLOADS_PATH_IN_CONTAINER} via servico ${STRAPI_SERVICE}"
compose exec -T "${STRAPI_SERVICE}" \
  tar -cf - -C "$(dirname "${UPLOADS_PATH_IN_CONTAINER}")" "$(basename "${UPLOADS_PATH_IN_CONTAINER}")" \
  | gzip -9 >"${UPLOADS_FILE}.part"
mv "${UPLOADS_FILE}.part" "${UPLOADS_FILE}"
log "[tar] ok: ${UPLOADS_FILE} ($(du -h "${UPLOADS_FILE}" | cut -f1)) duracao=$((SECONDS - t_tar))s"

# ---------- 3. upload do banco ----------
t_up_db=${SECONDS}
log "[upload-db] enviando $(basename "${DB_FILE}") para ${RCLONE_REMOTE}:${RCLONE_DEST}"
rclone "${RCLONE_OPTS[@]}" copy "${DB_FILE}" "${RCLONE_REMOTE}:${RCLONE_DEST}"
log "[upload-db] ok duracao=$((SECONDS - t_up_db))s"

# ---------- 4. upload dos uploads ----------
t_up_uploads=${SECONDS}
log "[upload-uploads] enviando $(basename "${UPLOADS_FILE}") para ${RCLONE_REMOTE}:${RCLONE_DEST}"
rclone "${RCLONE_OPTS[@]}" copy "${UPLOADS_FILE}" "${RCLONE_REMOTE}:${RCLONE_DEST}"
log "[upload-uploads] ok duracao=$((SECONDS - t_up_uploads))s"

# ---------- 5. limpeza local ----------
t_clean=${SECONDS}
log "[limpeza] removendo backups locais com mais de ${RETENTION_DAYS} dias"
find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'comarte-*' \
  -mtime "+${RETENTION_DAYS}" -print -delete
log "[limpeza] ok (Drive intacto — retencao la e' manual) duracao=$((SECONDS - t_clean))s"

log "===== backup concluido: duracao total=${SECONDS}s ====="
