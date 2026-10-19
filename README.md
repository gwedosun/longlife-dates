# Longlife Date (Lovelog) 💖

[![CI](https://github.com/gwedosun/longlife-dates/actions/workflows/ci.yml/badge.svg)](https://github.com/gwedosun/longlife-dates/actions/workflows/ci.yml)
[![Release](https://github.com/gwedosun/longlife-dates/actions/workflows/release.yml/badge.svg)](https://github.com/gwedosun/longlife-dates/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Aplicativo desktop standalone, **100% offline, privado, leve e gratuito** para casais registrarem suas memórias e encontros desde o primeiro dia juntos.

---

## 1. Visão do Produto

Casais que desejam registrar memórias de forma privada, offline e sem custos recorrentes frequentemente esbarram em soluções pesadas, assinaturas pagas ou serviços que expõem dados íntimos na nuvem.

O **Longlife Date (Lovelog)** soluciona esse problema oferecendo um aplicativo desktop leve, com estética acolhedora em tons pastel, código aberto e **garantia absoluta de que nenhuma informação sai do computador do usuário**.

### Resumo das Funcionalidades
- **CRUD de Encontros:** Criar, listar, editar e excluir encontros com data, local, descrição e foto.
- **Linha do Tempo Cronológica:** Exibição em cards estruturados (data e local no topo, foto ao centro e descrição na base), ordenados cronologicamente (crescente por padrão e alternável para decrescente).
- **Upload Seguro de Foto:** Até 1 imagem por encontro (JPEG, PNG ou WebP até 10 MB), validada por *magic bytes* e armazenada localmente com identificador UUID.
- **Busca e Filtros:** Pesquisa textual por local/descrição e filtragem por intervalo de datas.
- **Importação e Exportação de Backup:** Exportação e restauração completa da base de dados e fotos.
- **Exclusão Permanente de Conta:** Remoção integral e confirmada de todos os registros do SQLite e arquivos de fotos locais.

---

## 2. Arquitetura e Tecnologias

### 2.1 Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| **Desktop / Runtime** | Tauri 2 (Rust) + WebView2 nativo |
| **Frontend** | HTML5, CSS3 (tons pastel, WCAG AA), TypeScript Vanilla, Vite |
| **Banco de Dados** | SQLite local via `rusqlite` (`bundled`) |
| **Armazenamento de Fotos** | Diretório local do sistema (`AppData/photos/`) |
| **Testes** | `cargo test` (Rust unit/API), Vitest + `jsdom` + `@vitest/coverage-v8` (TS unit), WebdriverIO + `tauri-driver` (E2E) |
| **CI/CD** | GitHub Actions |

### 2.2 API Interna (Tauri Commands)

| Comando | Entrada | Saída | Erros |
|---|---|---|---|
| `create_encounter` (`create_encounter_cmd`) | `{ date, location, description, photo_path? / photoBytes? }` | `Encounter` / `id` | `InvalidDate`, `InvalidLocation`, `InvalidImage` |
| `list_encounters` (`list_encounters_cmd`) | `{ order?: "asc" \| "desc", query?, from?, to? }` | `Encounter[]` | `InvalidDate` |
| `get_encounter` (`get_encounter_cmd`) | `{ id }` | `Encounter` | `NotFound` |
| `update_encounter` (`update_encounter_cmd`) | `{ id, date?, location?, description?, photo_path? / newPhotoBytes? }` | `Encounter` / `()` | `NotFound`, `InvalidDate`, `InvalidLocation`, `InvalidImage` |
| `delete_encounter` (`delete_encounter_cmd`) | `{ id }` | `()` | `NotFound` |
| `get_photo` (`read_photo_cmd` / `get_photo_path_cmd`) | `{ file_name }` | `Bytes` / Base64 | `NotFound`, `InvalidFileName` |
| `search_encounters` (integrado a `list_encounters_cmd`) | `{ query }` | `Encounter[]` | `-` |
| `export_backup` (`export_backup_cmd`) | `{ dest_path? }` | `()` / JSON | `IoError` |
| `import_backup` (`import_backup_cmd`) | `{ src_path / json }` | `()` / `usize` | `InvalidBackup`, `IoError` |
| `delete_account` (`delete_all_data_cmd`) | `{}` | `()` | `IoError` |

### 2.3 Privacidade e Segurança

- **CSP Restritiva:** `default-src 'self'; img-src 'self' asset: data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'none'`.
- **Capabilities Mínimas:** Sem plugins de rede (`http`) ou `shell`; aplicativo **100% offline** em tempo de execução.
- **Tipografia Local:** Fontes empacotadas localmente via `@fontsource/pacifico` e `@fontsource/nunito`.
- **Validação de Imagens:** Inspeção real por *magic bytes* (JPEG, PNG, WebP), limite de 10 MB e geração de nomes via UUID v4 (prevenindo *path traversal*).
- **Persistência Segura:** Queries SQLite 100% parametrizadas e restrições `CHECK` no schema.
- **Proteção de Repositório:** `.gitignore` rigoroso bloqueando `*.db`, `*.sqlite*`, `photos/`, `*.jpg`, `*.png`, `*.webp` e `*.zip`, auditado via `git check-ignore` e `gitleaks`.

---

## 3. Documentação de Testes e Evidências

O projeto foi desenvolvido integralmente sob a metodologia **TDD (Test-Driven Development)**:

- 📋 [**Casos de Teste, Requisitos e Histórias de Usuário (`longlife-date/docs/CASO_TESTE.md`)**](longlife-date/docs/CASO_TESTE.md)
- ✅ [**Relatório Consolidado de Evidências de Testes (`longlife-date/docs/tests/EVIDENCIAS_DE_TESTES.md`)**](longlife-date/docs/tests/EVIDENCIAS_DE_TESTES.md)
- 📂 [**Logs Brutos de Execução (`longlife-date/docs/evidence/`)**](longlife-date/docs/evidence/)

---

## 4. Como Executar e Testar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (v20+)
- [Rust & Cargo](https://rustup.rs/) (toolchain estável)

### Instalação e Execução em Desenvolvimento

```bash
# 1. Instalar dependências do frontend
cd longlife-date
npm install

# 2. Iniciar o aplicativo em modo de desenvolvimento (Tauri + Vite)
npm run tauri dev
```

### Comandos da Suíte de Testes e Qualidade

Abaixo estão os comandos exatos para executar todas as suítes de teste e verificações estáticas:

| Camada | Diretório | Comando | O que valida |
|---|---|---|---|
| **Backend Rust (Unit + API)** | `longlife-date/src-tauri` | `cargo test` | Executa os 40 testes unitários e de integração com SQLite `:memory:` e diretórios temporários. |
| **Backend Rust (Linter)** | `longlife-date/src-tauri` | `cargo clippy -- -D warnings` | Analisa a qualidade do código Rust garantindo zero warnings. |
| **Backend Rust (Formatação)** | `longlife-date/src-tauri` | `cargo fmt --check` | Verifica a padronização de formatação (`rustfmt`). |
| **Frontend TS (Unit + DOM)** | `longlife-date` | `npm test` | Executa os 33 testes unitários e de componentes DOM com Vitest + `jsdom`. |
| **Frontend TS (Cobertura)** | `longlife-date` | `npx vitest run --coverage` | Gera o relatório de cobertura de código V8 (**99,25% de linhas**). |
| **Frontend TS (Tipagem)** | `longlife-date` | `npm run lint` | Executa a checagem estática de tipos (`tsc --noEmit`). |
| **Frontend TS (Build)** | `longlife-date` | `npm run build` | Compila o TypeScript e empacota o bundle de produção offline com Vite. |
| **Repositório (`.gitignore`)** | Raiz do repositório | `git check-ignore -v longlife.db photos/a.jpg backup.zip` | Confirma o bloqueio de bancos SQLite, fotos pessoais e arquivos de backup. |

---

## 5. Autora e Contexto Acadêmico

- **Autora:** Gabriella Braga
- **Disciplina:** Teste de Software (`GPE01M30025`) — Bacharelado em Ciência da Computação (UCB)
- **Professor:** Samuel Novais Moura Júnior
- **Licença:** Distribuído sob a licença **MIT**.
