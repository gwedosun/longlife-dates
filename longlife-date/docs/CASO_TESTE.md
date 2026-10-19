# Planejamento, Requisitos, Histórias de Usuário e Casos de Teste

- **Projeto:** Longlife Date (Lovelog) — Aplicativo Desktop Offline de Registro de Encontros
- **Autora:** Gabriella Braga
- **Disciplina:** Teste de Software (GPE01M30025) — Prof. Samuel Novais Moura Júnior
- **Repositório:** `https://github.com/gwedosun/longlife-dates`

---

## 1. Requisitos e Regras de Negócio

### 1.1 Requisitos Funcionais

| ID | Requisito | Prioridade |
|---|---|:---:|
| **RF01** | Criar encontro com data, local, descrição e foto. | Alta |
| **RF02** | Listar encontros em ordem cronológica. | Alta |
| **RF03** | Editar encontro existente. | Alta |
| **RF04** | Excluir encontro. | Alta |
| **RF05** | Salvar foto em pasta local. | Alta |
| **RF06** | Exibir cards com data/local no topo, foto ao centro e descrição na base. | Alta |
| **RF07** | Persistir dados em SQLite local. | Alta |
| **RF08** | Deletar conta. | Alta |

---

### 1.2 Requisitos Não Funcionais

| ID | Requisito | Prioridade |
|---|---|:---:|
| **RNF01** | Nenhuma requisição de rede (exceto fontes Google ou fontes empacotadas localmente via `@fontsource`). | Alta |
| **RNF02** | Custo zero de infraestrutura. | Alta |
| **RNF03** | Executável `.exe` leve e rápido. | Alta |
| **RNF04** | Paleta de cores em tons pastel. | Alta |
| **RNF05** | Títulos/datas em fontes cursivas; corpo em sans-serif/mono. | Alta |
| **RNF06** | `.gitignore` rigoroso para SQLite, fotos e outros. | Alta |
| **RNF07** | Código aberto em repositório do GitHub. | Alta |

---

### 1.3 Regras de Negócio

| ID | Requisito |
|---|---|
| **RN01** | Data obrigatória nos encontros, em formato ISO `YYYY-MM-DD`. |
| **RN02** | A data não pode ser futura. |
| **RN03** | Cada encontro possui exatamente 1 foto; JPEG, PNG, WebP; até 10 MB; a foto é compactada para WebP. |
| **RN04** | A foto é copiada para `photos/` com nome UUID; o original do usuário não é alterado. |
| **RN05** | Location obrigatória, até 150 caracteres. |
| **RN06** | Descrição obrigatória, até 1200 caracteres. |
| **RN07** | Linha do tempo em ordem cronológica crescente; desempate por `id`; alterável para decrescente. |
| **RN08** | Se o insert no banco falhar, a foto copiada é removida. |
| **RN09** | Excluir exige confirmação na UI. |
| **RN10** | É possível exportar todos os dados. |
| **RN11** | É possível deletar a conta permanentemente; deletar conta exige confirmação na UI. |

---

## 2. Histórias de Usuário

### HU01 — Cadastrar encontro
Como usuário, quero cadastrar um encontro com data, local, descrição e foto, para registrar a memória.

**Critérios de Aceitação:**
- **CA01:** O formulário exige data, local, descrição.
- **CA02:** A foto é opcional, mas limitada a 1 imagem.
- **CA03:** Após salvar, o encontro aparece na linha do tempo.
- **CA04:** A data não pode ser futura.

```gherkin
Cenário: Cadastro válido de encontro
  Dado que eu estou na tela de novo encontro
  Quando preencho data "2026/09/09", local "Parque Olhos D'Água", descrição "Caminhada noturna com meu namorado" e anexo uma foto
  E clico em "Salvar"
  Então o encontro é persistido no SQLite
  E a foto é salva na pasta local
  E o card aparece na linha do tempo

Cenário: Cadastro com data futura
  Dado que estou na tela de novo encontro
  Quando preencho data "2028/02/20", local "Praia de Copacabana", descrição "Futuro"
  E clico em "Salvar"
  Então vejo a mensagem "Erro! A data não pode ser futura"
  E o encontro não é salvo
```

---

### HU02 — Visualizar linha do tempo
Como usuário, quero ver todos os encontros em ordem cronológica, para reviver as memórias.

**Critérios de Aceitação:**
- **CA01:** Os cards são exibidos em ordem crescente de data.
- **CA02:** Cada card mostra data/local no topo, foto ao centro, descrição na base.
- **CA03:** A lista é rolável.

