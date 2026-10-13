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