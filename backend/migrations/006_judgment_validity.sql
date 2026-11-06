-- Migration 006: Judgment Validity Tracking and Treatment Citations

CREATE TABLE IF NOT EXISTS judgments (
    id VARCHAR(64) PRIMARY KEY,
    title TEXT NOT NULL,
    court TEXT NOT NULL,
    citation TEXT,
    neutral_citation TEXT,
    judgment_date TEXT,
    source_url TEXT,
    content TEXT,
    year INTEGER,
    bench_strength INTEGER DEFAULT 2,
    judges TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_judgments_title ON judgments (title);
CREATE INDEX IF NOT EXISTS idx_judgments_citation ON judgments (citation);
CREATE INDEX IF NOT EXISTS idx_judgments_neutral_citation ON judgments (neutral_citation);
CREATE INDEX IF NOT EXISTS idx_judgments_court ON judgments (court);

CREATE TABLE IF NOT EXISTS judgment_citations (
    id VARCHAR(64) PRIMARY KEY,
    citing_judgment_id VARCHAR(64) NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
    cited_judgment_id VARCHAR(64) NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
    paragraph_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jc_citing ON judgment_citations (citing_judgment_id);
CREATE INDEX IF NOT EXISTS idx_jc_cited ON judgment_citations (cited_judgment_id);

CREATE TABLE IF NOT EXISTS judgment_treatments (
    id VARCHAR(64) PRIMARY KEY,
    original_judgment_id VARCHAR(64) NOT NULL REFERENCES judgments(id) ON DELETE CASCADE,
    later_judgment_id VARCHAR(64) REFERENCES judgments(id) ON DELETE SET NULL,
    treatment_type VARCHAR(64) NOT NULL,
    legal_proposition TEXT NOT NULL,
    supporting_text TEXT NOT NULL,
    paragraph_reference TEXT,
    confidence FLOAT NOT NULL DEFAULT 1.0,
    verification_status VARCHAR(64) NOT NULL DEFAULT 'EVIDENCE_REVIEW_REQUIRED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jt_original ON judgment_treatments (original_judgment_id);
CREATE INDEX IF NOT EXISTS idx_jt_treatment ON judgment_treatments (treatment_type);
