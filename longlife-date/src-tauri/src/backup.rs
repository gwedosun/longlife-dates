use std::fs;
use std::path::Path;

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};
use crate::photo_store::{delete_photo, detect_image_type, photo_path, save_photo};
use crate::repository::{self, Order};
use crate::service::{validate_date, validate_description, validate_location};

const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupFile {
    pub schema_version: u32,
    pub exported_at: String,
    pub encounters: Vec<BackupEncounter>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEncounter {
    pub date: String,
    pub location: String,
    pub description: String,
    pub photo: Option<BackupPhoto>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupPhoto {
    pub mime: String,
    pub data_base64: String,
}

fn mime_from_filename(name: &str) -> String {
    let l = name.to_lowercase();
    if l.ends_with(".png") { "image/png".into() }
    else if l.ends_with(".jpg") || l.ends_with(".jpeg") { "image/jpeg".into() }
    else if l.ends_with(".webp") { "image/webp".into() }
    else { "application/octet-stream".into() }
}

/// Exporta todos os encontros + fotos num JSON.
pub fn export(conn: &Connection, photos_dir: &Path) -> Result<BackupFile> {
    let encounters = repository::list_encounters(conn, Order::Asc)?;
    let mut out = Vec::with_capacity(encounters.len());

    for e in encounters {
        let photo = match e.photo_file.as_deref() {
            Some(name) => {
                let path = photo_path(name, photos_dir)?;
                let bytes = fs::read(&path).map_err(|err| AppError::Io(err.to_string()))?;
                Some(BackupPhoto {
                    mime: mime_from_filename(name),
                    data_base64: B64.encode(&bytes),
                })
            }
            None => None,
        };
        out.push(BackupEncounter {
            date: e.date,
            location: e.location,
            description: e.description,
            photo,
        });
    }

    Ok(BackupFile {
        schema_version: SCHEMA_VERSION,
        exported_at: chrono::Utc::now().to_rfc3339(),
        encounters: out,
    })
}

/// Importa e SUBSTITUI tudo. Retorna quantos encontros foram restaurados.
///
/// Estratégia:
/// 1. Valida TUDO primeiro (nada é tocado em disco/DB antes disso).
/// 2. Salva as fotos novas (UUIDs novos).
/// 3. Numa transação: DELETE FROM encounters, INSERT de tudo.
/// 4. Se a transação falhar, remove as fotos novas e devolve o erro.
/// 5. Se der certo, apaga as fotos antigas (best-effort).
pub fn import(conn: &mut Connection, photos_dir: &Path, json: &str) -> Result<usize> {
    let parsed: BackupFile = serde_json::from_str(json)
        .map_err(|e| AppError::Io(format!("backup inválido: {e}")))?;

    if parsed.schema_version != SCHEMA_VERSION {
        return Err(AppError::Io(format!(
            "versão de backup {} não suportada (esperado {})",
            parsed.schema_version, SCHEMA_VERSION
        )));
    }

    // 1. Validação completa, sem tocar em nada
    let mut pending: Vec<(BackupEncounter, Option<Vec<u8>>)> = Vec::new();
    for e in parsed.encounters {
        validate_date(&e.date)?;
        let loc = validate_location(&e.location)?;
        validate_description(&e.description)?;

        let bytes = match &e.photo {
            Some(p) => {
                let raw = B64
                    .decode(&p.data_base64)
                    .map_err(|err| AppError::Io(format!("base64 inválido: {err}")))?;
                // prova criptográfica de que é imagem (magic bytes)
                detect_image_type(&raw)?;
                Some(raw)
            }
            None => None,
        };

        pending.push((
            BackupEncounter {
                date: e.date,
                location: loc,
                description: e.description,
                photo: None, // não precisamos mais disso
            },
            bytes,
        ));
    }

    // 2. Snapshot do estado atual para limpeza posterior
    let old_files: Vec<String> = repository::list_encounters(conn, Order::Asc)?
        .into_iter()
        .filter_map(|e| e.photo_file)
        .collect();

    // 3. Salva fotos novas; se falhar, limpa o que já foi salvo
    let mut saved: Vec<Option<String>> = Vec::with_capacity(pending.len());
    let mut rollback: Vec<String> = Vec::new();

    for (_, bytes) in &pending {
        match bytes {
            Some(b) => match save_photo(b, photos_dir) {
                Ok(name) => {
                    rollback.push(name.clone());
                    saved.push(Some(name));
                }
                Err(e) => {
                    for n in &rollback {
                        let _ = delete_photo(n, photos_dir);
                    }
                    return Err(e);
                }
            },
            None => saved.push(None),
        }
    }

    // 4. Substituição atômica no banco
    let tx = conn
        .transaction()
        .map_err(|e| AppError::Database(e.to_string()))?;

    tx.execute("DELETE FROM encounters", [])
        .map_err(|e| AppError::Database(e.to_string()))?;

    for ((enc, _), photo) in pending.iter().zip(saved.iter()) {
        tx.execute(
            "INSERT INTO encounters (date, location, description, photo_file) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![enc.date, enc.location, enc.description, photo.as_deref()],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
    }

    if let Err(e) = tx.commit() {
        // rollback das fotos novas (o banco já foi rolled back pelo drop do tx)
        for n in &rollback {
            let _ = delete_photo(n, photos_dir);
        }
        return Err(AppError::Database(e.to_string()));
    }

    // 5. Sucesso: apaga fotos antigas (best-effort)
    for old in old_files {
        let _ = delete_photo(&old, photos_dir);
    }

    Ok(pending.len())
}

// ============================================================
// Testes
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::encounter_service::{create_encounter, list_encounters};
    use crate::repository::{migrate, EncounterFilter};
    use std::env;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn setup() -> (Connection, PathBuf) {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        let mut dir = env::temp_dir();
        dir.push(format!("longlife_bkp_{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        (conn, dir)
    }

    fn fake_png() -> Vec<u8> {
        let mut v = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        v.extend_from_slice(b"\x00\x00\x00\x0DIHDRdummy");
        v
    }

    // UT-32: round-trip preserva encontros e fotos
    #[test]
    fn test_export_import_round_trip() {
        let (mut conn, dir) = setup();
        let png = fake_png();

        create_encounter(&conn, &dir, "2024-05-20", "Praia", "Sol", Some(&png)).unwrap();
        create_encounter(&conn, &dir, "2024-05-21", "Serra", "Frio", None).unwrap();

        let backup = export(&conn, &dir).unwrap();
        let json = serde_json::to_string(&backup).unwrap();
        assert!(json.contains("2024-05-20"));
        assert!(json.contains("Praia"));
        assert!(json.contains("dataBase64"));

        // apaga tudo
        crate::encounter_service::delete_all_data(&conn, &dir).unwrap();
        assert!(list_encounters(&conn, &EncounterFilter { desc: false, ..Default::default() })
            .unwrap()
            .is_empty());
        // restaura
        let n = import(&mut conn, &dir, &json).unwrap();
        assert_eq!(n, 2);

        let list = list_encounters(&conn, &EncounterFilter { desc: false, ..Default::default() })
            .unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].location, "Praia");
        assert!(list[0].photo_file.is_some());

        let _ = fs::remove_dir_all(&dir);
    }

    // UT-33: import rejeita schemaVersion desconhecida
    #[test]
    fn test_import_rejects_wrong_schema_version() {
        let (mut conn, dir) = setup();
        let json = r#"{"schemaVersion":99,"exportedAt":"x","encounters":[]}"#;
        let err = import(&mut conn, &dir, json).unwrap_err();
        assert!(matches!(err, AppError::Io(_)));
        let _ = fs::remove_dir_all(&dir);
    }

    // UT-34: import rejeita JSON malformado sem tocar no estado atual
    #[test]
    fn test_import_rejects_malformed_json() {
        let (mut conn, dir) = setup();
        create_encounter(&conn, &dir, "2024-05-20", "Praia", "", None).unwrap();

        let err = import(&mut conn, &dir, "{isso não é json}").unwrap_err();
        assert!(matches!(err, AppError::Io(_)));

        // estado intacto
        assert_eq!(
            list_encounters(&conn, &EncounterFilter { desc: false, ..Default::default() })
                .unwrap()
                .len(),
            1
        );
        let _ = fs::remove_dir_all(&dir);
    }

    // UT-35: import com foto falsa (não-imagem) é rejeitado ANTES de tocar em disco
    #[test]
    fn test_import_rejects_fake_photo() {
        let (mut conn, dir) = setup();
        let fake = B64.encode(b"nao sou imagem alguma");

        let json = format!(
            r#"{{
                "schemaVersion":1,
                "exportedAt":"x",
                "encounters":[{{
                    "date":"2024-05-20",
                    "location":"Praia",
                    "description":"",
                    "photo":{{"mime":"image/png","dataBase64":"{fake}"}}
                }}]
            }}"#
        );

        let err = import(&mut conn, &dir, &json).unwrap_err();
        assert!(matches!(err, AppError::InvalidImage));

        // nada em disco
        let entries: Vec<_> = fs::read_dir(&dir).unwrap().filter_map(|e| e.ok()).collect();
        assert!(entries.is_empty());

        let _ = fs::remove_dir_all(&dir);
    }
}