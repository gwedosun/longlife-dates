# Guia de Release e Distribuição — Longlife Date (lovelog) 🚀

Este documento descreve detalhadamente o ciclo de lançamento, versionamento e distribuição contínua do **Longlife Date (lovelog)** para Windows, Linux e macOS.

---

## 1. Visão Geral do Processo

O processo de publicação é híbrido e seguro, combinando validação local rigorosa com automação no GitHub Actions:

```
┌────────────────────────────────┐
│   Desenvolvedor Local          │
│   (Windows / Linux / macOS)    │
└──────────────┬─────────────────┘
               │ 1. Executa script local (.scripts/release.ps1 ou .scripts/release.sh)
               ▼
┌────────────────────────────────────────────────────────┐
│   Validações Locais                                    │
│   • Validação SemVer (X.Y.Z)                           │
│   • Checagem de Git limpo e branch (main/master)       │
│   • Sincronização de versão (package, tauri, cargo)     │
│   • Execução de suite de testes (lint, tsc, unit, rust)│
│   • Commit & Tag (vX.Y.Z) & Push                       │
└──────────────┬─────────────────────────────────────────┘
               │ 2. Push da tag v* dispara GitHub Actions
               ▼
┌────────────────────────────────────────────────────────┐
│   GitHub Actions: release.yml                          │
│   • Matriz multi-OS: Windows, Linux (Ubuntu), macOS    │
│   • Validação de testes no ambiente do CI              │
│   • Compilação dos binários nativos de release         │
│   • Verificação de tamanho (falha se < 1 MB)           │
│   • Empacotamento de instaladores (MSI, NSIS, DEB, etc)│
│   • Geração de checksums SHA-256                       │
│   • Criação de Draft Release no GitHub                 │
└──────────────┬─────────────────────────────────────────┘
               │ 3. Revisão humana e publicação
               ▼
┌────────────────────────────────┐
│   Release Oficial Publicado    │
│   Instaladores disponíveis! 💖  │
└────────────────────────────────┘
```

---

## 2. Pré-requisitos de Ambiente

Para executar os scripts de release ou compilar instaladores localmente:

| Ferramenta | Versão Mínima | Finalidade |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.x LTS` | Execução do Vite, TypeScript e testes Vitest |
| **npm** | `>= 10.x` | Gerenciamento de dependências |
| **Rust & Cargo** | `>= 1.78.0 Stable` | Compilação do backend Tauri e rusqlite |
| **Tauri CLI v2** | `^2.1.0` (via npm ou cargo) | Empacotamento de instaladores nativos |
| **Git** | `>= 2.30` | Versionamento e tags SemVer |
| **WiX Toolset** (Windows) | `v3.11` ou `v4` | Obrigatório para gerar instaladores `.msi` no Windows |
| **WebView2 Runtime** | Atualizado | Motor de renderização nativo no Windows 10/11 |

---

## 3. Como Executar o Script Local de Release

O script automatiza a checagem, versionamento canônico, testes e envio da tag.

### No Windows (PowerShell)

Abra o terminal PowerShell na raiz do projeto e execute:

```powershell
.\.scripts\release.ps1 1.0.1
```

O script:
1. Valida se a versão segue rigorosamente o padrão SemVer (`1.0.1`).
2. Garante que o Git não possui alterações pendentes (`git status --porcelain`).
3. Confirma que você está na branch principal (`main` ou `master`).
4. Atualiza a versão em:
   - `package.json` $\rightarrow$ `"version": "1.0.1"`
   - `src-tauri/tauri.conf.json` $\rightarrow$ `"version": "1.0.1"`
   - `src-tauri/Cargo.toml` $\rightarrow$ `version = "1.0.1"`
5. Roda os testes: `npm run lint`, `npx tsc --noEmit`, `npm run test:unit` e `cargo test`.
6. Caso algum teste falhe, **reverte todas as alterações** mantendo seu repositório intacto.
7. Com sucesso, gera o commit `chore: release v1.0.1`, cria a tag anotada `v1.0.1` e envia para o GitHub.

### No Linux ou macOS (Bash)

Abra o terminal e execute:

```bash
chmod +x .scripts/release.sh
./.scripts/release.sh 1.0.1
```

---

## 4. Disparo Manual pelo GitHub Actions (`workflow_dispatch`)

Caso precise gerar um release sem criar uma tag via script local:

1. Acesse o repositório no GitHub: `https://github.com/gwedosun/longlife-dates/actions`.
2. No menu lateral esquerdo, clique no workflow **Release - Publicação de Versão**.
3. No banner superior, clique em **Run workflow**.
4. Selecione a branch desejada (`main` ou `master`) e confirme em **Run workflow**.
5. O build executará para as 3 plataformas e gerará um novo **Draft Release**.

---

## 5. Fluxo de Publicação (Draft $\rightarrow$ Publicado)

Por motivos de segurança e qualidade, todos os releases gerados pelo GitHub Actions são criados inicialmente no modo **Rascunho (Draft)**:

