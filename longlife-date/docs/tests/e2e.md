# Testes End-to-End (E2E) — Longlife Date (lovelog)

Documento vinculante de especificação dos testes de ponta a ponta (E2E) do **Longlife Date (lovelog)**, validados na interface WebView integrada com o runtime Tauri 2.

## Pré-condições do Ambiente de Teste E2E
- **Isolamento de Dados:** Os testes são executados com a variável de ambiente `LONGLIFE_DATA_DIR` apontando para um diretório temporário limpo em cada execução de cenário.
- **Automação:** WebdriverIO + `tauri-driver` (Edge WebDriver no Windows / WebKit WebDriver no Linux).
- **Sem Rede:** Execução em modo de rede desabilitada (ou simulando offline).

---

## Matriz de Casos de Teste E2E

| ID | Cenário / Descrição | Passos de Execução | Dados de Entrada | Resultado Esperado | Critério de Aceitação | Status |
|---|---|---|---|---|---|---|
| **E2E-01** | Estado Inicial / Vazio | 1. Iniciar app em diretório limpo<br>2. Observar a tela inicial | N/A | Exibe mensagem *"Registre o primeiro encontro de vocês 💕"* | Texto visível no DOM, lista sem cards | ✅ Aprovado |
| **E2E-02** | Criar encontro completo com foto | 1. Preencher data, local e descrição<br>2. Anexar foto válida<br>3. Clicar em "Salvar" | Data: `14/02/2024`<br>Local: `Parque`<br>Foto: `fixture.png` | Card aparece com data, local, foto e descrição | Estrutura correta: topo (data+local), centro (foto), base (descrição + botões) | ✅ Aprovado |
| **E2E-03** | Validação de formulário na UI | 1. Deixar campo "Local" vazio<br>2. Clicar em "Salvar" | Data: `14/02/2024`<br>Local: `""` | Alerta exibido: *"Local é obrigatório."* | Submit bloqueado, nenhum card inserido | ✅ Aprovado |
| **E2E-04** | Linha do tempo e alternador de ordem (RN07) | 1. Cadastrar 3 encontros em datas distintas<br>2. Verificar ordem crescente<br>3. Clicar no botão de alternância | `10/01/2024`<br>`01/03/2024`<br>`25/12/2023` | Inicialmente: 2023 → Jan/2024 → Mar/2024.<br>Após toggle: Mar/2024 → Jan/2024 → 2023 | Reordenação instantânea na UI | ✅ Aprovado |
| **E2E-05** | Edição de encontro existente (Prioridade Máxima) | 1. Localizar card na timeline<br>2. Clicar no botão "✏️ editar"<br>3. Modificar local para "Teatro Municipal"<br>4. Clicar em "Atualizar encontro" | Local: `Teatro Municipal` | Formulário entra em modo edição com banner e botão "Atualizar"; após salvar, card reflete o novo local | Banco e interface sincronizados sem recarregar tela | ✅ Aprovado |
| **E2E-06** | Trocar foto do encontro na edição | 1. Clicar em "✏️ editar" em card existente<br>2. Selecionar novo arquivo de imagem<br>3. Clicar em "Atualizar encontro" | Imagem: `nova_foto.jpg` | Foto antiga é substituída no card e excluída do disco (sem órfãos) | Imagem atualizada visualmente; RN06 respeitada | ✅ Aprovado |
| **E2E-07** | Cancelamento de edição | 1. Clicar em "✏️ editar"<br>2. Clicar no botão "Cancelar edição" | N/A | Formulário limpa campos, banner de edição fecha e botão volta a ser "Salvar" | Estado original inalterado | ✅ Aprovado |
| **E2E-08** | Exclusão com confirmação (RN09) | 1. Clicar no botão "🗑️ apagar"<br>2. Cancelar o diálogo de confirmação<br>3. Clicar em "🗑️ apagar" e confirmar | Diálogo `window.confirm` | Cancelar mantém o card intacto; confirmar remove o card da lista imediatamente | Card removido e foto excluída de `photos/` | ✅ Aprovado |
| **E2E-09** | Persistência entre reinicializações | 1. Criar encontro<br>2. Fechar o processo do aplicativo<br>3. Reabrir o executável | Encontro com foto | O encontro e a foto continuam presentes na timeline exatamente como estavam | Banco de dados `encounters.db` mantém integridade | ✅ Aprovado |
| **E2E-10** | Operação 100% Offline (RNF01) | 1. Desconectar adaptadores de rede do SO<br>2. Abrir o aplicativo<br>3. Executar fluxos de criação, edição e exclusão | N/A | Todas as telas carregam normalmente, fontes locais funcionam, 0 erros | Nenhuma requisição bloqueada ou pendente | ✅ Aprovado |
| **E2E-11** | Exportação e restauração de backup (RN10, RN11) | 1. Clicar em "Exportar backup"<br>2. Apagar todos os dados<br>3. Importar o arquivo exportado e digitar "SUBSTITUIR" | Arquivo `lovelog-backup-*.json` | Timeline volta a exibir todos os encontros e fotos idênticos ao estado inicial | Restauração fiel dos dados | ✅ Aprovado |

