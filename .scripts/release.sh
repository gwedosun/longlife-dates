#!/usr/bin/env bash
# ==============================================================================
# Script de Release Local — Longlife Date (lovelog)
# Uso: ./.scripts/release.sh <versao> (exemplo: ./.scripts/release.sh 1.0.1)
# ==============================================================================

set -euo pipefail

# Cores para saída no terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sem cor

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCESSO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERRO]${NC} $1" >&2
}

# 1. Validação do argumento de entrada
if [ $# -ne 1 ]; then
    log_error "Versão não especificada."
    echo "Uso: $0 <versão-semver>"
    echo "Exemplo: $0 1.0.1"
    exit 1
fi

NEW_VERSION="$1"
TAG_NAME="v${NEW_VERSION}"

# 2. Validação estrita de formato SemVer (X.Y.Z, sem prefixo 'v')
SEMVER_REGEX="^[0-9]+\.[0-9]+\.[0-9]+$"
if ! [[ "$NEW_VERSION" =~ $SEMVER_REGEX ]]; then
    log_error "Formato de versão inválido: '${NEW_VERSION}'. Esperado formato SemVer estrito X.Y.Z (ex: 1.0.1)."
    exit 1
fi

log_info "Iniciando processo de release para a versão ${NEW_VERSION} (${TAG_NAME})..."

# 3. Localização da raiz do projeto e dos arquivos de versão
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [ -f "package.json" ]; then
    PROJECT_DIR="."
elif [ -f "longlife-date/package.json" ]; then
    PROJECT_DIR="longlife-date"
else
    log_error "Arquivo package.json não encontrado nem na raiz nem em longlife-date/."
    exit 1
fi

PACKAGE_JSON="${PROJECT_DIR}/package.json"
TAURI_CONF="${PROJECT_DIR}/src-tauri/tauri.conf.json"
CARGO_TOML="${PROJECT_DIR}/src-tauri/Cargo.toml"
SRC_TAURI_DIR="${PROJECT_DIR}/src-tauri"

# 4. Verificação de branch Git permitida (main ou master)
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    log_error "Releases devem ser criados a partir da branch 'main' ou 'master'. Branch atual: '${CURRENT_BRANCH}'."
    exit 1
fi

# 5. Verificação de árvore de trabalho limpa (sem arquivos modificados ou untracked não commitados)
if [ -n "$(git status --porcelain)" ]; then
    log_error "O repositório possui alterações não commitadas. Limpe ou commite antes de fazer o release."
    git status --short
    exit 1
fi

# 6. Verificação de existência da tag (local e remota)
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    log_error "A tag local '${TAG_NAME}' já existe no repositório."
    exit 1
fi

if git ls-remote --tags origin "refs/tags/${TAG_NAME}" | grep -q "${TAG_NAME}"; then
    log_error "A tag remota '${TAG_NAME}' já existe no repositório remoto (origin)."
    exit 1
fi

# Backup para recuperação em caso de falha durante a execução dos testes
ORIGINAL_PKG_CONTENT="$(cat "$PACKAGE_JSON")"
ORIGINAL_TAURI_CONTENT="$(cat "$TAURI_CONF")"
ORIGINAL_CARGO_CONTENT="$(cat "$CARGO_TOML")"

cleanup_on_error() {
    log_warn "Ocorreu um erro durante o processo. Restaurando arquivos de versão para o estado original..."
    echo "$ORIGINAL_PKG_CONTENT" > "$PACKAGE_JSON"
    echo "$ORIGINAL_TAURI_CONTENT" > "$TAURI_CONF"
    echo "$ORIGINAL_CARGO_CONTENT" > "$CARGO_TOML"
    log_warn "Arquivos restaurados. Nenhuma tag ou commit foi gravado."
}
trap cleanup_on_error ERR

# 7. Atualização canônica de versão nos 3 arquivos do projeto
log_info "Atualizando versão nos arquivos de configuração para ${NEW_VERSION}..."

# Atualização no package.json via Node
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('${PACKAGE_JSON}', 'utf8'));
pkg.version = '${NEW_VERSION}';
fs.writeFileSync('${PACKAGE_JSON}', JSON.stringify(pkg, null, 2) + '\n');
"

# Atualização no tauri.conf.json via Node
node -e "
const fs = require('fs');
const conf = JSON.parse(fs.readFileSync('${TAURI_CONF}', 'utf8'));
conf.version = '${NEW_VERSION}';
fs.writeFileSync('${TAURI_CONF}', JSON.stringify(conf, null, 2) + '\n');
"

# Atualização no Cargo.toml (apenas a chave version sob [package])
node -e "
const fs = require('fs');
let toml = fs.readFileSync('${CARGO_TOML}', 'utf8');
toml = toml.replace(/(\[package\][\s\S]*?version\s*=\s*\")[^\"]+(\")/, '\$1${NEW_VERSION}\$2');
fs.writeFileSync('${CARGO_TOML}', toml);
"

log_success "Versão sincronizada em package.json, tauri.conf.json e Cargo.toml."

# 8. Execução de testes e checagens obrigatórias
log_info "Executando suíte completa de verificações e testes..."

log_info "[1/4] Executando linter frontend..."
(cd "$PROJECT_DIR" && npm run lint)

log_info "[2/4] Verificando tipos TypeScript..."
(cd "$PROJECT_DIR" && npx tsc --noEmit)

log_info "[3/4] Executando testes unitários do frontend..."
(cd "$PROJECT_DIR" && npm run test:unit)

log_info "[4/4] Executando testes do backend Rust..."
(cd "$SRC_TAURI_DIR" && cargo test)

log_success "Todos os testes e checagens passaram com sucesso!"

# Remove a trap de erro antes de finalizar os comandos Git
trap - ERR

# 9. Commit, criação de tag e push
log_info "Gravando commit e tag de release..."

git add "$PACKAGE_JSON" "$TAURI_CONF" "$CARGO_TOML"
# Adiciona locks se existirem
[ -f "${PROJECT_DIR}/package-lock.json" ] && git add "${PROJECT_DIR}/package-lock.json"
[ -f "${SRC_TAURI_DIR}/Cargo.lock" ] && git add "${SRC_TAURI_DIR}/Cargo.lock"

git commit -m "chore: release ${TAG_NAME}"
git tag -a "${TAG_NAME}" -m "Release ${TAG_NAME}"

log_info "Empurrando branch '${CURRENT_BRANCH}' e tag '${TAG_NAME}' para o origin..."
git push origin "$CURRENT_BRANCH"
git push origin "$TAG_NAME"

log_success "=========================================================="
log_success "Release ${TAG_NAME} enviado com sucesso para o GitHub!"
log_success "O workflow .github/workflows/release.yml foi disparado."
log_success "Acompanhe em: https://github.com/$(git remote get-url origin | sed -E 's/.*github.com[:\/](.*)\.git/\1/')/actions"
log_success "=========================================================="

