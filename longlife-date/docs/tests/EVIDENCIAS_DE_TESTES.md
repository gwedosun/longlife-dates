# Relatório de Execução e Evidências de Testes

- **Projeto:** Longlife Date (Lovelog) — Aplicativo Desktop Offline de Registro de Encontros
- **Autora:** Gabriella Braga
- **Disciplina:** Teste de Software (GPE01M30025) — Prof. Samuel Novais Moura Júnior
- **Repositório:** `https://github.com/gwedosun/longlife-dates`
- **Data da Regeneração das Evidências:** 19/10/2026

---

## Sumário Executivo de Resultados (Seção 9.1)

Todos os testes automatizados, linters estáticos, verificadores de tipos e builds de produção foram executados e aprovados com **100% de sucesso**.

| Suíte | Ferramenta | Total de Testes | Aprovados | Falhas | Cobertura / Status |
|---|---|:---:|:---:|:---:|---|
| **Backend Rust — Unitários e Integração** | `cargo test` | 40 | 40 | 0 | 100% aprovado (`0.07s`) |
| **Frontend TypeScript — Unitários e DOM** | `vitest` (`jsdom`) | 33 | 33 | 0 | 100% aprovado (`3.47s`) |
| **Cobertura de Código Frontend** | `@vitest/coverage-v8` | 4 arquivos (`date.ts`, `form.ts`, `store.ts`, `card.ts`) | - | - | **99,25% de linhas** (Meta: $\ge 80\%$) |
| **Checagem de Tipos TypeScript** | `tsc --noEmit` (`npm run lint`) | - | - | - | **Zero erros** |
| **Linter do Backend Rust** | `cargo clippy -- -D warnings` | - | - | - | **Zero warnings** |
| **Formatação de Código Rust** | `cargo fmt --check` | - | - | - | **100% em conformidade** |
| **Build de Produção** | `tsc && vite build` | 16 módulos | - | - | Gerado em `1.22s` (sem requisições externas) |

> **Nota sobre o Escopo de Testes (Seção 6 do Trabalho Final):** Conforme explicitado na Seção 6 do documento acadêmico (`TRABALHO GINAL.docx`), as tabelas descritivas do documento apresentam um recorte representativo (`UT01` a `UT11`, `API01` a `API06`, `E2E01` a `E2E08`, `NF01`, `NF02`, `REP01`, `SEG01`) para praticidade de correção, enquanto este relatório e os logs brutos em `docs/evidence/` registram a **execução integral da suíte automatizada** implementada no código (40 testes em Rust e 33 testes em TypeScript).

---

## Evidências Detalhadas da Execução (Seção 9.2)

Os logs brutos gerados diretamente no terminal encontram-se arquivados em `docs/evidence/`:
- `docs/evidence/01_cargo_test.txt`
- `docs/evidence/02_cargo_clippy_fmt.txt`
- `docs/evidence/03_vitest_unit.txt`
- `docs/evidence/04_vitest_coverage.txt`
- `docs/evidence/05_npm_lint.txt`
- `docs/evidence/06_npm_build.txt`
- `docs/evidence/07_gitignore_security.txt`

---

### 9.2.1 Backend Rust — Unitários e Integração (`cargo test`)

- **Diretório:** `longlife-date/src-tauri`
- **Comando:** `cargo test --manifest-path longlife-date/src-tauri/Cargo.toml` (ou `cargo test` dentro de `src-tauri/`)
- **Resultado:** `40 passed; 0 failed; 0 ignored`

