-- Property collaborators: users invited to access a property
CREATE TABLE IF NOT EXISTS property_collaborators (
  id          TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id),
  role        TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('viewer','provider','manager')),
  invited_by  TEXT REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(property_id, user_id)
);

-- Pending email invitations
CREATE TABLE IF NOT EXISTS property_invites (
  id          TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  invited_by  TEXT NOT NULL REFERENCES users(id),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('viewer','provider','manager')),
  token       TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  accepted_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_collaborators_property ON property_collaborators(property_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user     ON property_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_invites_token          ON property_invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_property       ON property_invites(property_id);
