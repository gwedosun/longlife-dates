# Testes de API e Integração — Longlife Date (lovelog)

Documento vinculante de especificação dos testes de API e integração IPC (Tauri Commands) do **Longlife Date (lovelog)**.

## Arquitetura de Teste de API
Os testes de integração cobrem a fronteira entre as regras de negócio (`encounter_service`), o banco de dados (`repository`), o armazenamento de arquivos (`photo_store`) e o módulo de backup (`backup`).
- **Isolamento:** Cada suíte cria um banco SQLite em memória (`:memory:`) e um diretório temporário isolado por GUID para as fotos.
- **Rastreabilidade:** Cada caso de teste possui identificador único `API-xx` vinculado às regras de negócio RN01–RN12.

---

## Matriz de Casos de Teste de API

| ID | Descrição | Command / Função | Entrada | Saída Esperada | Critério de Sucesso | Status |
|---|---|---|---|---|---|---|
| **API-01** | Criar encontro sem foto | `create_encounter_cmd` / `service::create` | `{ date: "2024-02-14", location: "Cinema", description: "Filme" }` | `Ok(id)` com `photo_file = None` | Registro persiste na base com `id` gerado | ✅ Aprovado |
| **API-02** | Criar encontro com foto (RN04, RN05) | `create_encounter_cmd` / `service::create` | Dados válidos + bytes de PNG fixture | `Ok(id)` com `photo_file` preenchido | Arquivo UUID criado em `photos/` e registro no DB | ✅ Aprovado |
| **API-03** | Criar com data inválida falha rápido (RN01) | `create_encounter_cmd` | `date: "invalida"` | `Err("InvalidDate")` | Nada gravado no banco nem no disco | ✅ Aprovado |
| **API-04** | Falha de foto não deixa registro órfão (RN08) | `create_encounter_cmd` / `service::create` | Dados válidos + bytes inválidos (texto) | `Err("InvalidImage")` | 0 registros no DB e 0 arquivos no disco (atomicidade) | ✅ Aprovado |
| **API-05** | Listar em ordem cronológica (RN07) | `list_encounters_cmd(desc: false)` | 3 encontros em datas desordenadas | Lista ordenada ASC com desempate por `id` | Datas em ordem crescente | ✅ Aprovado |
| **API-06** | Listar base vazia | `list_encounters_cmd` | Banco recém-criado sem registros | `Ok([])` | Lista vazia sem exceção | ✅ Aprovado |
| **API-07** | Obter encontro inexistente | `get_encounter_cmd` | `id: 99999` | `Err("NotFound")` | Retorna erro sem crash | ✅ Aprovado |
| **API-08** | Atualizar campos de texto (RF03) | `update_encounter_cmd` | `{ id, location: "Teatro", desc: "Nova" }` | `Ok(())` | `location` e `description` alterados, `updated_at` atualizado | ✅ Aprovado |
| **API-09** | Substituir foto remove a antiga (RN06) | `update_encounter_cmd` com nova foto | `{ id, new_photo_bytes: jpg }` | `Ok(())`, novo arquivo UUID | Foto antiga removida do disco; sem arquivos órfãos | ✅ Aprovado |
| **API-10** | Atualizar sem enviar foto mantém foto existente | `update_encounter_cmd` com `new_photo = None` | `{ id, location: "Novo", new_photo: None }` | `Ok(())`, `photo_file` mantido | Arquivo original de foto preservado | ✅ Aprovado |
| **API-11** | Excluir encontro com foto (RN06, RN09) | `delete_encounter_cmd` | `id` existente com foto | `Ok(())` | Registro apagado do SQLite e arquivo apagado do disco | ✅ Aprovado |
| **API-12** | Excluir encontro inexistente | `delete_encounter_cmd` | `id: 99999` | `Err("NotFound")` | Retorna erro sem afetar outros registros | ✅ Aprovado |
| **API-13** | Leitura de foto em Base64 | `read_photo_cmd` | `filename: "<uuid>.png"` existente | String Base64 correspondente | Decodificação reproduz os bytes exatos do arquivo | ✅ Aprovado |
| **API-14** | Bloqueio de leitura por Path Traversal | `read_photo_cmd` | `filename: "../../../etc/passwd"` | `Err("InvalidImage")` | Nenhuma leitura fora do diretório `photos/` | ✅ Aprovado |
| **API-15** | Exportar e importar backup (RN10, RN11) | `export_backup_cmd` + `import_backup_cmd` | Base com 2 encontros e fotos | JSON exportado restaurado em nova base | Todos os encontros e fotos restaurados integralmente | ✅ Aprovado |
| **API-16** | Apagar todos os dados / Excluir conta (RN12) | `delete_all_data_cmd` | Base populada com encontros e fotos | `Ok(())` | SQLite limpo (`0` registros), sequence resetada e pasta de fotos vazia | ✅ Aprovado |

---

## Resultados da Validação
- **Suíte de Testes Rust (commands e service):** 40/40 testes aprovados.
- **Detecção de vazamento de arquivos órfãos:** 100% de sucesso na remoção e integridade referencial de fotos.
- **Restauração de Backup:** Round-trip de serialização/desserialização JSON verificado e aprovado.

