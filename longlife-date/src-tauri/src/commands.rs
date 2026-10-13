use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{Manager, State};

use crate::encounter_service;
use crate::models::Encounter;
use crate::photo_store;

fn photos_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir indisponível: {e}"))?;
    Ok(photo_store::photos_dir(&base))
}

// ============ Fotos (Fase 3) ============

#[tauri::command]
pub fn save_photo_cmd(app: tauri::AppHandle, bytes: Vec<u8>) -> Result<String, String> {
    let root = photos_root(&app)?;
    photo_store::save_photo(&bytes, &root).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_photo_cmd(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    let root = photos_root(&app)?;
    photo_store::delete_photo(&filename, &root).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_photo_path_cmd(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let root = photos_root(&app)?;
    photo_store::photo_path(&filename, &root)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

// ============ CRUD de Encontros (Fase 4) ============

#[tauri::command]
pub fn create_encounter_cmd(
    app: tauri::AppHandle,
    state: State<'_, Mutex<Connection>>,
    date: String,
    location: String,
    description: String,
    photo_bytes: Option<Vec<u8>>,
) -> Result<i64, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let root = photos_root(&app)?;

    encounter_service::create_encounter(
        &conn,
        &root,
        &date,
        &location,
        &description,
        photo_bytes.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_encounter_cmd(
    state: State<'_, Mutex<Connection>>,
    id: i64,
) -> Result<Encounter, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    encounter_service::get_encounter(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_encounters_cmd(
    state: State<'_, Mutex<Connection>>,
    query: Option<String>,
    from: Option<String>,
    to: Option<String>,
    desc: bool,
) -> Result<Vec<Encounter>, String> {
    // Valida datas do filtro — o backend não confia no frontend
    if let Some(d) = &from {
        crate::service::validate_date(d).map_err(|e| e.to_string())?;
    }
    if let Some(d) = &to {
        crate::service::validate_date(d).map_err(|e| e.to_string())?;
    }

    let conn = state.lock().map_err(|e| e.to_string())?;
    let filter = crate::repository::EncounterFilter {
        query,
        from,
        to,
        desc,
    };
    crate::encounter_service::list_encounters(&conn, &filter).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_encounter_cmd(
    app: tauri::AppHandle,
    state: State<'_, Mutex<Connection>>,
    id: i64,
    date: String,
    location: String,
    description: String,
    new_photo_bytes: Option<Vec<u8>>,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let root = photos_root(&app)?;

    encounter_service::update_encounter(
        &conn,
        &root,
        id,
        &date,
        &location,
        &description,
        new_photo_bytes.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_encounter_cmd(
    app: tauri::AppHandle,
    state: State<'_, Mutex<Connection>>,
    id: i64,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let root = photos_root(&app)?;

    encounter_service::delete_encounter(&conn, &root, id).map_err(|e| e.to_string())
}

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};

#[tauri::command]
pub fn read_photo_cmd(
    app: tauri::AppHandle,
    filename: String,
) -> Result<String, String> {
    let root = photos_root(&app)?;
    let path = photo_store::photo_path(&filename, &root).map_err(|e| e.to_string())?;
    let bytes = std::fs::read(&path).map_err(|e| format!("ler foto: {e}"))?;
    Ok(B64.encode(bytes))
}

#[tauri::command]
pub fn delete_all_data_cmd(
    app: tauri::AppHandle,
    state: State<'_, Mutex<Connection>>,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let root = photos_root(&app)?;
    crate::encounter_service::delete_all_data(&conn, &root).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_backup_cmd(
    app: tauri::AppHandle,
    state: State<'_, Mutex<Connection>>,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let root = photos_root(&app)?;
    let backup = crate::backup::export(&conn, &root).map_err(|e| e.to_string())?;
    serde_json::to_string(&backup).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_backup_cmd(
    app: tauri::AppHandle,
    state: State<'_, Mutex<Connection>>,
    json: String,
) -> Result<usize, String> {
    let mut conn = state.lock().map_err(|e| e.to_string())?;
    let root = photos_root(&app)?;
    crate::backup::import(&mut conn, &root, &json).map_err(|e| e.to_string())
}