```text
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.63s
     Running unittests src\lib.rs (longlife-date\src-tauri\target\debug\deps\longlife_date_lib-be337d9f123eef29.exe)

running 40 tests
test photo_store::tests::test_delete_photo_idempotent ... ok
test photo_store::tests::test_delete_photo_rejects_traversal ... ok
test photo_store::tests::test_detect_image_type_invalid ... ok
test photo_store::tests::test_detect_image_type_valid ... ok
test photo_store::tests::test_photos_dir_joins_subfolder ... ok
test backup::tests::test_import_rejects_wrong_schema_version ... ok
test backup::tests::test_import_rejects_malformed_json ... ok
test photo_store::tests::test_save_photo_rejects_non_image ... ok
test photo_store::tests::test_validate_filename_blocks_traversal ... ok
test encounter_service::tests::test_create_with_invalid_location_does_not_save_photo ... ok
test photo_store::tests::test_validate_image_size ... ok
test repository::tests::test_database_constraints ... ok
test repository::tests::test_delete_all_encounters_resets_autoincrement ... ok
test encounter_service::tests::test_create_with_invalid_photo_does_not_insert ... ok
test backup::tests::test_import_rejects_fake_photo ... ok
test encounter_service::tests::test_delete_nonexistent_returns_not_found ... ok
test encounter_service::tests::test_update_nonexistent_returns_not_found ... ok
test encounter_service::tests::test_delete_all_is_idempotent ... ok
test repository::tests::test_filter_by_date_range ... ok
test repository::tests::test_filter_by_query ... ok
test service::tests::test_validate_date_invalid_format ... ok
test service::tests::test_validate_date_nonexistent ... ok
test repository::tests::test_filter_escapes_like_wildcards ... ok
test repository::tests::test_insert_and_get ... ok
test service::tests::test_validate_date_valid ... ok
test service::tests::test_validate_description_limit ... ok
test repository::tests::test_list_encounters_asc ... ok
test service::tests::test_validate_location_empty ... ok
test repository::tests::test_list_encounters_desc ... ok
test service::tests::test_validate_location_trim_and_limit ... ok
test repository::tests::test_migrate_idempotent ... ok
test photo_store::tests::test_save_photo_happy_path ... ok
test encounter_service::tests::test_delete_removes_record_and_photo ... ok
test photo_store::tests::test_save_photo_generates_unique_names ... ok
test encounter_service::tests::test_create_with_photo_persists_both ... ok
test encounter_service::tests::test_delete_all_handles_missing_photo_file ... ok
test encounter_service::tests::test_update_without_photo_keeps_existing ... ok
test encounter_service::tests::test_update_replaces_photo ... ok
test encounter_service::tests::test_delete_all_removes_records_and_photos ... ok
test backup::tests::test_export_import_round_trip ... ok

test result: ok. 40 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.07s

     Running unittests src\main.rs (longlife-date\src-tauri\target\debug\deps\longlife_date-48f4b1d8d8f77968.exe)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests longlife_date_lib

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

---

### 9.2.2 Frontend TypeScript — Unitários (`npm test`)

- **Diretório:** `longlife-date/`
- **Comando:** `npm test`
- **Resultado:** `33 passed (33)`

```text
> lovelog@1.0.0 test
> vitest run


 RUN  v5.0.4 C:/Users/gabi_/Documents/UCB/4 QUARTO SEMESTRE/TESTE DE SOFTWARE/longlife-date/longlife-date

 ✓ src/state/store.test.ts (4 tests) 16ms
 ✓ src/domain/form.test.ts (8 tests) 17ms
 ✓ src/domain/date.test.ts (15 tests) 27ms
 ✓ src/views/card.test.ts (6 tests) 77ms

 Test Files  4 passed (4)
      Tests  33 passed (33)
   Start at  20:25:43
   Duration  3.47s (environment 96%, import 1%, tests 1%, worker 1%, transform 1%)
```

---

### 9.2.3 Frontend — Cobertura de Código (`npx vitest run --coverage`)

- **Diretório:** `longlife-date/`
- **Comando:** `npx vitest run --coverage`
- **Resultado:** **99,25% de cobertura de linhas**

```text
 RUN  v5.0.4 C:/Users/gabi_/Documents/UCB/4 QUARTO SEMESTRE/TESTE DE SOFTWARE/longlife-date/longlife-date
      Coverage enabled with v8

 ✓ src/domain/form.test.ts (8 tests) 31ms
 ✓ src/domain/date.test.ts (15 tests) 32ms
 ✓ src/state/store.test.ts (4 tests) 29ms
 ✓ src/views/card.test.ts (6 tests) 107ms

 Test Files  4 passed (4)
      Tests  33 passed (33)
   Start at  20:25:49
   Duration  2.81s (environment 87%, worker 6%, import 3%, tests 2%, transform 2%)

 % Coverage report from v8
