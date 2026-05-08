-- P2-AI-13: staging candidates generated from approved document extractions.

CREATE TABLE IF NOT EXISTS document_extraction_candidates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES document_ingestion_jobs(id) ON DELETE CASCADE,
  extraction_id TEXT NOT NULL REFERENCES document_extractions(id) ON DELETE CASCADE,
  candidate_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  target_entity_type TEXT NOT NULL DEFAULT 'none',
  target_entity_id TEXT,
  source_path TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  confidence_score REAL,
  review_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  applied_at TEXT,
  applied_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_document_extraction_candidates_tenant ON document_extraction_candidates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_extraction_candidates_property ON document_extraction_candidates(property_id);
CREATE INDEX IF NOT EXISTS idx_document_extraction_candidates_document ON document_extraction_candidates(document_id);
CREATE INDEX IF NOT EXISTS idx_document_extraction_candidates_job ON document_extraction_candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_document_extraction_candidates_extraction ON document_extraction_candidates(extraction_id);
CREATE INDEX IF NOT EXISTS idx_document_extraction_candidates_type ON document_extraction_candidates(candidate_type);
CREATE INDEX IF NOT EXISTS idx_document_extraction_candidates_status ON document_extraction_candidates(status);
