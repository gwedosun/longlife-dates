use std::path::Path;

use rusqlite::Connection;

use crate::error::Result;
use crate::models::Encounter;
use crate::photo_store::{delete_photo, save_photo};
use crate::repository::{self, Order};
use crate::service::{validate_date, validate_description, validate_location};

/// Orquestra "criar encontro". Se a foto for salva e o INSERT falhar,
/// a foto é removida — não deixamos arquivo órfão.
pub fn create_encounter(
    conn: &Connection,
    photos_dir: &Path,
    date: &str,
    location: &str,
    description: &str,
    photo_bytes: Option<&[u8]>,
) -> Result<i64> {
    // 1. Validações de domínio primeiro (falha rápida, sem tocar em disco)
    validate_date(date)?;
    let location = validate_location(location)?;
    validate_description(description)?;

    // 2. Salva a foto (se houver) — atômico
    let photo_file = match photo_bytes {
        Some(bytes) => Some(save_photo(bytes, photos_dir)?),
        None => None,
    };

    // 3. Insere no banco — se falhar, desfaz a foto
    match repository::insert_encounter(conn, date, &location, description, photo_file.as_deref()) {
        Ok(id) => Ok(id),
        Err(e) => {
            if let Some(f) = photo_file.as_deref() {
                let _ = delete_photo(f, photos_dir);
            }
            Err(e)
        }
    }
}

/// Orquestra "atualizar encontro". Se uma nova foto for enviada, salva a nova,
/// atualiza o banco e só então apaga a antiga (ordem importa!).
pub fn update_encounter(
    conn: &Connection,
    photos_dir: &Path,
    id: i64,
    date: &str,
    location: &str,
    description: &str,
    new_photo_bytes: Option<&[u8]>,
) -> Result<()> {
    validate_date(date)?;
    let location = validate_location(location)?;
    validate_description(description)?;

    // Descobre o nome da foto atual para podermos apagar depois
    let existing = repository::get_encounter(conn, id)?;
    let old_photo = existing.photo_file;

    // Se veio nova foto, salva
    let new_photo = match new_photo_bytes {
        Some(bytes) => Some(save_photo(bytes, photos_dir)?),
        None => None,
    };

    // Escolhe qual filename gravar: nova > antiga
    let effective = new_photo.as_deref().or(old_photo.as_deref());

    match repository::update_encounter(conn, id, date, &location, description, effective) {
        Ok(()) => {
            // Só apaga a antiga se realmente trocamos
            if new_photo.is_some() {
                if let Some(old) = old_photo.as_deref() {
                    let _ = delete_photo(old, photos_dir);
                }
            }
            Ok(())
        }
        Err(e) => {
            // DB falhou: desfaz a nova foto (a antiga continua intacta)
            if let Some(f) = new_photo.as_deref() {
                let _ = delete_photo(f, photos_dir);
            }
            Err(e)
        }
    }
}

/// Orquestra "apagar encontro": remove o registro e, se tinha foto, remove o arquivo.
/// Apagar o arquivo é idempotente, então mesmo que já não exista, é sucesso.
pub fn delete_encounter(conn: &Connection, photos_dir: &Path, id: i64) -> Result<()> {
    let existing = repository::get_encounter(conn, id)?;

    repository::delete_encounter(conn, id)?;

    if let Some(photo) = existing.photo_file.as_deref() {
        // Se falhar aqui, logamos silenciosamente; não queremos quebrar o delete
        // por causa de um arquivo já ausente (é idempotente de qualquer forma).
        let _ = delete_photo(photo, photos_dir);
    }

    Ok(())
}

/// Reexporta para o comando não precisar importar o repository.
pub fn list_encounters(
    conn: &Connection,
    filter: &repository::EncounterFilter,
) -> Result<Vec<Encounter>> {
    repository::list_encounters_filtered(conn, filter)
}

pub fn get_encounter(conn: &Connection, id: i64) -> Result<Encounter> {
    repository::get_encounter(conn, id)
}

