CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    title TEXT NOT NULL,
    matter_type TEXT NOT NULL,
    parties TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    generated_summary TEXT,
    findings JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'Open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_documents (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    size BIGINT NOT NULL CHECK (size >= 0),
    content_type TEXT NOT NULL,
    source TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    pipeline_status TEXT NOT NULL DEFAULT 'queued'
        CHECK (pipeline_status IN ('queued', 'processing', 'completed', 'failed')),
    pipeline_stage TEXT NOT NULL DEFAULT 'queued',
    pipeline_error TEXT,
    extracted_text TEXT,
    page_count INTEGER,
    chunk_count INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_jobs (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    document_id TEXT UNIQUE REFERENCES case_documents(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('document', 'case_summary')),
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    stage TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lease_expires_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((kind = 'document' AND document_id IS NOT NULL)
        OR (kind = 'case_summary' AND document_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS case_jobs_active_summary_idx
    ON case_jobs (case_id)
    WHERE kind = 'case_summary' AND status IN ('queued', 'running');
CREATE INDEX IF NOT EXISTS case_jobs_claim_idx
    ON case_jobs (status, available_at, created_at);
CREATE INDEX IF NOT EXISTS case_documents_case_idx
    ON case_documents (case_id, added_at);

CREATE TABLE IF NOT EXISTS case_chunks (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES case_documents(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    page_start INTEGER NOT NULL,
    page_end INTEGER NOT NULL,
    content TEXT NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, ordinal)
);

CREATE INDEX IF NOT EXISTS case_chunks_case_idx ON case_chunks (case_id);
CREATE INDEX IF NOT EXISTS case_chunks_search_idx
    ON case_chunks USING gin (search_vector);
CREATE INDEX IF NOT EXISTS case_chunks_embedding_idx
    ON case_chunks USING hnsw (embedding vector_cosine_ops);
