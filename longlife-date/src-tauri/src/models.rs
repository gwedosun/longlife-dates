use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Encounter {
    pub id: i64,
    pub date: String,
    pub location: String,
    pub description: String,
    pub photo_file: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
