use crate::error::{AppError, Result};
use crate::models::Encounter;
use rusqlite::{params, Connection, OptionalExtension};

#[derive(Debug, Default, Clone)]
pub struct EncounterFilter {
    pub query: Option<String>,
    pub from: Option<String>, // ISO date
    pub to: Option<String>,   // ISO date
    pub desc: bool,
}

fn escape_like(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

// Cria a tabela com regras de integridade (CHECK) diretamente no SQLite
pub fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS encounters (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            date        TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
            location    TEXT    NOT NULL CHECK (length(trim(location)) BETWEEN 1 AND 120),
            description TEXT    NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
            photo_file  TEXT    NULL,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_encounters_date ON encounters(date, id);
        PRAGMA user_version = 1;
        "#
    ).map_err(|e| AppError::Database(e.to_string()))?;

    Ok(())
}

// Inserir novo encontro
pub fn insert_encounter(
    conn: &Connection,
    date: &str,
    location: &str,
    description: &str,
    photo_file: Option<&str>,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO encounters (date, location, description, photo_file) VALUES (?1, ?2, ?3, ?4)",
        params![date, location, description, photo_file],
    )
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(conn.last_insert_rowid())
}

// Consultar um encontro por ID
pub fn get_encounter(conn: &Connection, id: i64) -> Result<Encounter> {
    let mut stmt = conn.prepare(
        "SELECT id, date, location, description, photo_file, created_at, updated_at FROM encounters WHERE id = ?1"
    ).map_err(|e| AppError::Database(e.to_string()))?;

    let encounter = stmt
        .query_row(params![id], |row| {
            Ok(Encounter {
                id: row.get(0)?,
                date: row.get(1)?,
                location: row.get(2)?,
                description: row.get(3)?,
                photo_file: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .optional()
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound)?;

    Ok(encounter)
}

pub enum Order {
    Asc,
    Desc,
}

// Listagem com suporte a ordenação cronológica e desempate estável por ID
pub fn list_encounters(conn: &Connection, order: Order) -> Result<Vec<Encounter>> {
    let order_clause = match order {
        Order::Asc => "ORDER BY date ASC, id ASC",
        Order::Desc => "ORDER BY date DESC, id DESC",
    };

    let query = format!(
        "SELECT id, date, location, description, photo_file, created_at, updated_at FROM encounters {}",
        order_clause
    );

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| AppError::Database(e.to_string()))?;

    let encounters_iter = stmt
        .query_map([], |row| {
            Ok(Encounter {
                id: row.get(0)?,
                date: row.get(1)?,
                location: row.get(2)?,
                description: row.get(3)?,
                photo_file: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut encounters = Vec::new();
    for encounter_result in encounters_iter {
        encounters.push(encounter_result.map_err(|e| AppError::Database(e.to_string()))?);
    }

    Ok(encounters)
}

// Atualizar registo existente
pub fn update_encounter(
    conn: &Connection,
    id: i64,
    date: &str,
    location: &str,
    description: &str,
    photo_file: Option<&str>,
) -> Result<()> {
    let affected = conn.execute(
        "UPDATE encounters SET date = ?1, location = ?2, description = ?3, photo_file = ?4, updated_at = datetime('now') WHERE id = ?5",
        params![date, location, description, photo_file, id],
    ).map_err(|e| AppError::Database(e.to_string()))?;

    if affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

// Remover registo por ID
pub fn delete_encounter(conn: &Connection, id: i64) -> Result<()> {
    let affected = conn
        .execute("DELETE FROM encounters WHERE id = ?1", params![id])
        .map_err(|e| AppError::Database(e.to_string()))?;

    if affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

pub fn delete_all_encounters(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM encounters", [])
        .map_err(|e| AppError::Database(e.to_string()))?;

    // Zera o AUTOINCREMENT para o próximo id voltar a 1.
    // A tabela sqlite_sequence existe apenas quando há AUTOINCREMENT, então
    // ignoramos o erro se ela não existir.
    let _ = conn.execute("DELETE FROM sqlite_sequence WHERE name = 'encounters'", []);

    Ok(())
}

/// Lista com filtros opcionais. Sem filtros, é idêntico a `list_encounters`.
pub fn list_encounters_filtered(
    conn: &Connection,
    filter: &EncounterFilter,
) -> Result<Vec<Encounter>> {
    let mut sql = String::from(
        "SELECT id, date, location, description, photo_file, created_at, updated_at FROM encounters WHERE 1=1",
    );
    let mut binds: Vec<String> = Vec::new();

    if let Some(from) = &filter.from {
        sql.push_str(&format!(" AND date >= ?{}", binds.len() + 1));
        binds.push(from.clone());
    }
    if let Some(to) = &filter.to {
        sql.push_str(&format!(" AND date <= ?{}", binds.len() + 1));
        binds.push(to.clone());
    }
    if let Some(q) = &filter.query {
        if !q.trim().is_empty() {
            let pattern = format!("%{}%", escape_like(q.trim()));
            let n = binds.len() + 1;
            sql.push_str(&format!(
                " AND (location LIKE ?{n} ESCAPE '\\' OR description LIKE ?{n} ESCAPE '\\')"
            ));
            binds.push(pattern);
        }
    }

    sql.push_str(match filter.desc {
        true => " ORDER BY date DESC, id DESC",
        false => " ORDER BY date ASC, id ASC",
    });

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| AppError::Database(e.to_string()))?;

    let iter = stmt
        .query_map(rusqlite::params_from_iter(binds.iter()), |row| {
            Ok(Encounter {
                id: row.get(0)?,
                date: row.get(1)?,
                location: row.get(2)?,
                description: row.get(3)?,
                photo_file: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut out = Vec::new();
    for r in iter {
        out.push(r.map_err(|e| AppError::Database(e.to_string()))?);
    }
    Ok(out)
}

// TESTES INICIAM AQUI

#[cfg(test)]
mod tests {
    use super::*;

    // Criação de base de dados em memória isolada por caso de teste
    fn setup_memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        conn
    }

    // UT-14: Migração idempotente (execuções subsequentes preservam a integridade)
    #[test]
    fn test_migrate_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        assert!(migrate(&conn).is_ok());
        assert!(migrate(&conn).is_ok());

        let version: i32 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 1);
    }

    // UT-10: Inserção e recuperação de registo
    #[test]
    fn test_insert_and_get() {
        let conn = setup_memory_db();

        let id =
            insert_encounter(&conn, "2024-02-14", "Cinema", "Nosso primeiro filme", None).unwrap();
        assert!(id >= 1);

        let encounter = get_encounter(&conn, id).unwrap();
        assert_eq!(encounter.date, "2024-02-14");
        assert_eq!(encounter.location, "Cinema");
        assert_eq!(encounter.description, "Nosso primeiro filme");
        assert_eq!(encounter.photo_file, None);
    }

    // UT-13: Defesa por constraints de validação (CHECK constraints)
    #[test]
    fn test_database_constraints() {
        let conn = setup_memory_db();

        let err = insert_encounter(&conn, "14-02-2024", "Local", "", None).unwrap_err();
        assert!(matches!(err, AppError::Database(_)));
    }

    // UT-11: Ordenação cronológica ascendente com desempate por ID (RN07)
    #[test]
    fn test_list_encounters_asc() {
        let conn = setup_memory_db();

        insert_encounter(&conn, "2024-03-01", "Parque", "", None).unwrap(); // id 1
        insert_encounter(&conn, "2024-01-10", "Café", "", None).unwrap(); // id 2
        insert_encounter(&conn, "2024-01-10", "Restaurante", "", None).unwrap(); // id 3

        let list = list_encounters(&conn, Order::Asc).unwrap();

        assert_eq!(list.len(), 3);
        assert_eq!(list[0].id, 2);
        assert_eq!(list[1].id, 3);
        assert_eq!(list[2].id, 1);
    }

    // UT-12: Ordenação cronológica descendente com desempate por ID
    #[test]
    fn test_list_encounters_desc() {
        let conn = setup_memory_db();

        insert_encounter(&conn, "2024-03-01", "Parque", "", None).unwrap(); // id 1
        insert_encounter(&conn, "2024-01-10", "Café", "", None).unwrap(); // id 2
        insert_encounter(&conn, "2024-01-10", "Restaurante", "", None).unwrap(); // id 3

        let list = list_encounters(&conn, Order::Desc).unwrap();

        assert_eq!(list.len(), 3);
        assert_eq!(list[0].id, 1);
        assert_eq!(list[1].id, 3);
        assert_eq!(list[2].id, 2);
    }

    #[test]
    fn test_delete_all_encounters_resets_autoincrement() {
        let conn = setup_memory_db();
        insert_encounter(&conn, "2024-05-20", "A", "", None).unwrap();
        insert_encounter(&conn, "2024-05-21", "B", "", None).unwrap();

        delete_all_encounters(&conn).unwrap();
        assert!(list_encounters(&conn, Order::Asc).unwrap().is_empty());

        // próximo id deve voltar a 1
        let id = insert_encounter(&conn, "2024-05-22", "C", "", None).unwrap();
        assert_eq!(id, 1);
    }

    // UT-36: filtro por query em location ou description (case-insensitive)
    #[test]
    fn test_filter_by_query() {
        let conn = setup_memory_db();
        insert_encounter(&conn, "2024-05-20", "Praia", "Pôr do sol lindo", None).unwrap();
        insert_encounter(&conn, "2024-05-21", "Serra", "Frio intenso", None).unwrap();
        insert_encounter(&conn, "2024-05-22", "Restaurante", "Comemos praia", None).unwrap();

        let f = EncounterFilter {
            query: Some("PRAIA".into()),
            ..Default::default()
        };
        let out = list_encounters_filtered(&conn, &f).unwrap();
        assert_eq!(out.len(), 2); // "Praia" e "Comemos praia"
    }

    // UT-37: filtro por intervalo de datas
    #[test]
    fn test_filter_by_date_range() {
        let conn = setup_memory_db();
        insert_encounter(&conn, "2024-01-10", "A", "", None).unwrap();
        insert_encounter(&conn, "2024-05-20", "B", "", None).unwrap();
        insert_encounter(&conn, "2024-12-31", "C", "", None).unwrap();

        let f = EncounterFilter {
            from: Some("2024-05-01".into()),
            to: Some("2024-05-31".into()),
            ..Default::default()
        };
        let out = list_encounters_filtered(&conn, &f).unwrap();
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].location, "B");
    }

    // UT-38: query com % e _ é escapada (não vira wildcard)
    #[test]
    fn test_filter_escapes_like_wildcards() {
        let conn = setup_memory_db();
        insert_encounter(&conn, "2024-05-20", "100% Praia", "", None).unwrap();
        insert_encounter(&conn, "2024-05-21", "Serra", "", None).unwrap();

        let f = EncounterFilter {
            query: Some("% Praia".into()), // sem escape, casaria qualquer coisa
            ..Default::default()
        };
        let out = list_encounters_filtered(&conn, &f).unwrap();
        assert_eq!(out.len(), 1); // só o "100% Praia"
    }
}
