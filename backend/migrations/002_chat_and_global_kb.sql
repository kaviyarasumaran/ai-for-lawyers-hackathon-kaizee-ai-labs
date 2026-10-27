-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default-user',
    tenant_id TEXT NOT NULL DEFAULT 'default-tenant',
    case_id TEXT REFERENCES cases(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New chat',
    knowledge_scope TEXT NOT NULL DEFAULT 'combined'
        CHECK (knowledge_scope IN ('global', 'case', 'combined')),
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations (user_id, tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_case_idx ON conversations (case_id);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, created_at ASC);

-- Case access permissions table
CREATE TABLE IF NOT EXISTS case_access (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'lawyer', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (case_id, user_id)
);

CREATE INDEX IF NOT EXISTS case_access_user_idx ON case_access (user_id, case_id);

-- Global legal documents table
CREATE TABLE IF NOT EXISTS global_legal_documents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT, -- NULL denotes public/shared global legal authority
    title TEXT NOT NULL,
    document_type TEXT NOT NULL DEFAULT 'statute'
        CHECK (document_type IN ('statute', 'regulation', 'judgment', 'precedent', 'reference', 'policy')),
    jurisdiction TEXT NOT NULL DEFAULT 'Federal',
    source TEXT NOT NULL DEFAULT 'official',
    url TEXT,
    publication_date DATE,
    effective_date DATE,
    content_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS global_docs_tenant_idx ON global_legal_documents (tenant_id);

-- Global legal chunks table (with 768-dim vector embeddings and tsvector search)
CREATE TABLE IF NOT EXISTS global_legal_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES global_legal_documents(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    page_start INTEGER NOT NULL DEFAULT 1,
    page_end INTEGER NOT NULL DEFAULT 1,
    section TEXT,
    content TEXT NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, ordinal)
);

CREATE INDEX IF NOT EXISTS global_chunks_doc_idx ON global_legal_chunks (document_id);
CREATE INDEX IF NOT EXISTS global_chunks_search_idx ON global_legal_chunks USING gin (search_vector);
CREATE INDEX IF NOT EXISTS global_chunks_embedding_idx ON global_legal_chunks USING hnsw (embedding vector_cosine_ops);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON audit_logs (user_id, tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON audit_logs (resource_type, resource_id);
