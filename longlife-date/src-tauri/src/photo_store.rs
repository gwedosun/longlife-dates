use crate::error::{AppError, Result};

const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10 MB

#[derive(Debug, PartialEq)]
pub enum ImageType {
    Jpeg,
    Png,
    Webp,
}

pub fn validate_image_size(size: u64) -> Result<()> {
    if size > MAX_FILE_SIZE {
        return Err(AppError::ImageTooLarge);
    }
    Ok(())
}

pub fn detect_image_type(bytes: &[u8]) -> Result<ImageType> {
    // Um cabeçalho mínimo para verificarmos as assinaturas
    if bytes.len() < 12 {
        return Err(AppError::InvalidImage);
    }

    // Assinatura JPEG: FF D8 FF
    if bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF {
        return Ok(ImageType::Jpeg);
    }
    
    // Assinatura PNG: 89 50 4E 47 0D 0A 1A 0A
    if bytes[0..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] {
        return Ok(ImageType::Png);
    }
    
    // Assinatura WebP: RIFF .... WEBP
    if &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Ok(ImageType::Webp);
    }

    Err(AppError::InvalidImage)
}

#[cfg(test)]
mod tests {
    use super::*;

    // UT-07: Magic bytes aceitos
    #[test]
    fn test_detect_image_type_valid() {
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01];
        let png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D];
        let webp = b"RIFF\x12\x34\x56\x78WEBP";

        assert_eq!(detect_image_type(&jpeg).unwrap(), ImageType::Jpeg);
        assert_eq!(detect_image_type(&png).unwrap(), ImageType::Png);
        assert_eq!(detect_image_type(webp).unwrap(), ImageType::Webp);
    }

    // UT-08: Arquivo falso com extensão .jpg rejeitado[cite: 1]
    #[test]
    fn test_detect_image_type_invalid() {
        // Simulando um arquivo de texto renomeado para .jpg
        let fake_image = b"Isso e um arquivo falso disfar\xE7ado"; 
        let err = detect_image_type(fake_image).unwrap_err();
        assert!(matches!(err, AppError::InvalidImage));
    }

    // UT-09: Imagem > 10 MB rejeitada[cite: 1]
    #[test]
    fn test_validate_image_size() {
        let exactly_10mb = 10 * 1024 * 1024;
        assert!(validate_image_size(exactly_10mb).is_ok());

        let too_big = exactly_10mb + 1;
        assert!(matches!(validate_image_size(too_big).unwrap_err(), AppError::ImageTooLarge));
    }
}