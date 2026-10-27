# Production-Ready Legal AI Chat Backend

FastAPI backend with a grounded Legal AI Agent and RAG architecture for the Legal Case Management application. Integrates with the existing frontend while supporting both legacy `/api/chat` and the modern `/api/v1` chat endpoints.

---

## Architecture Overview

- **Legal AI Agent**: Deterministic orchestration pipeline supporting:
  - Query classification (`case_summary`, `deadline_action_items`, `parties_dates_events`, `legal_research`, `fact_law_comparison`, `document_qa`)
  - Ambiguity resolution and legal shorthand query rewriting (`app/retrieval/query_rewriter.py`)
  - Scope-based routing across **Global Knowledge** and **Case Knowledge**
  - Centralized, versioned legal system prompt (`app/prompts/system_prompt.py`)
  - Strict prompt-injection mitigation delimiters
  - Programmatic citation validation (`app/agent/citation_validator.py`)
  - Structured responses with verified source citations
- **Multi-Scope Knowledge Retrieval**:
  - **Global Scope**: Queries statutes, regulations, precedents, and legal reference material in `global_legal_chunks`. Case documents are never queried in this scope.
  - **Case Scope**: Strictly pre-filters by `case_id` and verified user authorization before vector retrieval in `case_chunks`. Never searches across unauthorized cases.
  - **Combined Scope**: Merges evidence from both sources while preserving source identity (`global_legal_authority` vs `case_document`). Never confuses case facts with general law.
  - **Hybrid Search**: Combines pgvector cosine distance (`vector(768)`) with PostgreSQL full-text search (`tsvector` via Reciprocal Rank Fusion).
- **Automated Model Lifecycle Management** ([`app/model_manager.py`](file:///Users/kaviii/Documents/ai-for-lawyers-hackathon-kaizee-ai-labs/backend/app/model_manager.py)):
  - Automatically loads required models (embeddings or LLM) into memory when the processing pipeline triggers.
  - Automatically ejects (unloads) models upon pipeline completion to release GPU VRAM and system memory.
- **Authentication & Authorization**:
  - Verified `AuthContext` derived from `Authorization: Bearer <token>` or session context. Client-supplied IDs are never trusted for authorization.
  - Per-case access checks reject unauthorized queries before retrieval.
  - Tenant isolation and conversation ownership verification on all routes.
  - Request rate limiting per IP and user ID.
  - Audit logging for sensitive case access and completions in PostgreSQL.

---

## API Endpoints

### 1. Legacy Endpoint (Full Frontend Backward Compatibility)
- `POST /api/chat`
  - Accepts: `{ "messages": [...], "chatId": "...", "caseId": "..." }`
  - Returns: `{ "reply": "...", "model": "...", "chatId": "...", "sources": [...] }`

### 2. V1 Chat & Streaming API
- `POST /api/v1/chat`
  - Request body:
    ```json
    {
      "conversation_id": "optional-id",
      "message": "What are the key risks and upcoming deadlines in this case?",
      "case_id": "CASE_ID",
      "knowledge_scope": "combined",
      "filters": {},
      "stream": false
    }
    ```
  - Response (`ChatResponseV1`):
    ```json
    {
      "conversation_id": "string",
      "answer": "Generated legal response...",
      "citations": [
        {
          "source_id": "string",
          "document_id": "string",
          "document_title": "string",
          "source_type": "case_document",
          "page": 4,
          "section": "Page 4",
          "chunk_id": "string",
          "quote": "Supporting excerpt..."
        }
      ],
      "metadata": {
        "knowledge_scope": "combined",
        "case_id": "CASE_ID",
        "retrieval_performed": true,
        "insufficient_evidence": false,
        "question_type": "deadline_action_items"
      },
      "suggested_questions": [
        "What procedural triggering events determine these deadlines?",
        "Are there any tolling provisions or extensions that apply?"
      ]
    }
    ```
- `POST /api/v1/chat/stream`
  - Server-Sent Events (SSE) stream emitting:
    - `event: start` (conversation ID and metadata)
    - `event: delta` (incremental text tokens)
    - `event: citations` (programmatically validated citations)
    - `event: complete` (full structured response)
    - `event: error` (error details on failure)

### 3. Conversations Management
- `GET /api/v1/conversations`: List conversations for the authenticated user and tenant.
- `GET /api/v1/conversations/{conversation_id}/messages`: Get messages in chronological order (verifies conversation ownership).
- `DELETE /api/v1/conversations/{conversation_id}`: Delete a conversation (verifies conversation ownership).

---

## Configuration & Environment Variables

Create or update `.env` in `backend/`:

```env
APP_NAME=lawyer_api
APP_HOST=0.0.0.0
APP_PORT=8000

# PostgreSQL (cases, chunks, conversations, messages, global knowledge, audit logs)
POSTGRES_DSN=postgresql://postgres:<password>@<host>:5432/postgres
POSTGRES_TENANT_ID=

# MongoDB (legacy case migration, chat attachments, knowledge base files)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=lawyer_app

# LM Studio / OpenAI-compatible LLM Server
LLM_API_BASE_URL=http://localhost:1234/v1
LLM_API_KEY=
LLM_MODEL=google/gemma-4-e2b
LLM_TIMEOUT_SECONDS=60

# LM Studio Embeddings (768-dim)
EMBEDDING_API_BASE_URL=http://localhost:1234/v1
EMBEDDING_API_KEY=
EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5
EMBEDDING_TIMEOUT_SECONDS=60

# Supabase Storage
SUPABASE_URL=http://<host>:8000
SERVICE_ROLE_KEY=<supabase-service-role-key>
SUPABASE_BUCKET=case-documents
SUPABASE_TIMEOUT_SECONDS=120

# Chat & Retrieval Tuning
JWT_SECRET=dev-insecure-secret-key-replace-in-production
CHAT_HISTORY_WINDOW=10
RETRIEVAL_TOP_K=5
RETRIEVAL_RELEVANCE_THRESHOLD=0.01
RATE_LIMIT_PER_MINUTE=60
```

---

## Setup & Running Locally

1. **Activate Virtual Environment & Install Dependencies**:
   ```sh
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Start the FastAPI Backend**:
   ```sh
   uvicorn app.main:app --reload --port 8000
   ```
   *Note*: The OCR and document processing pipeline auto-triggers in the background as soon as case documents are uploaded, and runs automatically within the backend lifespan.

3. **Standalone Pipeline Worker (Optional)**:
   If running dedicated worker processes outside the API:
   ```sh
   .venv/bin/python -m app.pipeline
   ```

4. **Run the Test Suite & Evaluation Dataset**:
   ```sh
   PYTHONPATH=. .venv/bin/python -m unittest discover tests
   ```
