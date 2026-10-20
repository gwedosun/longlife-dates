use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::error::{AppError, Result};

pub const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10 MB

#[derive(Debug, PartialEq)]
pub enum ImageType {
    Jpeg,
    Png,
    Webp,
}

impl ImageType {
    /// extensão rust para gravar em disco (RN09)
    pub fn extension(&self) -> &'static str {
        match self {
            ImageType::Jpeg => "jpg",
            ImageType::Png => "png",
            ImageType::Webp => "webp",
        }
    }
}


pub fn validate_image_size(size: u64) -> Result<()> {
    if size > MAX_FILE_SIZE {
        return Err(AppError::ImageTooLarge);
    }
    Ok(())
}

pub fn detect_image_type(bytes: &[u8]) -> Result<ImageType> {
    if bytes.len() < 12 {
        return Err(AppError::InvalidImage);
    }
    if bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
        return Ok(ImageType::Jpeg);
    }
    if bytes[0..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] {
        return Ok(ImageType::Png);
    }
    if &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Ok(ImageType::Webp);
    }
    Err(AppError::InvalidImage)
}


/// valida se o nome é limpo
pub fn validate_filename(name: &str) -> Result<()> {
    if name.is_empty() || name.len() > 200 {
        return Err(AppError::InvalidImage);
    }
    if name.contains("..") || name.contains('/') || name.contains('\\') {
        return Err(AppError::InvalidImage);
    }
    if name.chars().any(|c| c.is_control()) {
        return Err(AppError::InvalidImage);
    }
    Ok(())
}

/// grava os bytes de forma atômica e devolve o nome gerado.
pub fn save_photo(bytes: &[u8], photos_dir: &Path) -> Result<String> {
    // Valida tamanho 
    validate_image_size(bytes.len() as u64)?;

    // Descobre o tipo real com magic bytes
    let kind = detect_image_type(bytes)?;

    // Gera nome unico e nao aceita nome vindo de fora
    let filename = format!("{}.{}", uuid::Uuid::new_v4(), kind.extension());

    // Garante que a pasta existe
    fs::create_dir_all(photos_dir).map_err(|e| AppError::Io(e.to_string()))?;

    let final_path = photos_dir.join(&filename);
    let tmp_path = photos_dir.join(format!("{}.tmp", filename));

    // escreve em tmp, fsync, renomeia
    {
        let mut file = fs::File::create(&tmp_path).map_err(|e| AppError::Io(e.to_string()))?;
        file.write_all(bytes)
            .map_err(|e| AppError::Io(e.to_string()))?;
        file.sync_all().map_err(|e| AppError::Io(e.to_string()))?;
    }

    fs::rename(&tmp_path, &final_path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        AppError::Io(e.to_string())
    })?;

    Ok(filename)
}

/// apaga uma foto
pub fn delete_photo(filename: &str, photos_dir: &Path) -> Result<()> {
    validate_filename(filename)?;

    let path = photos_dir.join(filename);
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(AppError::Io(e.to_string())),
    }
}

/// caminho absoluto para uma foto já validada (usado pelo Tauri).
pub fn photo_path(filename: &str, photos_dir: &Path) -> Result<PathBuf> {
    validate_filename(filename)?;
    Ok(photos_dir.join(filename))
}

/// pasta de fotos de um root, para testar. contato com tauri fica em commands.rs
pub fn photos_dir(root: &Path) -> PathBuf {
    root.join("photos")
}

