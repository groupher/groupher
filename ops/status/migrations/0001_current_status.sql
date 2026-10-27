CREATE TABLE IF NOT EXISTS service_status (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('up', 'degraded', 'down')),
  streak INTEGER NOT NULL,
  response_ms INTEGER,
  checked_at TEXT NOT NULL
);