1. Acesse a aba **Releases** no GitHub (`https://github.com/gwedosun/longlife-dates/releases`).
2. Localize o release recém-gerado marcado com a etiqueta amarela `Draft`.
3. Verifique se os artefatos de todos os sistemas operacionais foram anexados:
   - Windows: `.exe` (NSIS) e `.msi` (WiX)
   - Linux: `.deb` e `.AppImage`
   - macOS: `.dmg` e `.app.tar.gz`
4. Realize o **Smoke Test** baixando o instalador da sua plataforma.
5. Clique em **Edit**, revise as notas de release e clique no botão verde **Publish release**.

---

## 6. Checklist de Smoke Test Pós-Build (15 Itens Obrigatórios)

Antes de publicar o release para o público final, o testador deve validar cada um dos seguintes itens:

- [ ] **ST-01:** O instalador executa e conclui sem erros ou telas travadas.
- [ ] **ST-02:** O atalho na área de trabalho e/ou menu iniciar é criado corretamente com o ícone do projeto.
- [ ] **ST-03:** O aplicativo inicializa e abre a janela com dimensões e título esperados (`lovelog`).
- [ ] **ST-04:** **Teste 100% Offline:** Desconecte a rede/Wi-Fi da máquina. O aplicativo deve abrir normalmente e as fontes locais (`Nunito` e `Pacifico`) devem renderizar com perfeição.
- [ ] **ST-05:** **Criar Encontro:** Cadastrar um encontro com data válida (`DD/MM/AAAA`), local e descrição. O encontro deve surgir na lista imediatamente.
- [ ] **ST-06:** **Validação de Data:** Tentar salvar data inválida (ex: `31/02/2026`). O sistema deve exibir mensagem de erro amigável e impedir o salvamento.
- [ ] **ST-07:** **Upload de Foto:** Anexar uma foto (JPEG/PNG/WebP). A foto deve ser salva no banco e a miniatura/botão deve funcionar.
- [ ] **ST-08:** **Modal de Foto:** Clicar em *"ver foto"* abre o modal ampliado e fechar com clique fora funciona.
- [ ] **ST-09:** **Filtro por Texto:** Digitar no campo de busca filtra em tempo real (debounce) por local ou descrição.
- [ ] **ST-10:** **Filtro por Período:** Preencher datas "De" e "Até" e verificar se a listagem respeita o intervalo cronológico.
- [ ] **ST-11:** **Exportar Backup:** Clicar em *"Exportar backup (.json)"*. Verificar se o arquivo `lovelog-backup-YYYY-MM-DD.json` é baixado com os dados e fotos em Base64.
- [ ] **ST-12:** **Importar Backup:** Limpar dados ou importar o JSON exportado com a confirmação `SUBSTITUIR`. O histórico deve ser restaurado perfeitamente.
- [ ] **ST-13:** **Excluir Encontro:** Excluir um encontro específico após confirmação. O item e sua foto devem sumir da pasta local.
- [ ] **ST-14:** **Zona de Perigo:** Clicar em *"Apagar todos os dados"*, confirmar com a palavra `APAGAR`. Banco e fotos devem ser limpos.
- [ ] **ST-15:** **Reinicialização:** Fechar o app e reabri-lo. As preferências e persistência no banco SQLite `%APPDATA%\com.longlifedate.app\encounters.db` devem permanecer íntegras.

---

## 7. Avisos de Segurança dos Sistemas Operacionais

Como este é um projeto de código aberto mantido por estudantes/comunidade, os instaladores não possuem assinatura digital comercial paga (certificados EV/OV custam centenas de dólares anuais).

### No Windows (Microsoft Defender SmartScreen)
Ao executar o `.exe` ou `.msi`, o Windows exibirá a tela azul:
> *"O Windows protegeu o seu computador — O Microsoft Defender SmartScreen impediu a inicialização de um aplicativo não reconhecido."*

**Instruções para o usuário:**
1. Clique no link **"Mais informações"**.
2. Clique no botão **"Executar assim mesmo"**.
3. O instalador abrirá normalmente.

### No macOS (Apple Gatekeeper)
Ao abrir o `.dmg` ou `.app`, o macOS pode alertar que o desenvolvedor não pode ser verificado.

**Instruções para o usuário:**
1. Clique com o botão direito (ou Control + clique) no ícone do aplicativo e selecione **Abrir**.
2. Na caixa de diálogo que surgir, clique em **Abrir**.
3. Alternativamente, abra **Ajustes do Sistema** $\rightarrow$ **Privacidade e Segurança** e, na seção inferior, clique em **"Abrir Mesmo Assim"**.

---

## 8. Desinstalação e Limpeza de Dados

Para garantir a total privacidade e controle pelo usuário, a desinstalação padrão do sistema **não remove automaticamente suas memórias e fotos**, evitando perdas acidentais.

