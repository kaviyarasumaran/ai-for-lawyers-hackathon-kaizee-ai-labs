-- Migration 003: Chat attachments and Chat Knowledge Base chunks

CREATE TABLE IF NOT EXISTS chat_attachments (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL DEFAULT 'default-chat',
    name TEXT NOT NULL,
    size BIGINT NOT NULL CHECK (size >= 0),
    content_type TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'upload',
    path TEXT NOT NULL,
    url TEXT NOT NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    pipeline_status TEXT NOT NULL DEFAULT 'staged'
        CHECK (pipeline_status IN ('staged', 'queued', 'processing', 'completed', 'failed')),
    pipeline_stage TEXT NOT NULL DEFAULT 'queued',
    pipeline_error TEXT,
    extracted_text TEXT,
    page_count INTEGER,
    chunk_count INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_attachments_chat_idx ON chat_attachments (chat_id, added_at DESC);

CREATE TABLE IF NOT EXISTS chat_chunks (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    attachment_id TEXT NOT NULL REFERENCES chat_attachments(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    page_start INTEGER NOT NULL,
    page_end INTEGER NOT NULL,
    content TEXT NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (attachment_id, ordinal)
);

CREATE INDEX IF NOT EXISTS chat_chunks_chat_idx ON chat_chunks (chat_id);
CREATE INDEX IF NOT EXISTS chat_chunks_search_idx ON chat_chunks USING gin (search_vector);
CREATE INDEX IF NOT EXISTS chat_chunks_embedding_idx ON chat_chunks USING hnsw (embedding vector_cosine_ops);
