-- Migration 0002: Add missing columns to maintenance_schedules
-- + description, responsible
-- + weekly to frequency CHECK (recreate table — SQLite cannot ALTER CHECK)

PRAGMA foreign_keys = OFF;

CREATE TABLE maintenance_schedules_new (
  id            TEXT PRIMARY KEY,
  property_id   TEXT NOT NULL REFERENCES properties(id),
  system_type   TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  frequency     TEXT NOT NULL CHECK(frequency IN ('weekly','monthly','quarterly','semiannual','annual')),
  last_done     TEXT,
  next_due      TEXT,
  responsible   TEXT,
  auto_create_os INTEGER DEFAULT 0,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT
);

INSERT INTO maintenance_schedules_new
  (id, property_id, system_type, title, frequency,
   last_done, next_due, auto_create_os, notes, created_at, deleted_at)
SELECT
  id, property_id, system_type, title, frequency,
  last_done, next_due, auto_create_os, notes, created_at, deleted_at
FROM maintenance_schedules;

DROP TABLE maintenance_schedules;
ALTER TABLE maintenance_schedules_new RENAME TO maintenance_schedules;

CREATE INDEX IF NOT EXISTS idx_schedules_property
  ON maintenance_schedules(property_id) WHERE deleted_at IS NULL;

PRAGMA foreign_keys = ON;
