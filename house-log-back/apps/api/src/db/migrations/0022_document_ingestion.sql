-- P2-AI-02: base tables for intelligent document ingestion.

CREATE TABLE IF NOT EXISTS document_ingestion_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  provider TEXT NOT NULL DEFAULT 'none',
  model_name TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_document_ingestion_jobs_tenant ON document_ingestion_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_ingestion_jobs_property ON document_ingestion_jobs(property_id);
CREATE INDEX IF NOT EXISTS idx_document_ingestion_jobs_document ON document_ingestion_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_document_ingestion_jobs_status ON document_ingestion_jobs(status);

CREATE TABLE IF NOT EXISTS document_extractions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES document_ingestion_jobs(id) ON DELETE CASCADE,
  raw_text TEXT,
  raw_json TEXT,
  normalized_json TEXT,
  confidence_score REAL,
  schema_version TEXT NOT NULL DEFAULT 'v1',
  model_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_document_extractions_tenant ON document_extractions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_property ON document_extractions(property_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_document ON document_extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_job ON document_extractions(job_id);

CREATE TABLE IF NOT EXISTS document_extraction_reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  extraction_id TEXT NOT NULL REFERENCES document_extractions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_document_extraction_reviews_tenant ON document_extraction_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_extraction_reviews_property ON document_extraction_reviews(property_id);
CREATE INDEX IF NOT EXISTS idx_document_extraction_reviews_document ON document_extraction_reviews(document_id);
CREATE INDEX IF NOT EXISTS idx_document_extraction_reviews_extraction ON document_extraction_reviews(extraction_id);
CREATE INDEX IF NOT EXISTS idx_document_extraction_reviews_status ON document_extraction_reviews(status);
