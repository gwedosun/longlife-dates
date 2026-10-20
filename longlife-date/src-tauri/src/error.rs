use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum AppError {
    #[error("Data inválida ou em formato incorreto")]
    InvalidDate,

    #[error("O local do encontro é inválido")]
    InvalidLocation,

    #[error("A descrição excedeu o limite máximo de 5000 caracteres")]
    DescriptionTooLong,

    #[error("Formato de imagem inválido. Apenas JPEG, PNG e WebP são aceitos.")]
    InvalidImage,

    #[error("A imagem excede o limite de tamanho permitido de 10 MB")]
    ImageTooLarge,

    #[error("Registro não encontrado")]
    NotFound,

    #[error("O nome do arquivo é inválido ou contém caracteres não permitidos")]
    InvalidFileName,

    #[error("A senha deve ter pelo menos 4 caracteres")]
    InvalidPassword,

    #[error("Senha incorreta. Tente novamente.")]
    InvalidCredentials,

    #[error("Sessão bloqueada. Faça login para continuar.")]
    Unauthorized,

    #[error("A conta já foi configurada")]
    AccountAlreadyExists,

    #[error("Erro no banco de dados: {0}")]
    Database(String),

    #[error("Erro de sistema de arquivos (I/O): {0}")]
    Io(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
