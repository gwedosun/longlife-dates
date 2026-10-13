use crate::error::{AppError, Result};
use chrono::NaiveDate;

pub fn validate_date(date: &str) -> Result<()> {
    NaiveDate::parse_from_str(date, "%Y-%m-%d").map_err(|_| AppError::InvalidDate)?;
    Ok(())
}

pub fn validate_location(location: &str) -> Result<String> {
    let trimmed = location.trim();
    if trimmed.is_empty() || trimmed.len() > 120 {
        return Err(AppError::InvalidLocation);
    }
    Ok(trimmed.to_string())
}

pub fn validate_description(description: &str) -> Result<()> {
    if description.len() > 5000 {
        return Err(AppError::DescriptionTooLong);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::AppError;

    #[test]
    fn test_validate_date_valid() {
        assert!(validate_date("2024-02-29").is_ok());
    }

    #[test]
    fn test_validate_date_nonexistent() {
        let err = validate_date("2023-02-29").unwrap_err();
        assert!(matches!(err, AppError::InvalidDate));
    }

    #[test]
    fn test_validate_date_invalid_format() {
        assert!(matches!(
            validate_date("14/02/2024").unwrap_err(),
            AppError::InvalidDate
        ));
        assert!(matches!(
            validate_date("").unwrap_err(),
            AppError::InvalidDate
        ));
    }

    #[test]
    fn test_validate_location_empty() {
        assert!(matches!(
            validate_location("   ").unwrap_err(),
            AppError::InvalidLocation
        ));
    }

    #[test]
    fn test_validate_location_trim_and_limit() {
        assert_eq!(validate_location(" Praia ").unwrap(), "Praia");

        let long_location = "a".repeat(121);
        assert!(matches!(
            validate_location(&long_location).unwrap_err(),
            AppError::InvalidLocation
        ));
    }

    #[test]
    fn test_validate_description_limit() {
        let long_desc = "a".repeat(5001);
        assert!(matches!(
            validate_description(&long_desc).unwrap_err(),
            AppError::DescriptionTooLong
        ));

        let valid_desc = "a".repeat(5000);
        assert!(validate_description(&valid_desc).is_ok());
    }
}