### Windows
1. Acesse **Configurações** $\rightarrow$ **Aplicativos** $\rightarrow$ **Aplicativos Instalados**.
2. Localize **lovelog** (ou **Longlife Date**) e selecione **Desinstalar**.
3. **Limpeza definitiva de dados (opcional):**
   - Pressione `Win + R`, digite `%APPDATA%` e dê Enter.
   - Delete a pasta `com.longlifedate.app`.

### Linux
- **Pacote DEB:**
  ```bash
  sudo apt remove lovelog
  ```
- **AppImage:**
  - Basta deletar o arquivo `.AppImage`.
- **Limpeza definitiva de dados (opcional):**
  ```bash
  rm -rf ~/.local/share/com.longlifedate.app
  ```

### macOS
1. Abra o **Finder**, vá em **Aplicativos** e arraste o app para o **Lixo**.
2. **Limpeza definitiva de dados (opcional):**
   ```bash
   rm -rf ~/Library/Application\ Support/com.longlifedate.app
   ```

---

## 9. Verificação de Integridade (Checksums SHA-256)

Cada artefato publicado no GitHub possui um checksum SHA-256 correspondente. Para checar a integridade do download:

### Windows (PowerShell)
```powershell
Get-FileHash -Algorithm SHA256 "lovelog - desde o primeiro dia_1.0.0_x64-setup.exe"
```

### Linux
```bash
sha256sum lovelog_1.0.0_amd64.deb
```

### macOS
```bash
shasum -a 256 lovelog.dmg
```

Compare a sequência hexadecimal exibida com o valor presente nas notas da Release.

---

## 10. Troubleshooting (Resolução de Problemas Comuns)

### 1. Erro: WiX Toolset ausente no Windows
- **Sintoma:** Ao empacotar com `--bundles msi`, o Tauri emite erro dizendo que `light.exe` ou `candle.exe` não foram encontrados.
- **Solução:** Baixe e instale o [WiX Toolset v3.11](https://wixtoolset.org/releases/) ou instale via Chocolatey:
  ```powershell
  choco install wixtoolset
  ```
  Reinicie o terminal para atualizar o `PATH`.

### 2. Erro de Linker no Linux (`libwebkit2gtk-4.1-dev` ausente)
- **Sintoma:** `pkg-config` falha ao encontrar `javascriptcoregtk-4.1` ou `webkit2gtk-4.1`.
- **Solução:** Instale os pacotes de desenvolvimento WebKit:
  ```bash
  sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
  ```

### 3. Erro: Tag Duplicada (`tag already exists`)
- **Sintoma:** O script de release acusa que a tag `vX.Y.Z` já existe.
- **Solução:** Verifique a próxima versão SemVer incremental correta. Se a tag foi criada por engano e ainda não foi publicada, delete-a local e remotamente:
  ```bash
  git tag -d v1.0.1
  git push --delete origin v1.0.1
  ```

### 4. Permissão Negada no GitHub Actions (`403 Resource not accessible by integration`)
- **Sintoma:** O job de release falha ao criar o draft release no GitHub.
- **Solução:** O workflow exige a permissão `contents: write`. No repositório do GitHub, vá em **Settings** $\rightarrow$ **Actions** $\rightarrow$ **General** $\rightarrow$ **Workflow permissions** e marque a opção **Read and write permissions**.

### 5. Compilação Lenta do Rust no CI
- **Sintoma:** O CI demora mais de 10 minutos para concluir.
- **Solução:** A action `swatinem/rust-cache@v2` foi implementada e configurada no `ci.yml` e `release.yml`. Após a primeira execução em cada branch, as dependências são cacheadas e o tempo cai para ~1 a 2 minutos.

### 6. Executável com tamanho suspeito (< 1 MB)
- **Sintoma:** O passo de verificação de tamanho emite erro e aborta o build.
- **Solução:** Um executável Tauri completo em Rust inclui o runtime e o SQLite embutido, tendo entre 5 MB e 25 MB. Se tiver menos de 1 MB, significa que o linker falhou ou um stub vazio foi copiado. Verifique se o comando `npm run build` gerou a pasta `dist` corretamente antes do empacotamento.

---

## 11. Tabela de Compatibilidade por Sistema Operacional

| Sistema Operacional | Arquitetura | Formato de Distribuição | Requisito Mínimo |
| :--- | :--- | :--- | :--- |
| **Windows 10 / 11** | x64 (64-bit) | `.exe` (NSIS) e `.msi` (MSI) | WebView2 Runtime instalado |
| **Ubuntu / Debian** | x64 (amd64) | `.deb` e `.AppImage` | GLIBC 2.31+, WebKitGTK 4.1 |
| **Fedora / Arch** | x64 (amd64) | `.AppImage` | FUSE habilitado |
| **macOS (Apple Silicon)** | arm64 (M1/M2/M3/M4) | `.dmg` e `.app` | macOS 11.0 Big Sur ou superior |
| **macOS (Intel)** | x86_64 | `.dmg` e `.app` (Universal) | macOS 10.15 Catalina ou superior |

