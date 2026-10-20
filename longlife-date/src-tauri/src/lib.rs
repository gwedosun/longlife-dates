use std::sync::Mutex;

use rusqlite::Connection;
use tauri::Manager;

pub mod backup;
pub mod commands;
pub mod encounter_service;
pub mod error;
pub mod models;
pub mod photo_store;
pub mod repository;
pub mod service;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // resolve o app_data_dir
            let base = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("app_data_dir: {e}"))?;

            // garante que a pasta existe
            std::fs::create_dir_all(&base).map_err(|e| format!("criar app_data_dir: {e}"))?;

            // abre o sqlite e roda a migração (indempotencia)
            let db_path = base.join("encounters.db");
            let conn = Connection::open(&db_path).map_err(|e| format!("abrir banco: {e}"))?;
            repository::migrate(&conn).map_err(|e| format!("migrate: {e}"))?;

            app.manage(Mutex::new(conn));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::save_photo_cmd,
            commands::delete_photo_cmd,
            commands::get_photo_path_cmd,
            commands::read_photo_cmd,
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
