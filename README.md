# Longlife Date (lovelog) 💖

[![CI](https://github.com/gwedosun/longlife-dates/actions/workflows/ci.yml/badge.svg)](https://github.com/gwedosun/longlife-dates/actions/workflows/ci.yml)
[![Release](https://github.com/gwedosun/longlife-dates/actions/workflows/release.yml/badge.svg)](https://github.com/gwedosun/longlife-dates/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> Um diário desktop acolhedor, privado e 100% offline para casais registrarem cada momento especial desde o primeiro dia de história juntos. ✨

---

## 🌟 Principais Destaques

- **100% Offline e Privado:** Suas memórias pertencem exclusivamente a você. Nenhuma chamada de rede é feita (`connect-src 'none'`).
- **Banco de Dados Local Embutido:** SQLite ultrarrápido gerenciado localmente pela aplicação.
- **Linha do Tempo e Filtros:** Pesquise por termos e filtre por períodos de datas com facilidade.
- **Galeria de Lembranças:** Suporte a fotos associadas a cada encontro, salvas em disco com integridade e segurança.
- **Backup e Restauração:** Exporte seus encontros e fotos em formato JSON a qualquer momento e restaure quando desejar.
- **Leve e Eficiente:** Desenvolvido com **Tauri 2** (Rust) e frontend moderno em TypeScript puro empacotado com Vite.

---

## 📥 Download e Instalação

Você pode baixar a versão mais recente diretamente na nossa [**Página de Releases no GitHub**](https://github.com/gwedosun/longlife-dates/releases).

### 🪟 Windows (10 e 11)
- **Instalador Recomendado (`.exe`):** Baixe o arquivo `lovelog - desde o primeiro dia_X.Y.Z_x64-setup.exe` e execute o assistente de instalação.
- **Instalador Corporativo/Nativo (`.msi`):** Baixe `lovelog - desde o primeiro dia_X.Y.Z_x64_en-US.msi`.

> ⚠️ **Aviso do Windows SmartScreen:** Por se tratar de um aplicativo de código aberto comunitário sem certificado comercial pago, o Windows pode exibir uma tela azul avisando sobre o aplicativo. Clique em **"Mais informações"** e depois em **"Executar assim mesmo"**. Para detalhes, consulte o [Guia de Release](docs/RELEASE.md#7-avisos-de-segurança-dos-sistemas-operacionais).

---

### 🐧 Linux (Ubuntu, Debian, Fedora e derivados)
- **AppImage (Portátil):** Baixe `*.AppImage`, dê permissão de execução (`chmod +x *.AppImage`) e clique duas vezes para abrir.
- **Pacote Debian/Ubuntu (`.deb`):**
  ```bash
  sudo dpkg -i lovelog_*_amd64.deb
  sudo apt-get install -f
  ```

---

### 🍏 macOS (Apple Silicon e Intel)
- **Imagem de Disco (`.dmg`):** Baixe `*.dmg`, abra o arquivo e arraste o **lovelog** para a pasta **Aplicativos**.

> ⚠️ **Aviso do Gatekeeper no macOS:** Caso o sistema bloqueie a primeira execução, clique com o botão direito no app e selecione **Abrir**, ou vá em **Ajustes do Sistema** $\rightarrow$ **Privacidade e Segurança** e clique em **"Abrir Mesmo Assim"**. Veja o passo a passo completo em [docs/RELEASE.md](docs/RELEASE.md#7-avisos-de-segurança-dos-sistemas-operacionais).

---

## 💻 Desenvolvimento Local

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 20 ou superior)
- [Rust & Cargo](https://rustup.rs/) (versão estável)

### Configuração e Execução

1. Clone o repositório:
   ```bash
   git clone https://github.com/gwedosun/longlife-dates.git
   cd longlife-dates
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Inicie o ambiente de desenvolvimento com hot-reload:
   ```bash
   npm run tauri dev
   ```

4. Execute a suíte de testes:
   ```bash
   npm run lint        # Checagem de tipagem TypeScript
   npm run test:unit   # Testes unitários com Vitest
   cd src-tauri && cargo test  # Testes do backend em Rust
   ```

---

## 🤝 Como Contribuir

Contribuições são muito bem-vindas! Este projeto segue metodologia orientada a testes (**TDD**) e boas práticas de engenharia de software:

1. Abra uma *Issue* para discutir melhorias ou correções.
2. Crie uma branch com nome descritivo (`git checkout -b feature/minha-melhoria`).
3. Escreva testes para as novas regras de negócio.
4. Garanta que o CI execute com sucesso:
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm run test:unit`
   - `cargo test` (em `src-tauri`)
5. Abra um *Pull Request* detalhando as mudanças realizadas.

Para saber como funciona o ciclo de publicação de versões e criação de releases oficiais, leia o nosso [**Guia de Release (docs/RELEASE.md)**](docs/RELEASE.md).

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo `LICENSE` para obter mais informações.

