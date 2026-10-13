# Redireciona para o script oficial em .scripts/release.ps1
$RepoRoot = (git rev-parse --show-toplevel).Trim()
& "$RepoRoot\.scripts\release.ps1" @args

