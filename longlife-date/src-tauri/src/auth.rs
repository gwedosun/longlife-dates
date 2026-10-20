use std::path::Path;
use std::sync::Mutex;

use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand_core::{OsRng, RngCore};
use rusqlite::Connection;

use crate::encounter_service;
use crate::error::{AppError, Result};
use crate::models::Encounter;
use crate::repository::{self, EncounterFilter};

pub const MIN_PASSWORD_LEN: usize = 4;

const RECOVERY_ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/// Estado de sessão em memória controlado por Mutex (bloqueado por padrão).
pub struct SessionState {
    pub is_authenticated: Mutex<bool>,
}

impl Default for SessionState {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            is_authenticated: Mutex::new(false),
        }
    }

    pub fn is_authenticated(&self) -> Result<bool> {
        let guard = self
            .is_authenticated
            .lock()
            .map_err(|e| AppError::Database(format!("falha ao acessar sessão: {e}")))?;
        Ok(*guard)
    }

    pub fn set_authenticated(&self, authenticated: bool) -> Result<()> {
        let mut guard = self
            .is_authenticated
            .lock()
            .map_err(|e| AppError::Database(format!("falha ao atualizar sessão: {e}")))?;
        *guard = authenticated;
        Ok(())
    }

    pub fn require_auth(&self) -> Result<()> {
        if self.is_authenticated()? {
            Ok(())
        } else {
            Err(AppError::Unauthorized)
        }
    }
}

/// Valida o comprimento mínimo da senha (mínimo 4 caracteres não vazios).
pub fn validate_password(password: &str) -> Result<()> {
    if password.trim().chars().count() < MIN_PASSWORD_LEN {
        return Err(AppError::InvalidPassword);
    }
    Ok(())
}

/// Gera um código de recuperação criptograficamente seguro no formato `XXXX-XXXX-XXXX-XXXX`
/// (16 caracteres alfanuméricos em caixa alta divididos em 4 blocos de 4).
pub fn generate_recovery_code() -> String {
    let mut bytes = [0u8; 16];
    OsRng.fill_bytes(&mut bytes);

    let mut out = String::with_capacity(19);
    for (i, &b) in bytes.iter().enumerate() {
        if i > 0 && i % 4 == 0 {
            out.push('-');
        }
        let idx = (b as usize) % RECOVERY_ALPHABET.len();
        out.push(RECOVERY_ALPHABET[idx] as char);
    }
    out
}

/// Normaliza o código de recuperação (remove espaços nas extremidades e converte para maiúsculas).
pub fn normalize_recovery_code(code: &str) -> String {
    code.trim().to_uppercase()
}

/// Gera hash Argon2id seguro para qualquer segredo e retorna `(hash_phc, salt)`.
pub fn hash_secret(secret: &str) -> Result<(String, String)> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(secret.as_bytes(), &salt)
        .map_err(|e| AppError::Database(format!("erro ao gerar hash Argon2: {e}")))?
        .to_string();

    Ok((hash, salt.to_string()))
}

/// Gera hash Argon2id seguro para senha (validando tamanho mínimo) e retorna `(password_hash, salt)`.
pub fn hash_password(password: &str) -> Result<(String, String)> {
    validate_password(password)?;
    hash_secret(password)
}

/// Verifica se o segredo fornecido corresponde ao hash Argon2id armazenado.
pub fn verify_password(secret: &str, stored_hash: &str) -> Result<bool> {
    if stored_hash.trim().is_empty() {
        return Ok(false);
    }
    let parsed_hash = PasswordHash::new(stored_hash)
        .map_err(|e| AppError::Database(format!("hash armazenado inválido: {e}")))?;
    Ok(Argon2::default()
        .verify_password(secret.as_bytes(), &parsed_hash)
        .is_ok())
}

/// Retorna `true` se já existe senha cadastrada no banco e `false` se é o primeiro acesso.
pub fn check_has_account(conn: &Connection) -> Result<bool> {
    repository::has_auth_profile(conn)
}

/// Cadastra a senha no banco com hash Argon2id seguro, gera e persiste o hash do
/// código de recuperação único (`XXXX-XXXX-XXXX-XXXX`) e retorna o código em texto puro.
pub fn setup_account(conn: &Connection, password: &str) -> Result<String> {
    validate_password(password)?;
    let (password_hash, salt) = hash_password(password)?;
    let recovery_code = generate_recovery_code();
    let (recovery_code_hash, _) = hash_secret(&recovery_code)?;

    repository::save_auth_profile(conn, &password_hash, &recovery_code_hash, &salt)?;
    Ok(recovery_code)
}

