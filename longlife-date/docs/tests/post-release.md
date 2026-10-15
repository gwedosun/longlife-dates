# Testes Pós-Lançamento (Smoke Tests) — Longlife Date (lovelog)

Documento vinculante de validação de aceitação e testes de fumaça (*smoke tests*) do executável final empacotado do **Longlife Date (lovelog)** no sistema operacional Windows.

## Escopo de Validação em Produção
Validação prática executada no instalador final gerado pelo Tauri 2 (`.exe` NSIS ou executável standalone):
- Integridade do binário final (tamanho, assinatura e ausência de dependências externas).
- Comportamento de inicialização no Windows 10/11.
- Operação em diretório real de usuário (`%APPDATA%`).

---

## Matriz de Smoke Tests Pós-Lançamento

| ID | Descrição do Teste | Procedimento de Verificação | Critério de Aceitação | Resultado Obtido | Status |
|---|---|---|---|---|---|
| **SMK-01** | Integridade e tamanho mínimo do executável | Inspecionar propriedades do executável `.exe` gerado | Tamanho do arquivo > 1 MB (impede publicação de stubs vazios) | Executável final possui ~10 MB, completo e auto-contido | ✅ Aprovado |
| **SMK-02** | Inicialização limpa no Windows 10 / 11 | Executar o instalador / `.exe` em máquina limpa | Janela abre sem mensagens de erro de DLLs ausentes (WebView2 / VCRuntime) | Inicialização instantânea da janela nativa do WebView | ✅ Aprovado |
| **SMK-03** | Comportamento do Windows SmartScreen | Executar binário não assinado digitalmente | Exibe aviso azul *"O Windows protegeu o computador"*, permitindo *"Mais informações"* → *"Executar assim mesmo"* | Comportamento padrão de binários de código aberto; documentado no RELEASE.md | ✅ Aprovado |
| **SMK-04** | Criação do diretório de dados em `%APPDATA%` | Iniciar o app e verificar diretório `%APPDATA%\com.longlifedate.app\` | Criação automática da pasta base, de `photos/` e do banco `encounters.db` | Diretório estruturado corretamente em disco local | ✅ Aprovado |
| **SMK-05** | Fluxo CRUD completo no executável de produção | 1. Criar encontro com foto<br>2. Clicar em "✏️ editar"<br>3. Alterar dados e salvar<br>4. Excluir encontro | Edição e persistência funcionam perfeitamente na interface nativa | Fluxo completo sem erros de console ou travamento | ✅ Aprovado |
| **SMK-06** | Alternância de ordenação cronológica | Clicar no botão "⬆️ Antigos primeiro (ASC)" / "⬇️ Recentes primeiro (DESC)" | Cards alternam a ordem cronológica instantaneamente | Reordenação visual em runtime confirmada | ✅ Aprovado |
| **SMK-07** | Exportação e restauração de backup | Clicar em "Exportar backup", salvar arquivo `.json`, apagar dados e restaurar | Todos os encontros e fotos são recarregados com sucesso | Backup e recuperação 100% funcionais | ✅ Aprovado |
| **SMK-08** | Desinstalação e limpeza de dados | Desinstalar via *Configurações > Aplicativos > Aplicativos instalados* | Remove o executável e atalhos; arquivos de usuário em `%APPDATA%` preservados ou removíveis sob demanda | Desinstalação padrão NSIS executada com sucesso | ✅ Aprovado |

---

## Orientações para o Usuário Final
Conforme documentado no `docs/RELEASE.md`:
- O app é 100% local e seguro. O alerta do SmartScreen ocorre porque o projeto é open source e não utiliza certificado digital corporativo pago (EV Code Signing).
- Para fazer backup antes de desinstalar ou formatar o computador, utilize o botão **"Exportar backup (.json)"** na seção de Backup do aplicativo.

