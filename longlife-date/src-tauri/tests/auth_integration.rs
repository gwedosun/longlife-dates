use std::env;
use std::fs;
use std::path::PathBuf;

use longlife_date_lib::auth::{
    check_has_account, guarded_create_encounter, guarded_delete_all_data, guarded_delete_encounter,
    guarded_get_encounter, guarded_list_encounters, guarded_update_encounter, login, logout,
    setup_account, verify_password, SessionState,
};
use longlife_date_lib::error::AppError;
use longlife_date_lib::repository::{get_auth_profile, migrate, EncounterFilter};
use rusqlite::Connection;
use uuid::Uuid;

fn setup_test_env() -> (Connection, SessionState, PathBuf) {
    let conn = Connection::open_in_memory().expect("deve abrir sqlite em memória");
    migrate(&conn).expect("deve rodar migração");

    let session = SessionState::new();

    let mut dir = env::temp_dir();
    dir.push(format!("lovelog_auth_test_{}", Uuid::new_v4()));
    fs::create_dir_all(&dir).expect("deve criar diretório temporário");

    (conn, session, dir)
}

#[test]
fn test_setup_account_persists_secure_argon2_hash_and_salt() {
    let (conn, _session, dir) = setup_test_env();

    // Antes do cadastro, check_has_account deve retornar false
    assert!(!check_has_account(&conn).unwrap());

    // Senha muito curta (< 4 caracteres) deve ser rejeitada
    let short_err = setup_account(&conn, "123").unwrap_err();
    assert_eq!(short_err, AppError::InvalidPassword);
    assert!(!check_has_account(&conn).unwrap());

    // Cadastro com senha válida
    setup_account(&conn, "123456").expect("deve cadastrar senha válida");
    assert!(check_has_account(&conn).unwrap());

    // Verifica que o hash Argon2 e o salt foram salvos e não são texto puro
    let profile = get_auth_profile(&conn)
        .unwrap()
        .expect("perfil de autenticação deve existir");
    assert_ne!(profile.password_hash, "123456");
    assert!(
        profile.password_hash.starts_with("$argon2"),
        "hash deve estar em formato PHC Argon2"
    );
    assert!(!profile.salt.is_empty(), "salt não deve estar vazio");
    assert!(verify_password("123456", &profile.password_hash).unwrap());

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn test_login_with_correct_password_succeeds_and_unlocks_session() {
    let (conn, session, dir) = setup_test_env();

    setup_account(&conn, "nosso-segredo-2024").unwrap();
    assert!(!session.is_authenticated().unwrap());

    let result = login(&conn, &session, "nosso-segredo-2024").unwrap();
    assert!(result);
    assert!(session.is_authenticated().unwrap());

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn test_login_with_wrong_password_rejected_with_invalid_credentials() {
    let (conn, session, dir) = setup_test_env();

    setup_account(&conn, "senha-correta").unwrap();

    let err = login(&conn, &session, "senha-errada").unwrap_err();
    assert_eq!(err, AppError::InvalidCredentials);
    assert!(!session.is_authenticated().unwrap());

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn test_crud_commands_blocked_when_unauthenticated_and_allowed_when_authenticated() {
    let (conn, session, dir) = setup_test_env();
    setup_account(&conn, "amor1234").unwrap();

    let default_filter = EncounterFilter::default();

    // 1. Sessão bloqueada (antes do login): todos os comandos CRUD devem falhar com Unauthorized
    assert_eq!(
        guarded_create_encounter(&session, &conn, &dir, "2024-06-12", "Jantar", "Luz de velas", None)
            .unwrap_err(),
        AppError::Unauthorized
    );
    assert_eq!(
        guarded_list_encounters(&session, &conn, &default_filter).unwrap_err(),
        AppError::Unauthorized
    );
    assert_eq!(
        guarded_get_encounter(&session, &conn, 1).unwrap_err(),
        AppError::Unauthorized
    );
    assert_eq!(
        guarded_update_encounter(
            &session,
            &conn,
            &dir,
            1,
            "2024-06-12",
            "Jantar Editado",
            "Descrição",
            None
        )
        .unwrap_err(),
        AppError::Unauthorized
    );
    assert_eq!(
        guarded_delete_encounter(&session, &conn, &dir, 1).unwrap_err(),
        AppError::Unauthorized
    );
    assert_eq!(
        guarded_delete_all_data(&session, &conn, &dir).unwrap_err(),
        AppError::Unauthorized
    );

    // 2. Realiza login: sessão desbloqueada, comandos CRUD passam a funcionar
    assert!(login(&conn, &session, "amor1234").unwrap());

    let id = guarded_create_encounter(
        &session,
        &conn,
        &dir,
        "2024-06-12",
        "Jantar",
        "Luz de velas",
        None,
    )
    .expect("deve criar encontro quando autenticado");

    let list = guarded_list_encounters(&session, &conn, &default_filter).unwrap();
    assert_eq!(list.len(), 1);

    let fetched = guarded_get_encounter(&session, &conn, id).unwrap();
    assert_eq!(fetched.location, "Jantar");

    guarded_update_encounter(
        &session,
        &conn,
        &dir,
        id,
        "2024-06-12",
        "Jantar Especial",
        "Luz de velas",
        None,
    )
    .expect("deve atualizar encontro quando autenticado");

    // 3. Realiza logout: sessão volta a ficar bloqueada e impede novas operações CRUD
    logout(&session).unwrap();
    assert!(!session.is_authenticated().unwrap());

    assert_eq!(
        guarded_delete_encounter(&session, &conn, &dir, id).unwrap_err(),
        AppError::Unauthorized
    );

    let _ = fs::remove_dir_all(&dir);
}

