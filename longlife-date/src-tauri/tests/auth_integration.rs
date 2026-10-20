use std::env;
use std::fs;
use std::path::PathBuf;

use longlife_date_lib::auth::{
    check_has_account, factory_reset_unauthenticated, guarded_create_encounter,
    guarded_delete_all_data, guarded_delete_encounter, guarded_get_encounter,
    guarded_list_encounters, guarded_update_encounter, login, logout,
    reset_password_with_recovery_code, setup_account, verify_password, SessionState,
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

    assert!(!check_has_account(&conn).unwrap());

    let short_err = setup_account(&conn, "123").unwrap_err();
    assert_eq!(short_err, AppError::InvalidPassword);
    assert!(!check_has_account(&conn).unwrap());

    let recovery_code = setup_account(&conn, "123456").expect("deve cadastrar senha válida");
    assert!(!recovery_code.is_empty());
    assert!(check_has_account(&conn).unwrap());

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
fn test_setup_generates_valid_recovery_code() {
    let (conn, _session, dir) = setup_test_env();

    let recovery_code = setup_account(&conn, "senha-mestre-123").unwrap();

    // Formato esperado: XXXX-XXXX-XXXX-XXXX (19 caracteres, 4 blocos de 4 alfanuméricos maiúsculos)
    let blocks: Vec<&str> = recovery_code.split('-').collect();
    assert_eq!(blocks.len(), 4, "código deve ter 4 blocos separados por traço");
    for block in blocks {
        assert_eq!(block.len(), 4, "cada bloco deve ter 4 caracteres");
        assert!(
            block
                .chars()
                .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()),
            "bloco deve conter apenas letras maiúsculas ou dígitos"
        );
    }

    let profile = get_auth_profile(&conn).unwrap().unwrap();
    assert_ne!(
        profile.recovery_code_hash, recovery_code,
        "código de recuperação jamais deve ser salvo em texto puro"
    );
    assert!(
        profile.recovery_code_hash.starts_with("$argon2"),
        "hash do código de recuperação deve usar Argon2"
    );
    assert!(verify_password(&recovery_code, &profile.recovery_code_hash).unwrap());

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn test_reset_password_with_valid_recovery_code_success() {
    let (conn, session, dir) = setup_test_env();

    let recovery_code = setup_account(&conn, "senha-antiga").unwrap();

    // Redefine a senha usando o código de recuperação (inclusive aceitando minúsculas/espaços)
    let lower_code = format!("  {}  ", recovery_code.to_lowercase());
    reset_password_with_recovery_code(&conn, &lower_code, "nova-senha-456")
        .expect("deve redefinir senha com código válido");

    // Senha antiga não deve mais autenticar
    assert_eq!(
        login(&conn, &session, "senha-antiga").unwrap_err(),
        AppError::InvalidCredentials
    );

    // Nova senha deve autenticar com sucesso
    assert!(login(&conn, &session, "nova-senha-456").unwrap());
    assert!(session.is_authenticated().unwrap());

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn test_reset_password_with_invalid_recovery_code_fails() {
    let (conn, session, dir) = setup_test_env();

    let _recovery_code = setup_account(&conn, "senha-original").unwrap();

    let err =
        reset_password_with_recovery_code(&conn, "XXXX-YYYY-ZZZZ-0000", "tentativa-1234").unwrap_err();
    assert_eq!(err, AppError::InvalidRecoveryCode);

    // A senha original deve continuar intacta
    assert!(login(&conn, &session, "senha-original").unwrap());

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn test_factory_reset_wipes_auth_and_data() {
    let (conn, session, dir) = setup_test_env();

    // 1. Configura conta, faz login e cria um encontro com foto
    setup_account(&conn, "minha-senha").unwrap();
    login(&conn, &session, "minha-senha").unwrap();

    let mut fake_png = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    fake_png.extend_from_slice(b"\x00\x00\x00\x0DIHDRdummy");

    let id = guarded_create_encounter(
        &session,
        &conn,
        &dir,
        "2024-06-12",
        "Praia",
        "Dia inesquecível",
        Some(&fake_png),
    )
    .unwrap();
    let photo_file = guarded_get_encounter(&session, &conn, id)
        .unwrap()
        .photo_file
        .unwrap();
    assert!(dir.join(&photo_file).exists());

    // 2. Bloqueia a sessão (simulando usuário na tela de login que esqueceu senha e código)
    logout(&session).unwrap();
    assert!(!session.is_authenticated().unwrap());

    // 3. Executa factory_reset_unauthenticated mesmo sem estar autenticado
    factory_reset_unauthenticated(&conn, &session, &dir)
        .expect("factory reset deve limpar tudo mesmo deslogado");

    // 4. Verifica que auth_profile, encontros e fotos foram completamente apagados (Estado Zero)
    assert!(!check_has_account(&conn).unwrap());
    assert!(get_auth_profile(&conn).unwrap().is_none());
    assert!(!dir.join(&photo_file).exists(), "arquivo de foto deve ser apagado");
    assert!(!session.is_authenticated().unwrap());

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

    logout(&session).unwrap();
    assert!(!session.is_authenticated().unwrap());

    assert_eq!(
        guarded_delete_encounter(&session, &conn, &dir, id).unwrap_err(),
        AppError::Unauthorized
    );

    let _ = fs::remove_dir_all(&dir);
}