// ============ Testes ============

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    // --- Fase 1 (mantidos) ---

    #[test]
    fn test_detect_image_type_valid() {
        let jpeg = [
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x44, 0x46, 0x49, 0x46, 0x00, 0x01,
        ];
        let png = [
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x0A, 0x00, 0x00, 0x00, 0x00,
        ];
        let webp = b"RIFF\x12\x34\x56\x78WEBP";
        assert_eq!(detect_image_type(&jpeg).unwrap(), ImageType::Jpeg);
        assert_eq!(detect_image_type(&png).unwrap(), ImageType::Png);
        assert_eq!(detect_image_type(webp).unwrap(), ImageType::Webp);
    }

    #[test]
    fn test_detect_image_type_invalid() {
        let fake = b"Isso e um arquivo falso disfarcado";
        assert!(matches!(
            detect_image_type(fake).unwrap_err(),
            AppError::InvalidImage
        ));
    }

    #[test]
    fn test_validate_image_size() {
        let exactly_10mb = 10 * 1024 * 1024;
        assert!(validate_image_size(exactly_10mb).is_ok());
        assert!(matches!(
            validate_image_size(exactly_10mb + 1).unwrap_err(),
            AppError::ImageTooLarge
        ));
    }

    // --- Fase 3 ---

    // UT-15: grava uma foto PNG válida e devolve um nome único
    #[test]
    fn test_save_photo_happy_path() {
        let dir = temp_dir("save_happy");
        let png_bytes = fake_png();

        let name = save_photo(&png_bytes, &dir).unwrap();

        assert!(name.ends_with(".png"));
        assert!(dir.join(&name).exists());
        assert!(dir.join(format!("{}.tmp", name)).exists() == false);

        // limpeza
        let _ = fs::remove_dir_all(&dir);
    }

    // UT-16: nome gerado pelo sistema não confia no usuário (RN08)
    #[test]
    fn test_save_photo_generates_unique_names() {
        let dir = temp_dir("save_unique");
        let png_bytes = fake_png();

        let a = save_photo(&png_bytes, &dir).unwrap();
        let b = save_photo(&png_bytes, &dir).unwrap();

        assert_ne!(a, b, "cada save deve gerar um nome novo");
        assert!(dir.join(&a).exists());
        assert!(dir.join(&b).exists());

        let _ = fs::remove_dir_all(&dir);
    }

    // UT-17: bytes que não são imagem são rejeitados mesmo com tamanho ok
    #[test]
    fn test_save_photo_rejects_non_image() {
        let dir = temp_dir("save_bad");

        let err = save_photo(b"nao sou uma imagem valida", &dir).unwrap_err();
        assert!(matches!(err, AppError::InvalidImage));

        // Não deve deixar sujeira
        let entries: Vec<_> = fs::read_dir(&dir)
            .map(|it| it.filter_map(|e| e.ok()).collect())
            .unwrap_or_default();
        assert!(entries.is_empty(), "pasta deve ficar vazia apos falha");

        let _ = fs::remove_dir_all(&dir);
    }

    // UT-18: validate_filename bloqueia path traversal (RN11)
    #[test]
    fn test_validate_filename_blocks_traversal() {
        assert!(validate_filename("../secret.png").is_err());
        assert!(validate_filename("sub/dir.png").is_err());
        assert!(validate_filename("sub\\dir.png").is_err());
        assert!(validate_filename("normal.png").is_ok());
        assert!(validate_filename("").is_err());
    }

    // UT-19: delete_photo é idempotente (RN12)
    #[test]
    fn test_delete_photo_idempotent() {
        let dir = temp_dir("delete_idem");
        let png_bytes = fake_png();
        let name = save_photo(&png_bytes, &dir).unwrap();

        assert!(delete_photo(&name, &dir).is_ok());
        // segunda vez não deve falhar
        assert!(delete_photo(&name, &dir).is_ok());

        let _ = fs::remove_dir_all(&dir);
    }

    // UT-20: delete_photo rejeita nomes perigosos sem tocar no disco
    #[test]
    fn test_delete_photo_rejects_traversal() {
        let dir = temp_dir("delete_traversal");
        let err = delete_photo("../../etc/passwd", &dir).unwrap_err();
        assert!(matches!(err, AppError::InvalidImage));
        let _ = fs::remove_dir_all(&dir);
    }

    // UT-21: photos_dir sempre aninha em "photos"
    #[test]
    fn test_photos_dir_joins_subfolder() {
        let root = PathBuf::from("algum/lugar");
        assert_eq!(photos_dir(&root), PathBuf::from("algum/lugar/photos"));
    }

    // --- helpers ---

    fn temp_dir(tag: &str) -> PathBuf {
        let mut p = env::temp_dir();
        p.push(format!("longlife_test_{}_{}", tag, uuid::Uuid::new_v4()));
        p
    }

    fn fake_png() -> Vec<u8> {
        // 8 magic bytes + payload qualquer (detect só olha o header)
        let mut v = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        v.extend_from_slice(b"\x00\x00\x00\x0DIHDRdummy");
        v
    }
}