```gherkin
Cenário: Linha do tempo ordenada
  Dado que existem encontros cadastrados em datas distintas
  Quando abro a tela inicial
  Então vejo os cards ordenados da data mais antiga para a mais recente
  E cada card segue a estrutura data, local, descrição e foto
```

---

### HU03 — Editar encontro
Como usuário, quero editar um encontro, para corrigir ou complementar informações.

**Critérios de Aceitação:**
- **CA01:** Posso alterar data, local, descrição e foto.
- **CA02:** A data continua não podendo ser futura.
- **CA03:** As alterações refletem no card imediatamente.

```gherkin
Cenário: Edição de descrição de encontro
  Dado que existe um encontro cadastrado
  Quando clico em "Editar"
  E altero a descrição para "Caminhada diurna com meu namorado"
  E clico em salvar
  Então o card exibe a nova descrição
  E o banco é atualizado.
```

---

### HU04 — Excluir encontro
Como usuário, quero excluir um encontro, para remover registros indesejados.

**Critérios de Aceitação:**
- **CA01:** A exclusão pede confirmação.
- **CA02:** A foto associada é removida da pasta local.
- **CA03:** O card desaparece da linha do tempo.

```gherkin
Cenário: Excluir encontro
  Dado que existe um encontro cadastrado
  Quando clico em excluir
  E confirmo a ação
  Então o encontro é removido do SQLite
  E a foto é apagada da pasta local
  E o card some da linha do tempo
```

---

### HU05 — Excluir conta
Como usuário, quero remover meus dados do software quando quiser, para proteger minha privacidade.

**Critérios de Aceitação:**
- **CA01:** A exclusão de conta pede confirmação.
- **CA02:** Todos os dados associados são removidos da pasta local.
- **CA03:** Ao reiniciar, o app exibe a tela inicial sem dados.

```gherkin
Cenário: Exclusão de conta
  Dado que tenho uma conta no Longlife Date
  Quando clico em "Excluir conta"
  E clico em "Confirmar"
  Então todos os dados são removidos do SQLite
  E todos os dados são removidos da pasta local
  E o app exibe a tela inicial
```

---

## 3. Casos de Teste Documentados (Seção 6)

> **Nota sobre o Escopo de Testes:** Para fins de maior praticidade na leitura e correção acadêmica do trabalho final (`TRABALHO GINAL.docx`), as tabelas abaixo exibem o recorte representativo dos casos de teste de cada categoria (`UT01` a `UT11`, `API01` a `API06`, `E2E01` a `E2E08` e não funcionais). No código-fonte do repositório, a suíte automatizada completa executa **40 testes no Backend Rust** (`service`, `photo_store`, `repository`, `encounter_service`, `backup`) e **33 testes no Frontend TypeScript** (`date.test.ts`, `form.test.ts`, `store.test.ts`, `card.test.ts`), totalizando **73 testes automatizados** com evidências reais consolidadas em [`docs/tests/EVIDENCIAS_DE_TESTES.md`](tests/EVIDENCIAS_DE_TESTES.md).

---

### 3.1 Casos de Teste Unitários (`UT01` a `UT11`)

- **Arquivos de teste reais no repositório:**
  - Backend Rust: `longlife-date/src-tauri/src/service.rs`, `longlife-date/src-tauri/src/photo_store.rs`, `longlife-date/src-tauri/src/repository.rs`, `longlife-date/src-tauri/src/encounter_service.rs`, `longlife-date/src-tauri/src/backup.rs`
  - Frontend TypeScript: `longlife-date/src/domain/date.test.ts`, `longlife-date/src/domain/form.test.ts`, `longlife-date/src/state/store.test.ts`, `longlife-date/src/views/card.test.ts`

