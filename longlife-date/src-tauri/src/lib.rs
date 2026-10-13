use std::sync::Mutex;

use rusqlite::Connection;
use tauri::Manager;

pub mod commands;
pub mod encounter_service;
pub mod error;
pub mod models;
pub mod photo_store;
pub mod repository;
pub mod service;
pub mod backup;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 1. Resolve app_data_dir
            let base = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("app_data_dir: {e}"))?;

            // 2. Garante que a pasta existe
            std::fs::create_dir_all(&base).map_err(|e| format!("criar app_data_dir: {e}"))?;

            // 3. Abre o SQLite e roda a migração (idempotente)
            let db_path = base.join("encounters.db");
            let conn = Connection::open(&db_path).map_err(|e| format!("abrir banco: {e}"))?;
            repository::migrate(&conn).map_err(|e| format!("migrate: {e}"))?;

            // 4. Injeta como estado gerenciado
            app.manage(Mutex::new(conn));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Fotos (Fase 3)
            commands::save_photo_cmd,
            commands::delete_photo_cmd,
            commands::get_photo_path_cmd,
            commands::read_photo_cmd,
            // CRUD de encontros (Fase 4)
            commands::create_encounter_cmd,
            commands::get_encounter_cmd,
            commands::list_encounters_cmd,
            commands::update_encounter_cmd,
            commands::delete_encounter_cmd,
            commands::delete_all_data_cmd,
            commands::import_backup_cmd,
            commands::export_backup_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