-----------|---------|----------|---------|---------|-------------------
File       | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------|---------|----------|---------|---------|-------------------
All files  |    99.3 |    96.61 |     100 |   99.25 |                   
 domain    |   98.46 |    97.77 |     100 |   98.38 |                   
  date.ts  |     100 |      100 |     100 |     100 |                   
  form.ts  |   96.29 |    95.83 |     100 |   96.29 | 44                
 state     |     100 |      100 |     100 |     100 |                   
  store.ts |     100 |      100 |     100 |     100 |                   
 views     |     100 |    92.85 |     100 |     100 |                   
  card.ts  |     100 |    92.85 |     100 |     100 | 64                
-----------|---------|----------|---------|---------|-------------------
```

---

### 9.2.4 Análise Estática do Frontend (`npm run lint` / `npx tsc --noEmit`)

- **Diretório:** `longlife-date/`
- **Comando:** `npm run lint`
- **Resultado:** `Código de saída: 0 (sem erros de compilação ou tipagem)`

```text
> lovelog@1.0.0 lint
> tsc --noEmit
Exit code: 0
```

---

### 9.2.5 Empacotamento do Frontend (`npm run build`)

- **Diretório:** `longlife-date/`
- **Comando:** `npm run build`
- **Resultado:** Bundle estático gerado offline, sem requisições externas (`16 modules transformed`)

```text
> lovelog@1.0.0 build
> tsc && vite build

vite v8.3.3 building client environment for production...
transforming...
✓ 16 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                               0.40 kB │ gzip: 0.27 kB
dist/assets/nunito-vietnamese-700-normal-Ch8EUCfz.woff2       5.96 kB
dist/assets/nunito-vietnamese-400-normal-BHkVbP3T.woff2       6.12 kB
dist/assets/nunito-vietnamese-800-normal-D_CZYdm9.woff2       6.22 kB
dist/assets/nunito-vietnamese-700-normal-C9SQsXvj.woff        8.07 kB
dist/assets/nunito-vietnamese-400-normal-DtOtW02z.woff        8.24 kB
dist/assets/nunito-vietnamese-800-normal-Dz0hZPb5.woff        8.30 kB
dist/assets/nunito-cyrillic-400-normal-xAOo5cBP.woff2         8.46 kB
dist/assets/nunito-cyrillic-800-normal-D3igD7Kl.woff2         8.49 kB
dist/assets/nunito-cyrillic-700-normal-DP36NgGt.woff2         8.51 kB
dist/assets/pacifico-vietnamese-400-normal-CLnUcRoK.woff      8.91 kB
dist/assets/nunito-cyrillic-700-normal-DfHRUDv-.woff         10.40 kB
dist/assets/nunito-cyrillic-400-normal-D1j0u8EH.woff         10.46 kB
dist/assets/nunito-cyrillic-800-normal-DymMgApb.woff         10.46 kB
dist/assets/nunito-cyrillic-ext-700-normal-BuR0mlCG.woff2    10.98 kB
dist/assets/nunito-cyrillic-ext-400-normal-CuPM9foi.woff2    11.16 kB
dist/assets/nunito-cyrillic-ext-800-normal-B-cvGohL.woff2    11.26 kB
dist/assets/pacifico-vietnamese-400-normal-CNs27uJ4.woff2    11.33 kB
dist/assets/nunito-cyrillic-ext-700-normal-DfoqN4Gs.woff     13.87 kB
dist/assets/nunito-cyrillic-ext-800-normal-pjRatrRO.woff     14.06 kB
dist/assets/nunito-cyrillic-ext-400-normal-xaE7D4Sw.woff     14.10 kB
dist/assets/nunito-latin-ext-700-normal-BWeMsAzO.woff2       15.82 kB
dist/assets/nunito-latin-ext-400-normal-i-8OOpdj.woff2       15.88 kB
dist/assets/nunito-latin-700-normal-Dort48En.woff2           16.22 kB
dist/assets/nunito-latin-ext-800-normal-CtU8tJOV.woff2       16.28 kB
dist/assets/nunito-latin-400-normal-r8SDr6Up.woff2           16.31 kB
dist/assets/nunito-latin-800-normal-Dz8SOQK_.woff2           16.52 kB
dist/assets/pacifico-cyrillic-400-normal-BtlfDWif.woff       17.09 kB
dist/assets/nunito-latin-700-normal-OcDqTBcA.woff            19.98 kB
dist/assets/nunito-latin-400-normal-DKg4f3fz.woff            20.33 kB
dist/assets/nunito-latin-800-normal-D-J0wlBY.woff            20.36 kB
dist/assets/pacifico-cyrillic-ext-400-normal-BH1b5rOk.woff   20.86 kB
dist/assets/nunito-latin-ext-700-normal-D4woHhbd.woff        21.00 kB
dist/assets/nunito-latin-ext-400-normal-CjMJVfGn.woff        21.28 kB
dist/assets/nunito-latin-ext-800-normal-CDcxIxx8.woff        21.42 kB
dist/assets/pacifico-cyrillic-400-normal-DS5_g9Hw.woff2      22.89 kB
dist/assets/pacifico-latin-ext-400-normal-nyRvH6_c.woff      25.63 kB
dist/assets/pacifico-latin-400-normal-DArfF-vd.woff          27.10 kB
dist/assets/pacifico-cyrillic-ext-400-normal-BuyJL26e.woff2  28.82 kB
dist/assets/pacifico-latin-ext-400-normal-Ba3kv-va.woff2     31.08 kB
dist/assets/pacifico-latin-400-normal-7HIToT7q.woff2         32.28 kB
dist/assets/index-B8L7FhCL.css                               14.82 kB │ gzip: 3.42 kB
dist/assets/index-Dt64vYTL.js                                12.65 kB │ gzip: 4.77 kB