| ID | Descrição | Passos | Entrada | Saída Esperada |
|---|---|---|---|---|
| **UT01** | Validação de data válida (RN01) | Invocar `validate_date` com datas de ano bissexto. | `"2024-02-29"` | Retorno `Ok(())` para ambas. |
| **UT02** | Rejeição de data inexistente no calendário (RN01) | Invocar `validate_date` com dia inexistente em ano não bissexto. | `"2023-02-29"` | Retorno `Err(DomainError::InvalidDate)` / `Err(AppError::InvalidDate)`. |
| **UT03** | Rejeição de local vazio ou apenas espaços (RN05) | Invocar `validate_location` passando string composta por espaços. | `"                         "` | Retorno `Err(DomainError::InvalidLocation)` / `Err(AppError::InvalidLocation)`. |
| **UT04** | Limite de caracteres no local (RN05) | Invocar `validate_location` acima do limite permitido. | `"a".repeat(151)` (ou `121`) | Retorno `Err(DomainError::InvalidLocation)` / `Err(AppError::InvalidLocation)`. |
| **UT05** | Validação de descrição opcional e limite de caracteres (RN06) | Invocar `validate_description` com string vazia e acima do limite. | `" "` e string acima do limite | Retorno `Ok(())` e `Err(DomainError::InvalidDescription)` / `Err(AppError::DescriptionTooLong)`. |
| **UT06** | Rejeição de imagem acima do limite de 10 MB (RN07) | Invocar `validate_image_size` com tamanho de 10 MB mais 1 byte. | `10 * 1024 * 1024 + 1` bytes | Retorno `Err(DomainError::ImageTooLarge)` / `Err(AppError::ImageTooLarge)`. |
| **UT07** | Rejeição de violação de restrição CHECK no SQLite | Executar `INSERT` SQL direto com data fora do padrão GLOB. | `date = "abc"` em banco `:memory:` | Retorno `Err(rusqlite::Error::SqliteFailure)` / `Err(AppError::Database)`. |
| **UT08** | Bloqueio de path traversal na resolução de caminho de foto | Invocar validação de caminho de foto com sequências de navegação de diretório. | `"../../longlife.db"` | Retorno `Err(DomainError::InvalidFileName)` / `Err(AppError::InvalidImage)`. |
| **UT09** | Escape de HTML na descrição contra injeção XSS | Invocar `renderCard` passando descrição com tag `<script>`. | `description: "<script>alert(1)</script>"` | Texto literal escapado no parágrafo e zero elementos `<script>` no DOM. |
| **UT10** | Busca unitária de encontros por termo na descrição | Invocar listagem/busca filtrada passando palavra contida apenas em `description`. | Termo `"piquenique"` em base com 3 registros | Lista contendo apenas o encontro que menciona `"piquenique"` na descrição. |
| **UT11** | Limpeza integral de dados na exclusão da conta | Invocar `delete_all_data` / `wipe_account_data` sobre banco e diretório `photos/` populados. | Base com 3 encontros e 2 fotos salvas | Tabela `encounters` com 0 linhas e diretório `photos/` vazio. |

---

### 3.2 Casos de Teste de API / Integração (`API01` a `API06`)

- **Arquivos deimplementação e teste no repositório:**
  - `longlife-date/src-tauri/src/commands.rs`, `longlife-date/src-tauri/src/encounter_service.rs`, `longlife-date/src-tauri/src/backup.rs`

| ID | Descrição | Passos | Entrada | Saída Esperada |
|---|---|---|---|---|
| **API01** | Criar encontro válido com foto anexada (RF01) | Invocar `create_encounter` fornecendo bytes/caminho de fixture PNG válida. | `{ date: "2024-03-10", location: "Parque", description: "", photo_path: "valid.png" }` | `Encounter` persistido com `photoFile` preenchido com `<uuid>.png`. |
| **API02** | Listar encontros respeitando o parâmetro de organização (RF02) | Criar 3 encontros fora de ordem e chamar `list_encounters` com `asc` e `desc`. | Datas `2024-05-01`, `2024-01-01`, `2024-03-01` | Listas ordenadas em sequência crescente e decrescente conforme o parâmetro. |
| **API03** | Rejeitar criação de encontro com dados inválidos | Invocar `create_encounter` com data malformada e foto válida. | `{ date: "2023-02-29", location: "Praia", description: "", photo_path: "valid.png" }` | Retorno `Err("InvalidDate")` sem gravar foto órfã. |
| **API04** | Atualizar campos de um encontro existente (RF03) | Criar encontro e invocar `update_encounter` alterando local e descrição. | `{ id: 1, location: "Teatro Municipal", description: "Ópera" }` | `Encounter` atualizado com novos textos e `updatedAt` renovado. |
| **API05** | Excluir encontro com foto removendo arquivo físico (RF04) | Criar encontro com foto e invocar `delete_encounter` com seu `id`. | `{ id: 1 }` | Retorno `Ok(())`, registro ausente no SQLite e foto removida de `photos/`. |
| **API06** | Excluir conta removendo banco e diretório de fotos (RF08) | Popular base com encontros e fotos e invocar `delete_all_data` / `delete_account`. | Chamada sem argumentos `delete_account()` | Retorno `Ok(())`, `list_encounters` vazio e pasta `photos/` sem arquivos. |