/// Redefine a senha mestre caso o código de recuperação fornecido corresponda ao hash salvo.
pub fn reset_password_with_recovery_code(
    conn: &Connection,
    recovery_code: &str,
    new_password: &str,
) -> Result<()> {
    let normalized = normalize_recovery_code(recovery_code);
    if normalized.is_empty() {
        return Err(AppError::InvalidRecoveryCode);
    }

    let profile = repository::get_auth_profile(conn)?.ok_or(AppError::InvalidRecoveryCode)?;

    if !verify_password(&normalized, &profile.recovery_code_hash)? {
        return Err(AppError::InvalidRecoveryCode);
    }

    validate_password(new_password)?;
    let (new_password_hash, new_salt) = hash_password(new_password)?;
    repository::update_auth_password(conn, &new_password_hash, &new_salt)
}

/// Executa o reset definitivo de fábrica (Estado Zero) mesmo sem sessão autenticada:
/// apaga todos os encontros, remove todas as fotos em `photos/`, apaga `auth_profile`
/// e bloqueia a sessão.
pub fn factory_reset_unauthenticated(
    conn: &Connection,
    session: &SessionState,
    photos_dir: &Path,
) -> Result<()> {
    encounter_service::delete_all_data(conn, photos_dir)?;
    repository::delete_auth_profile(conn)?;
    session.set_authenticated(false)?;
    Ok(())
}

/// Autentica o usuário comparando a senha com o hash salvo.
/// Se válido, desbloqueia a sessão (`is_authenticated = true`) e retorna `Ok(true)`.
/// Se inválido, bloqueia a sessão e retorna `Err(AppError::InvalidCredentials)`.
pub fn login(conn: &Connection, session: &SessionState, password: &str) -> Result<bool> {
    let profile = repository::get_auth_profile(conn)?.ok_or(AppError::InvalidCredentials)?;

    if verify_password(password, &profile.password_hash)? {
        session.set_authenticated(true)?;
        Ok(true)
    } else {
        session.set_authenticated(false)?;
        Err(AppError::InvalidCredentials)
    }
}

/// Bloqueia a sessão atual (`is_authenticated = false`).
pub fn logout(session: &SessionState) -> Result<()> {
    session.set_authenticated(false)
}

// ============================================================
// Operações CRUD protegidas por sessão (Session Guard)
// ============================================================

pub fn guarded_create_encounter(
    session: &SessionState,
    conn: &Connection,
    photos_dir: &Path,
    date: &str,
    location: &str,
    description: &str,
    photo_bytes: Option<&[u8]>,
) -> Result<i64> {
    session.require_auth()?;
    encounter_service::create_encounter(conn, photos_dir, date, location, description, photo_bytes)
}

pub fn guarded_get_encounter(
    session: &SessionState,
    conn: &Connection,
    id: i64,
) -> Result<Encounter> {
    session.require_auth()?;
    encounter_service::get_encounter(conn, id)
}

pub fn guarded_list_encounters(
    session: &SessionState,
    conn: &Connection,
    filter: &EncounterFilter,
) -> Result<Vec<Encounter>> {
    session.require_auth()?;
    encounter_service::list_encounters(conn, filter)
}

pub fn guarded_update_encounter(
    session: &SessionState,
    conn: &Connection,
    photos_dir: &Path,
    id: i64,
    date: &str,
    location: &str,
    description: &str,
    new_photo_bytes: Option<&[u8]>,
) -> Result<()> {
    session.require_auth()?;
    encounter_service::update_encounter(
        conn,
        photos_dir,
        id,
        date,
        location,
        description,
        new_photo_bytes,
    )
}

pub fn guarded_delete_encounter(
    session: &SessionState,
    conn: &Connection,
    photos_dir: &Path,
    id: i64,
) -> Result<()> {
    session.require_auth()?;
    encounter_service::delete_encounter(conn, photos_dir, id)
}

pub fn guarded_delete_all_data(
    session: &SessionState,
    conn: &Connection,
    photos_dir: &Path,
) -> Result<()> {
    session.require_auth()?;
    encounter_service::delete_all_data(conn, photos_dir)
}
