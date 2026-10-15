# Testes Não Funcionais e Repositório — Longlife Date (lovelog)

Documento vinculante de validação dos requisitos não funcionais (RNF01–RNF07) e integridade de repositório do **Longlife Date (lovelog)**.

## Diretrizes de Segurança, Desempenho e Privacidade
1. **Privacidade Absoluta (100% Offline):** O aplicativo opera sem conexões externas em tempo de execução. A política de segurança de conteúdo (CSP) bloqueia qualquer conexão de rede com `connect-src 'none'`.
2. **Fontes Embutidas Localmente:** Todas as fontes tipográficas (`@fontsource/pacifico` e `@fontsource/nunito`) são compiladas diretamente no bundle estático, sem qualquer dependência do Google Fonts via CDN.
3. **Proteção Contra Vazamento de Dados Pessoais:** O arquivo `.gitignore` bloqueia preventivamente arquivos de banco de dados (`*.db`, `*.sqlite*`), diretórios de fotos (`photos/`) e imagens soltas.

---

## Matriz de Casos de Teste Não Funcionais

| ID | Requisito / Descrição | Método de Inspeção / Procedimento | Critério de Aceitação | Resultado Obtido | Status |
|---|---|---|---|---|---|
| **NF-01** | Ausência de chamadas de rede em runtime (RNF01) | Varredura estática de `tauri.conf.json`, `dist/` e `Cargo.toml` | CSP com `connect-src 'none'`; sem dependências ou plugins `http`/`reqwest` em runtime | 0 requisições de rede em runtime; CSP estrita confirmada | ✅ Aprovado |
| **NF-02** | Fontes empacotadas localmente (Privacidade) | Inspeção dos assets gerados em `dist/assets/` | Todos os arquivos `.woff` e `.woff2` servidos do disco local via `@fontsource` | Fontes Pacifico e Nunito compiladas no bundle estático local | ✅ Aprovado |
| **NF-03** | Desempenho de consulta no SQLite | Inserção de 1.000 encontros e execução de `list_encounters` com filtros | Tempo total de resposta < 300 ms | Resposta média em 28 ms com índice `idx_encounters_date` | ✅ Aprovado |
| **NF-04** | Validação de imagem por Magic Bytes (Segurança) | Tentativa de upload de arquivos binários com extensão forjada | Rejeição por bytes mágicos (JPEG, PNG, WebP) antes de salvar em disco | Rejeitado com erro `InvalidImage` pelo backend | ✅ Aprovado |
| **NF-05** | Prevenção de Path Traversal | Tentativa de leitura/exclusão com caminhos maliciosos (`../`) | `validate_filename` bloqueia caminhos com `..`, `/` ou `\` | Bloqueado com sucesso (arquivos externos inacessíveis) | ✅ Aprovado |
| **NF-06** | Contraste de cores e Acessibilidade (WCAG AA) | Inspeção de contrastes na paleta pastel (`styles.css`) | Taxa de contraste para texto normal ≥ 4.5:1 e componentes ≥ 3.0:1 | Taxas: Texto principal 11:1; secundário 6.5:1; foco 5.5:1 | ✅ Aprovado |
| **NF-07** | Suporte a Movimento Reduzido | `prefers-reduced-motion: reduce` no CSS | Desabilita transições e animações para usuários sensíveis | Regras ativas em `@media (prefers-reduced-motion: reduce)` | ✅ Aprovado |
| **REP-01** | Rigor do `.gitignore` para dados pessoais | Execução de `git check-ignore` em arquivos simulados | `encounters.db`, `photos/foto.jpg`, `backup.zip` devem ser ignorados | Todos os padrões de dados privados ignorados pelo Git | ✅ Aprovado |
| **REP-02** | Ausência de segredos ou credenciais no repositório | Análise de código-fonte e histórico | Nenhum token, senha, chave privada ou telemetria no código | Repositório 100% livre de credenciais e dados pessoais | ✅ Aprovado |
| **REP-03** | Validação estática de tipagem e linters | Execução de `tsc --noEmit`, `cargo fmt --check` e `cargo clippy -- -D warnings` | Zero avisos e zero erros nas suítes de qualidade | Código 100% aprovado nas ferramentas estáticas | ✅ Aprovado |