/// RN13/RRN14: apaga todos os encontros e todas as fotos em disco.
/// Retorna Ok(()) mesmo se o banco já estiver vazio (idempotência).
pub fn delete_all_data(conn: &Connection, photos_dir: &Path) -> Result<()> {
    // 1. Pega todos os filenames de foto (se houver)
    let encounters = repository::list_encounters(conn, Order::Asc)?;

    // 2. Apaga cada foto. delete_photo já é idempotente (RN12/RN15).
    for e in &encounters {
        if let Some(f) = e.photo_file.as_deref() {
            // best-effort: se falhar, continuamos; o arquivo ficará órfão no disco,
            // o que é menos ruim do que abortar uma limpeza em massa.
            let _ = delete_photo(f, photos_dir);
        }
    }

    // 3. Zera a tabela
    repository::delete_all_encounters(conn)?;

    Ok(())
}

// ============================================================
// Testes de integração em memória + pasta temporária
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::AppError;
    use crate::repository::migrate;
    use crate::repository::EncounterFilter;
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn setup() -> (Connection, PathBuf) {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();

        let mut dir = env::temp_dir();
        dir.push(format!("longlife_svc_{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();

        (conn, dir)
    }

    fn fake_png() -> Vec<u8> {
        let mut v = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        v.extend_from_slice(b"\x00\x00\x00\x0DIHDRdummy");
        v
    }

    fn fake_jpeg() -> Vec<u8> {
        let mut v = vec![0xFF, 0xD8, 0xFF, 0xE0];
        v.extend_from_slice(b"\x00\x10JFIF\x00\x01");
        v
    }

    // UT-22: cria encontro com foto — registro e arquivo existem
    #[test]
    fn test_create_with_photo_persists_both() {
        let (conn, dir) = setup();
        let png = fake_png();

        let id =
            create_encounter(&conn, &dir, "2024-05-20", "Praia", "Pôr do sol", Some(&png)).unwrap();

        let e = get_encounter(&conn, id).unwrap();
        assert_eq!(e.location, "Praia");
        let filename = e.photo_file.unwrap();
        assert!(dir.join(&filename).exists());

        let _ = fs::remove_dir_all(&dir);
    }

    // UT-23: se o domínio rejeita o local, NENHUMA foto é salva em disco
    #[test]
    fn test_create_with_invalid_location_does_not_save_photo() {
        let (conn, dir) = setup();
        let png = fake_png();

        let err = create_encounter(&conn, &dir, "2024-05-20", "   ", "", Some(&png)).unwrap_err();
        assert!(matches!(err, AppError::InvalidLocation));

        let entries: Vec<_> = fs::read_dir(&dir).unwrap().filter_map(|e| e.ok()).collect();
        assert!(entries.is_empty(), "nada deveria ter sido gravado em disco");

        let _ = fs::remove_dir_all(&dir);
    }

    // UT-24: bytes inválidos como foto — nem chega ao banco
    #[test]
    fn test_create_with_invalid_photo_does_not_insert() {
        let (conn, dir) = setup();

        let err = create_encounter(
            &conn,
            &dir,
            "2024-05-20",
            "Praia",
            "ok",
            Some(b"nao sou imagem"),
        )
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidImage));

        // Confirma que nada foi inserido
        let list = list_encounters(
            &conn,
            &EncounterFilter {
                desc: false,
                ..Default::default()
            },
        );
        assert!(list.unwrap().is_empty());

        let _ = fs::remove_dir_all(&dir);
    }

    // UT-25: atualizar com nova foto troca o arquivo e apaga o antigo
    #[test]
    fn test_update_replaces_photo() {
        let (conn, dir) = setup();
        let png = fake_png();
        let jpg = fake_jpeg();

        let id = create_encounter(&conn, &dir, "2024-05-20", "Praia", "Sol", Some(&png)).unwrap();
        let old_file = get_encounter(&conn, id).unwrap().photo_file.unwrap();

        update_encounter(&conn, &dir, id, "2024-05-21", "Serra", "Frio", Some(&jpg)).unwrap();

        let e = get_encounter(&conn, id).unwrap();
        assert_eq!(e.location, "Serra");
        let new_file = e.photo_file.unwrap();

        assert_ne!(old_file, new_file);
        assert!(!dir.join(&old_file).exists(), "foto antiga deveria sumir");
        assert!(dir.join(&new_file).exists(), "foto nova deveria existir");

        let _ = fs::remove_dir_all(&dir);
    }

    // UT-26: atualizar sem nova foto preserva a foto antiga
    #[test]
    fn test_update_without_photo_keeps_existing() {
        let (conn, dir) = setup();
        let png = fake_png();

        let id = create_encounter(&conn, &dir, "2024-05-20", "Praia", "Sol", Some(&png)).unwrap();
        let old_file = get_encounter(&conn, id).unwrap().photo_file.unwrap();

        update_encounter(&conn, &dir, id, "2024-05-20", "Praia", "Nublado", None).unwrap();

        let e = get_encounter(&conn, id).unwrap();
        assert_eq!(e.description, "Nublado");
        assert_eq!(e.photo_file.as_deref(), Some(old_file.as_str()));
        assert!(dir.join(&old_file).exists());

        let _ = fs::remove_dir_all(&dir);
    }

    // UT-27: apagar encontro remove registro + foto
    #[test]
    fn test_delete_removes_record_and_photo() {
        let (conn, dir) = setup();
        let png = fake_png();

        let id = create_encounter(&conn, &dir, "2024-05-20", "Praia", "Sol", Some(&png)).unwrap();
        let file = get_encounter(&conn, id).unwrap().photo_file.unwrap();

        delete_encounter(&conn, &dir, id).unwrap();

        assert!(get_encounter(&conn, id).is_err(), "registro deveria sumir");
        assert!(!dir.join(&file).exists(), "foto deveria sumir");

        let _ = fs::remove_dir_all(&dir);
    }

    // UT-28: apagar encontro inexistente devolve NotFound, sem tocar em disco
    #[test]
    fn test_delete_nonexistent_returns_not_found() {
        let (conn, dir) = setup();
        let err = delete_encounter(&conn, &dir, 999).unwrap_err();
        assert!(matches!(err, AppError::NotFound));
        let _ = fs::remove_dir_all(&dir);
    }

    // UT-29: apagar tudo remove registros e fotos (RN13)
    #[test]
    fn test_delete_all_removes_records_and_photos() {
        let (conn, dir) = setup();
        let png = fake_png();
        let jpg = fake_jpeg();

        let id1 = create_encounter(&conn, &dir, "2024-05-20", "Praia", "Sol", Some(&png)).unwrap();
        let id2 = create_encounter(&conn, &dir, "2024-05-21", "Serra", "Frio", Some(&jpg)).unwrap();
        let _id3 = create_encounter(&conn, &dir, "2024-05-22", "Cidade", "Centro", None).unwrap();

        let f1 = get_encounter(&conn, id1).unwrap().photo_file.unwrap();
        let f2 = get_encounter(&conn, id2).unwrap().photo_file.unwrap();
        assert!(dir.join(&f1).exists());
        assert!(dir.join(&f2).exists());

        delete_all_data(&conn, &dir).unwrap();

        assert!(list_encounters(
            &conn,
            &EncounterFilter {
                desc: false,
                ..Default::default()
            }
        )
        .unwrap()
        .is_empty());
        assert!(!dir.join(&f1).exists(), "foto 1 deveria sumir");
        assert!(!dir.join(&f2).exists(), "foto 2 deveria sumir");

        let _ = fs::remove_dir_all(&dir);
    }

    // UT-30: apagar tudo é idempotente (RN14)
    #[test]
    fn test_delete_all_is_idempotent() {
        let (conn, dir) = setup();

        // banco já vazio
        assert!(delete_all_data(&conn, &dir).is_ok());
        assert!(delete_all_data(&conn, &dir).is_ok());

        // com um registro
        create_encounter(&conn, &dir, "2024-05-20", "Praia", "", None).unwrap();
        assert!(delete_all_data(&conn, &dir).is_ok());
        assert!(delete_all_data(&conn, &dir).is_ok());

        let _ = fs::remove_dir_all(&dir);
    }

    // UT-31: apagar tudo com foto já removida do disco não quebra (RN15)
    #[test]
    fn test_delete_all_handles_missing_photo_file() {
        let (conn, dir) = setup();
        let png = fake_png();
        let id = create_encounter(&conn, &dir, "2024-05-20", "Praia", "", Some(&png)).unwrap();
        let f = get_encounter(&conn, id).unwrap().photo_file.unwrap();

        // removemos o arquivo à mão (simulando corrupção)
        fs::remove_file(dir.join(&f)).unwrap();

        // ainda assim, apagar tudo deve funcionar
        assert!(delete_all_data(&conn, &dir).is_ok());
        assert!(list_encounters(
            &conn,
            &EncounterFilter {
                desc: false,
                ..Default::default()
            }
        )
        .unwrap()
        .is_empty());
        let _ = fs::remove_dir_all(&dir);
    }
}
