<#
.SYNOPSIS
    Script de Release Local para Windows — Longlife Date (lovelog)
.DESCRIPTION
    Atualiza versões de forma canônica, valida testes e tipagem, commita,
    cria tag e faz push para disparar o GitHub Actions.
.PARAMETER Version
    Versão semver a ser publicada (ex: 1.0.1).
.EXAMPLE
    .\.scripts\release.ps1 1.0.1
#>

[CmdletBinding()]
param(
    [Parameter(Position=0, Mandatory=$false)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

function Write-InfoMessage ($msg) {
    Write-Host "[INFO] $msg" -ForegroundColor Cyan
}

function Write-SuccessMessage ($msg) {
    Write-Host "[SUCESSO] $msg" -ForegroundColor Green
}

function Write-WarningMessage ($msg) {
    Write-Host "[AVISO] $msg" -ForegroundColor Yellow
}

function Write-ErrorMessage ($msg) {
    Write-Host "[ERRO] $msg" -ForegroundColor Red
}

# 1. Validação do argumento de entrada
if ([string]::IsNullOrWhiteSpace($Version)) {
    Write-ErrorMessage "Versão não especificada."
    Write-Host "Uso: .\.scripts\release.ps1 <versão-semver>"
    Write-Host "Exemplo: .\.scripts\release.ps1 1.0.1"
    exit 1
}

$NewVersion = $Version.Trim()
$TagName = "v$NewVersion"

# 2. Validação estrita de formato SemVer (X.Y.Z, sem prefixo 'v')
if ($NewVersion -notmatch "^\d+\.\d+\.\d+$") {
    Write-ErrorMessage "Formato de versão inválido: '$NewVersion'. Esperado formato SemVer estrito X.Y.Z (ex: 1.0.1)."
    exit 1
}

Write-InfoMessage "Iniciando processo de release para a versão $NewVersion ($TagName)..."

# 3. Localização da raiz do repositório Git e caminhos dos arquivos
try {
    $RepoRoot = (git rev-parse --show-toplevel).Trim()
} catch {
    Write-ErrorMessage "Falha ao identificar a raiz do repositório Git."
    exit 1
}

Set-Location $RepoRoot

# Detecta se os arquivos estão na raiz ou na subpasta longlife-date
if (Test-Path "package.json") {
    $ProjectDir = "."
} elseif (Test-Path "longlife-date\package.json") {
    $ProjectDir = "longlife-date"
} else {
    Write-ErrorMessage "Arquivo package.json não encontrado na raiz nem na subpasta longlife-date/."
    exit 1
}

$PackageJsonPath = Join-Path $ProjectDir "package.json"
$TauriConfPath    = Join-Path $ProjectDir "src-tauri\tauri.conf.json"
$CargoTomlPath     = Join-Path $ProjectDir "src-tauri\Cargo.toml"
$SrcTauriDir       = Join-Path $ProjectDir "src-tauri"

# 4. Verificação de branch Git permitida (main ou master)
$CurrentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($CurrentBranch -ne "main" -and $CurrentBranch -ne "master") {
    Write-ErrorMessage "Releases devem ser criados a partir da branch 'main' ou 'master'. Branch atual: '$CurrentBranch'."
    exit 1
}

# 5. Verificação de repositório limpo
$StatusOutput = git status --porcelain
if (![string]::IsNullOrWhiteSpace($StatusOutput)) {
    Write-ErrorMessage "O repositório possui alterações não commitadas. Limpe ou commite antes de fazer o release."
    git status --short
    exit 1
}

# 6. Verificação de existência da tag (local e remota)
$LocalTagCheck = git tag -l $TagName
if (![string]::IsNullOrWhiteSpace($LocalTagCheck)) {
    Write-ErrorMessage "A tag local '$TagName' já existe no repositório."
    exit 1
}

$RemoteTagCheck = git ls-remote --tags origin "refs/tags/$TagName"
if (![string]::IsNullOrWhiteSpace($RemoteTagCheck)) {
    Write-ErrorMessage "A tag remota '$TagName' já existe no repositório remoto (origin)."
    exit 1
}

# Guarda conteúdo original para rollback idempotente em caso de falha
$OriginalPkgContent   = Get-Content $PackageJsonPath -Raw
$OriginalTauriContent = Get-Content $TauriConfPath -Raw
$OriginalCargoContent = Get-Content $CargoTomlPath -Raw

try {
    # 7. Atualização canônica de versão nos 3 arquivos
    Write-InfoMessage "Atualizando versão nos arquivos de configuração para $NewVersion..."

    # Atualiza package.json
    $PkgJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
    $PkgJson.version = $NewVersion
    $PkgJson | ConvertTo-Json -Depth 10 | Set-Content $PackageJsonPath -Encoding utf8

    # Atualiza tauri.conf.json
    $TauriConf = Get-Content $TauriConfPath -Raw | ConvertFrom-Json
    $TauriConf.version = $NewVersion
    $TauriConf | ConvertTo-Json -Depth 10 | Set-Content $TauriConfPath -Encoding utf8

    # Atualiza Cargo.toml (somente o campo version do [package])
    $CargoContent = Get-Content $CargoTomlPath -Raw
    $CargoUpdated = $CargoContent -replace '(?ms)(\[package\][\s\S]*?version\s*=\s*")[^"]+(")', "`${1}$NewVersion`${2}"
    Set-Content -Path $CargoTomlPath -Value $CargoUpdated -Encoding utf8

    Write-SuccessMessage "Versão sincronizada em package.json, tauri.conf.json e Cargo.toml."

    # 8. Execução dos testes e checagens obrigatórias
    Write-InfoMessage "Executando suíte completa de verificações e testes..."

    Write-InfoMessage "[1/4] Executando linter frontend..."
    Push-Location $ProjectDir
    try {
        npm run lint
        if ($LASTEXITCODE -ne 0) { throw "Falha no linter frontend." }
    } finally {
        Pop-Location
    }

    Write-InfoMessage "[2/4] Verificando tipos TypeScript..."
    Push-Location $ProjectDir
    try {
        npx tsc --noEmit
        if ($LASTEXITCODE -ne 0) { throw "Falha na verificação de tipos TypeScript." }
    } finally {
        Pop-Location
    }

    Write-InfoMessage "[3/4] Executando testes unitários do frontend..."
    Push-Location $ProjectDir
    try {
        npm run test:unit
        if ($LASTEXITCODE -ne 0) { throw "Falha nos testes unitários do frontend." }
    } finally {
        Pop-Location
    }

    Write-InfoMessage "[4/4] Executando testes do backend Rust..."
    Push-Location $SrcTauriDir
    try {
        cargo test
        if ($LASTEXITCODE -ne 0) { throw "Falha nos testes do backend Rust." }
    } finally {
        Pop-Location
    }

    Write-SuccessMessage "Todos os testes e checagens passaram com sucesso!"

    # 9. Commit, criação de tag e push
    Write-InfoMessage "Gravando commit e tag de release..."

    git add $PackageJsonPath $TauriConfPath $CargoTomlPath

    $PkgLockPath = Join-Path $ProjectDir "package-lock.json"
    $CargoLockPath = Join-Path $SrcTauriDir "Cargo.lock"
    if (Test-Path $PkgLockPath) { git add $PkgLockPath }
    if (Test-Path $CargoLockPath) { git add $CargoLockPath }

    git commit -m "chore: release $TagName"
    git tag -a $TagName -m "Release $TagName"

    Write-InfoMessage "Empurrando branch '$CurrentBranch' e tag '$TagName' para o origin..."
    git push origin $CurrentBranch
    git push origin $TagName

    $RemoteUrl = (git remote get-url origin).Trim()
    Write-SuccessMessage "=========================================================="
    Write-SuccessMessage "Release $TagName enviado com sucesso para o GitHub!"
    Write-SuccessMessage "O workflow .github/workflows/release.yml foi disparado."
    Write-SuccessMessage "Acompanhe em: $RemoteUrl/actions"
    Write-SuccessMessage "=========================================================="

} catch {
    Write-WarningMessage "Ocorreu um erro durante a execução: $_"
    Write-WarningMessage "Restaurando arquivos modificados para garantir idempotência..."
    Set-Content -Path $PackageJsonPath -Value $OriginalPkgContent -Encoding utf8
    Set-Content -Path $TauriConfPath -Value $OriginalTauriContent -Encoding utf8
    Set-Content -Path $CargoTomlPath -Value $OriginalCargoContent -Encoding utf8
    Write-WarningMessage "Arquivos restaurados. Nenhum commit ou tag foi gerado."
    exit 1
}