---

### 3.3 Casos de Teste End-to-End (`E2E01` a `E2E08`)

| ID | Descrição | Passos | Entrada | Saída Esperada |
|---|---|---|---|---|
| **E2E01** | Exibição do estado vazio no primeiro acesso | Iniciar a aplicação com `LONGLIFE_DATA_DIR` apontando para diretório vazio. | Diretório de dados limpo | Página inicial sem nenhum registro de encontro (exibe mensagem de estado vazio). |
| **E2E02** | Criação completa de encontro com foto pela UI (RF01) | Preencher data, local, descrição, adicionar foto corretamente e clicar em "Salvar". | Data `10/05/2026`, Local `Cinema`, Descrição `Primeiro filme`, `valid.jpg` | Card surge na timeline com data e local no topo, foto no centro e descrição abaixo. |
| **E2E03** | Edição de encontro existente pela UI (RF03) | Clicar no botão Editar do card, alterar o local e a descrição e acionar "Salvar". | Novo local `Teatro Municipal`, nova descrição `Espetáculo noturno` | O card na timeline reflete imediatamente o novo local e a nova descrição. |
| **E2E04** | Exclusão de encontro mediante confirmação no diálogo | Clicar no botão Apagar do card e acionar o botão "Ok" no diálogo modal. | Confirmação no modal | O card é removido da linha do tempo. |
| **E2E05** | Funcionamento integral em modo estritamente offline | Executar os fluxos de criação, edição, listagem e exclusão com interface de rede desativada. | Ambiente de execução sem conectividade de rede | Todas as operações CRUD e fontes tipográficas funcionam sem falhas ou atrasos. |
| **E2E06** | Alternância de ordenação crescente e decrescente na UI | Alternância de ordenação crescente e decrescente na UI (RN07). | Clique no seletor de ordenação (Crescente / Decrescente) | A ordem dos cards no DOM inverte imediatamente para decrescente e retorna ao clicar novamente. |
| **E2E07** | Cancelamento de confirmação de exclusão de encontro e de conta | Clicar em "Apagar todos os dados", clicar em "Ok" no primeiro aviso e "Cancelar" no segundo aviso. | Clique no botão "Cancelar" nos diálogos de confirmação | Os modais fecham e todos os cards e dados permanecem inalterados na timeline. |
| **E2E08** | Exclusão permanente de conta com retorno ao estado inicial | Clicar em "Excluir conta" / "Apagar todos os dados", confirmar a ação no modal de segurança e observar a tela. | Confirmação positiva no diálogo de exclusão de conta | Todos os cards somem e a tela de estado vazio é restaurada. |

---

### 3.4 Casos de Teste Não Funcionais, Repositório e Segurança (`NF01`, `NF02`, `REP01`, `SEG01`)

| ID | Descrição | Passos | Entrada | Saída Esperada |
|---|---|---|---|---|
| **NF01** | Conformidade da política CSP restritiva e ausência de plugins de rede | Inspecionar `tauri.conf.json`, `Cargo.toml` e artefatos JS gerados no bundle de produção. | Arquivos de configuração e diretório `dist/` | Diretiva `connect-src 'none'` ativa, ausência de plugin `http` e zero URLs externas no bundle. |
| **NF02** | Desempenho de listagem com volume de 1.000 encontros | Inserir 1.000 registros sintéticos no SQLite e cronometrar a execução de `list_encounters`. | Base SQLite populada com 1.000 encontros | Retorno completo dos 1.000 registros em tempo inferior a 300 ms. |
| **REP01** | Verificação automatizada das regras de proteção do `.gitignore` | Simular caminhos `longlife.db`, `photos/a.jpg`, `backup.zip` e `src/assets/logo.png` via `git check-ignore`. | Lista de caminhos sensíveis e caminhos de ativos permitidos | Arquivos `.db`, `photos/*` e `.zip` ignorados; ativos de código permitidos. |
| **SEG01** | Auditoria de segredos e dados sensíveis no histórico com `gitleaks` | Executar `gitleaks detect --no-git` sobre toda a árvore de diretórios do projeto. | Código-fonte, testes e documentação do repositório | Relatório final indicando zero vazamentos ou credenciais detectadas. |

