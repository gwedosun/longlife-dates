# Testes Unitários (UT) — Longlife Date (lovelog)

Documento vinculante de especificação e rastreabilidade dos testes unitários do **Longlife Date (lovelog)**, cobrindo o backend Rust (`service`, `photo_store`, `repository`, `encounter_service`) e o frontend TypeScript (`date.ts`, `form.ts`, `card.ts`, `store.ts`).

## Metodologia e Isolamento
- **Backend (Rust):** Executado via `cargo test` no crate `longlife-date`. Repositório utiliza SQLite em memória (`:memory:`) e armazenamento de fotos em diretório temporário isolado por teste (`tempfile`/`Uuid`).
- **Frontend (TypeScript):** Executado via `vitest` com ambiente `jsdom` e cobertura `@vitest/coverage-v8`. Funções de domínio puras e renderização de componentes com DOM simulado.
- **Rastreabilidade:** Cada caso possui ID canônico mapeado diretamente no código com comentários de rastreabilidade (ex.: `// UT-01`).

---

## Matriz de Casos de Teste Unitários

| ID | Descrição | Módulo / Componente | Entrada / Pré-condição | Saída Esperada | Status |
|---|---|---|---|---|---|
| **UT-01** | Data válida aceita (RN01) | `domain::date::validate_date` (Rust) | `"2024-02-29"` (ano bissexto) | `Ok(())` | ✅ Aprovado |
| **UT-02** | Data inexistente rejeitada | `domain::date::validate_date` (Rust) | `"2023-02-29"` | `Err(AppError::InvalidDate)` | ✅ Aprovado |
| **UT-03** | Formato inválido rejeitado | `domain::date::validate_date` (Rust) | `"14/02/2024"`, `""` | `Err(AppError::InvalidDate)` | ✅ Aprovado |
| **UT-04** | Local vazio ou com espaços rejeitado (RN02) | `domain::location::validate_location` (Rust) | `"   "`, `""` | `Err(AppError::InvalidLocation)` | ✅ Aprovado |
| **UT-05** | Local é trimado e tem limite de 120 caracteres | `domain::location::validate_location` (Rust) | `" Praia "`; string com 121 caracteres | `"Praia"`; `Err(AppError::InvalidLocation)` | ✅ Aprovado |
| **UT-06** | Descrição > 5000 caracteres rejeitada (RN03) | `domain::description::validate_description` (Rust) | 5001 caracteres; 5000 caracteres | `Err(AppError::DescriptionTooLong)`; `Ok(())` | ✅ Aprovado |
| **UT-07** | Magic bytes JPEG/PNG/WebP aceitos (RN04) | `photo_store::detect_image_type` (Rust) | Fixtures com assinaturas válidas | `Ok(ImageType::Jpeg / Png / Webp)` | ✅ Aprovado |
| **UT-08** | Arquivo falso com extensão renomeada rejeitado | `photo_store::detect_image_type` (Rust) | Arquivo de texto renomeado para `.jpg` | `Err(AppError::InvalidImage)` | ✅ Aprovado |
| **UT-09** | Imagem > 10 MB rejeitada (RN04) | `photo_store::validate_image_size` (Rust) | 10 MB + 1 byte (10.485.761 bytes) | `Err(AppError::ImageTooLarge)` | ✅ Aprovado |
| **UT-10** | Repositório insere e consulta registro | `repository::insert_encounter` e `get_encounter` | Encontro válido em `:memory:` | Registro persistido idêntico, com `id` gerado | ✅ Aprovado |
| **UT-11** | Listagem ordenada ASC com desempate por id (RN07) | `repository::list_encounters(Order::Asc)` | Encontros nas datas `2024-03-01`, `2024-01-10` (id 2), `2024-01-10` (id 3) | Ordem: `2024-01-10` (id 2), `2024-01-10` (id 3), `2024-03-01` | ✅ Aprovado |
| **UT-12** | Listagem ordenada DESC | `repository::list_encounters(Order::Desc)` | Mesmos registros de UT-11 | Ordem decrescente exata | ✅ Aprovado |
| **UT-13** | Restrições SQLite CHECK no schema | `repository::migrate` / DDL SQLite | Insert manual com data fora do padrão GLOB | Falha de integridade `CHECK constraint failed` | ✅ Aprovado |
| **UT-14** | Migração do banco idempotente | `repository::migrate` | Chamada repetida no mesmo banco | `Ok(())`, `user_version = 1`, 1 única tabela criada | ✅ Aprovado |
| **UT-15** | Foto copiada com nome UUID seguro (RN05) | `photo_store::save_photo` | Bytes de imagem válidos | Arquivo gravado em `<tmp>/<uuid>.<ext>`, original intocado | ✅ Aprovado |
| **UT-16** | Exclusão de foto idempotente (RN06) | `photo_store::delete_photo` | Nome de arquivo existente; nome inexistente | Arquivo removido com sucesso; inexistente não falha | ✅ Aprovado |
| **UT-17** | Bloqueio de Path Traversal | `photo_store::validate_filename` | `"../../longlife.db"`, `"/etc/passwd"` | `Err(AppError::InvalidImage)` | ✅ Aprovado |
| **UT-18** | Formatação de data PT-BR por extenso | `src/domain/date.ts` (`formatDate`) | `"2024-02-14"` | `"14 de fevereiro de 2024"` sem erros de fuso horário | ✅ Aprovado |
| **UT-19** | Contador de dias juntos | `src/domain/date.ts` (`daysSince`) | `"2024-01-01"`, `"2024-01-11"` | `10` dias exatos | ✅ Aprovado |
| **UT-20** | Renderização do Card na estrutura oficial | `src/views/card.ts` (`renderCard`) | Encontro com foto | DOM ordenado: header(data + local) → img(.card-photo) → footer(descrição + botões) | ✅ Aprovado |
| **UT-21** | Placeholder para encontro sem foto | `src/views/card.ts` (`renderCard`) | `photoFile: null` | Exibe `.photo-placeholder`, nenhum elemento `<img>` criado | ✅ Aprovado |
| **UT-22** | Prevenção contra XSS na descrição | `src/views/card.ts` (`renderCard`) | Descrição: `<script>alert('xss')</script>` | Texto inserido via `textContent`, sem nó de script executável | ✅ Aprovado |
| **UT-23** | Validação de formulário frontend (RN01–RN04) | `src/domain/form.ts` (`validateForm`) | Local vazio; data inexistente; foto > 10MB | `valid: false` com mensagens de erro inline descritivas | ✅ Aprovado |
| **UT-24** | Ação do botão ✏️ Editar no card | `src/views/card.ts` (`renderCard`) | Clique no botão `.btn-edit` | Dispara callback `onEdit(encounter)` | ✅ Aprovado |
| **UT-25** | Ação do botão 🗑️ Apagar no card | `src/views/card.ts` (`renderCard`) | Clique no botão `.btn-delete` | Dispara callback `onDelete(encounter)` | ✅ Aprovado |
| **UT-26** | Gerenciador de estado reativo (Store) | `src/state/store.ts` (`EncounterStore`) | `setEncounters`, `setLoading`, `setError` | Dispara callbacks para todos os inscritos | ✅ Aprovado |
| **UT-27** | Parsing e validação de data BR | `src/domain/date.ts` (`parseBrDate`) | `"29/02/2024"`, `"29/02/2023"` | `{ ok: true, iso: "2024-02-29" }`; `{ ok: false, error: "nonexistent" }` | ✅ Aprovado |

---

## Resultados da Execução
- **Rust Unit Tests:** 40 testes aprovados, 0 falhas (`finished in 0.04s`).
- **Vitest Unit Tests:** 33 testes aprovados, 0 falhas (`finished in 2.18s`).
- **Cobertura de Linhas Frontend:** **99.25%** global (meta mínima: 80%).