✓ built in 1.22s
```

---

### 9.2.6 Linter e Verificação de Qualidade Rust (`cargo clippy` e `cargo fmt`)

- **Diretório:** `longlife-date/src-tauri/`
- **Comando:** `cargo fmt --check` e `cargo clippy -- -D warnings`
- **Resultado:** `Código de saída: 0 (zero advertências e código 100% formatado)`

```text
=== cargo fmt --check (exit code: 0) ===

=== cargo clippy -- -D warnings (exit code: 0) ===
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 4.37s
```

---

### 9.2.7 Verificação de Proteção de Dados no `.gitignore` (`REP01`)

- **Diretório:** Raiz do repositório
- **Comando:** `git check-ignore -v longlife.db photos/a.jpg backup.zip`
- **Resultado:** Todos os caminhos sensíveis devidamente ignorados pelo Git

```text
.gitignore:4:*.db	longlife.db
.gitignore:11:**/photos/	photos/a.jpg
.gitignore:27:*.zip	backup.zip
```

---

## Registro de Bugs Encontrados e Corrigidos durante o Ciclo TDD (Seção 8.1)

| ID | Descrição | Severidade | Correção |
|---|---|:---:|---|
| **BUG01** | Fuso horário alterava datas ao exibir em PT-BR | Baixa | Adicionadas em `src/domain/date.ts` as funções `formatDate` (formatação PT-BR por extenso) e `daysSince`, operando por decomposição de string ISO e UTC sem desvios de fuso horário. |
| **BUG02** | Foto órfã permanecia no disco ao trocar imagem / validação de atualização | Média | Implementado o teste `test_update_nonexistent_returns_not_found` (junto a `test_update_replaces_photo`) em `encounter_service.rs`, assegurando retorno `AppError::NotFound` e garantindo que nenhuma foto órfã seja persistida em disco. |
| **BUG03** | Descrição com `<script>` era renderizada no card | Alta | Implementada a função `renderCard` em `src/views/card.ts` com a estrutura oficial de 3 níveis, inserção da descrição estritamente via `textContent` (proteção anti-XSS) e renderização de `.photo-placeholder` quando não houver foto. |
| **BUG04** | Botão "Editar" não renderizava no card do frontend | Alta | Criado o componente modular `src/views/card.ts` com o botão `✏️ editar`, adicionado o `#editing-banner` com botão `#cancel-edit`, implementado o pré-preenchimento dos campos e conectada a chamada de `updateEncounter` no submit do formulário quando em modo de edição. |
| **BUG05** | Falta de validação prévia de tamanho e formato do arquivo anexado | Média | Criado o módulo `src/domain/form.ts` com a função `validateForm`, validando localmente o limite de 10 MB (`MAX_PHOTO_BYTES`) e tipos MIME (`image/jpeg`, `image/png`, `image/webp`) antes do upload. |

