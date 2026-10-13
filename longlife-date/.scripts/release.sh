#!/usr/bin/env bash
# Redireciona para o script oficial em .scripts/release.sh
REPO_ROOT="$(git rev-parse --show-toplevel)"
exec "$REPO_ROOT/.scripts/release.sh" "$@"

