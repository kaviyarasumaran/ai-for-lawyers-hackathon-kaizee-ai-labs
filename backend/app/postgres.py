from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

import psycopg
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.config import get_settings

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"
SCHEMA_PATH = MIGRATIONS_DIR / "001_case_pipeline.sql"
EMBEDDING_DIMENSIONS = 768
JOB_LEASE_SECONDS = 900
case_migration_ready = True


def connect() -> psycopg.Connection:
    settings = get_settings()
    dsn = settings.postgres_dsn
    if not dsn:
        raise RuntimeError("Set POSTGRES_DSN in backend/.env to enable case storage.")
    if settings.postgres_tenant_id:
        username = conninfo_to_dict(dsn).get("user", "")
        tenant_suffix = f".{settings.postgres_tenant_id}"
        if not username.endswith(tenant_suffix):
            dsn = make_conninfo(dsn, user=f"{username}{tenant_suffix}")
    try:
        return psycopg.connect(
            dsn,
            row_factory=dict_row,
            prepare_threshold=None,
            connect_timeout=3,
        )
    except psycopg.OperationalError as exc:
        if "no tenant identifier provided" in str(exc).lower():
            raise RuntimeError(
                "Supavisor requires a tenant identifier. Set POSTGRES_TENANT_ID "
                "to the pooler's configured tenant ID, or use the direct PostgreSQL endpoint."
            ) from exc
        raise


def initialize_schema() -> None:
    with connect() as connection:
        for sql_file in sorted(MIGRATIONS_DIR.glob("*.sql")):
            connection.execute(sql_file.read_text(encoding="utf-8"))


def ping() -> None:
    with connect() as connection:
        connection.execute("SELECT 1")


def migrate_legacy_cases(records: list[dict[str, Any]]) -> int:
    migrated = 0
    with connect() as connection:
        for record in records:
            case_id = str(record.get("id") or "")
            if not case_id:
                continue
            connection.execute(
                """
                INSERT INTO cases (
                    id, chat_id, title, matter_type, parties, summary, status,
                    created_at, last_activity_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    case_id,
                    str(record.get("chatId") or case_id),
                    record.get("title") or "Untitled case",
                    record.get("matterType") or "General",
                    record.get("parties") or "",
                    record.get("summary") or "",
                    record.get("status") or "Open",
                    record.get("createdAt") or datetime.now(timezone.utc),
                    record.get("lastActivityAt") or record.get("createdAt") or datetime.now(timezone.utc),
                ),
            )
            for document in record.get("documents", []):
                if not document.get("id") or not document.get("path"):
                    continue
                connection.execute(
                    """
                    INSERT INTO case_documents (
                        id, case_id, name, size, content_type, source, path, url, added_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (
                        str(document["id"]),
                        case_id,
                        document.get("name") or "upload",
                        int(document.get("size") or 0),
                        document.get("type") or "application/octet-stream",
                        document.get("source") or "upload",
                        document["path"],
                        document.get("url") or "",
                        document.get("addedAt") or datetime.now(timezone.utc),
                    ),
                )
                connection.execute(
                    """
                    INSERT INTO case_jobs (id, case_id, document_id, kind, status, stage)
                    VALUES (%s, %s, %s, 'document', 'queued', 'queued')
                    ON CONFLICT (document_id) DO NOTHING
                    """,
                    (str(uuid4()), case_id, str(document["id"])),
                )
            migrated += 1
    return migrated


def _case_payload(connection: psycopg.Connection, case_row: dict[str, Any]) -> dict[str, Any]:
    documents = connection.execute(
        """
        SELECT id, name, size, content_type AS type, source, path, url, added_at,
               pipeline_status AS "pipelineStatus", pipeline_stage AS "pipelineStage",
               pipeline_error AS "pipelineError", page_count AS "pageCount",
               chunk_count AS "chunkCount"
        FROM case_documents
        WHERE case_id = %s
        ORDER BY added_at DESC
        """,
        (case_row["id"],),
    ).fetchall()
    row = dict(case_row)
    generated_summary = row.pop("generated_summary", None)
    row["manualSummary"] = row["summary"]
    row["summary"] = generated_summary or row["manualSummary"]
    row["generatedSummary"] = generated_summary
    row["findings"] = row.pop("findings", [])
    row["chatId"] = row.pop("chat_id")
    row["matterType"] = row.pop("matter_type")
    row["createdAt"] = row.pop("created_at").isoformat()
    row["lastActivityAt"] = row.pop("last_activity_at").isoformat()
    row["documents"] = [
        {
            **document,
            "addedAt": document["added_at"].isoformat(),
        }
        for document in documents
    ]
    return row


def list_cases() -> list[dict[str, Any]]:
    with connect() as connection:
        cases = connection.execute(
            "SELECT * FROM cases ORDER BY last_activity_at DESC"
        ).fetchall()
        return [_case_payload(connection, case) for case in cases]


def get_case(case_id: str) -> dict[str, Any] | None:
    with connect() as connection:
        case = connection.execute("SELECT * FROM cases WHERE id = %s", (case_id,)).fetchone()
        return _case_payload(connection, case) if case else None


def create_case(case: dict[str, Any]) -> dict[str, Any]:
    with connect() as connection:
        row = connection.execute(
            """
            INSERT INTO cases (
                id, chat_id, title, matter_type, parties, summary, status,
                created_at, last_activity_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (
                case["id"], case["chatId"], case["title"], case["matterType"],
                case["parties"], case["summary"], case["status"],
                case["createdAt"], case["lastActivityAt"],
            ),
        ).fetchone()
        return _case_payload(connection, row)


def update_case(case_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    fields = {
        "title": "title",
        "matterType": "matter_type",
        "parties": "parties",
        "summary": "summary",
        "status": "status",
    }
    assignments = [f"{fields[field]} = %s" for field in updates]
    values = list(updates.values())
    if "summary" in updates:
        assignments.append("generated_summary = NULL")
    assignments.append("last_activity_at = %s")
    values.extend([datetime.now(timezone.utc), case_id])
    with connect() as connection:
        row = connection.execute(
            f"UPDATE cases SET {', '.join(assignments)} WHERE id = %s RETURNING *",
            values,
        ).fetchone()
        return _case_payload(connection, row) if row else None


def get_case_documents(case_id: str) -> list[dict[str, Any]]:
    with connect() as connection:
        return connection.execute(
            "SELECT id, path FROM case_documents WHERE case_id = %s ORDER BY added_at",
            (case_id,),
        ).fetchall()


def delete_case(case_id: str) -> bool:
    with connect() as connection:
        return connection.execute(
            "DELETE FROM cases WHERE id = %s RETURNING id",
            (case_id,),
        ).fetchone() is not None


def _supersede_active_summary_jobs(
    connection: psycopg.Connection,
    case_id: str,
) -> None:
    connection.execute(
        """
        UPDATE case_jobs
        SET status = 'succeeded', stage = 'superseded',
            lease_expires_at = NULL, updated_at = now()
        WHERE case_id = %s AND kind = 'case_summary'
          AND status IN ('queued', 'running')
        """,
        (case_id,),
    )


def add_case_document(document: dict[str, Any]) -> dict[str, Any] | None:
    with connect() as connection:
        if not connection.execute(
            "SELECT 1 FROM cases WHERE id = %s FOR UPDATE",
            (document["caseId"],),
        ).fetchone():
            return None
        _supersede_active_summary_jobs(connection, document["caseId"])
        connection.execute(
            """
            INSERT INTO case_documents (
                id, case_id, name, size, content_type, source, path, url, added_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                document["id"], document["caseId"], document["name"], document["size"],
                document["type"], document["source"], document["path"], document["url"],
                document["addedAt"],
            ),
        )
        connection.execute(
            """
            INSERT INTO case_jobs (id, case_id, document_id, kind, status, stage)
            VALUES (%s, %s, %s, 'document', 'queued', 'queued')
            ON CONFLICT (document_id) DO UPDATE SET
                status = 'queued', stage = 'queued', attempts = 0,
                available_at = now(), lease_expires_at = NULL, error = NULL,
                updated_at = now()
            """,
            (str(uuid4()), document["caseId"], document["id"]),
        )
        connection.execute(
            """
            UPDATE cases
            SET generated_summary = NULL, findings = '[]'::jsonb,
                last_activity_at = %s
            WHERE id = %s
            """,
            (document["addedAt"], document["caseId"]),
        )
    return {key: value for key, value in document.items() if key != "caseId"}


def delete_case_document(case_id: str, document_id: str) -> dict[str, Any] | None:
    with connect() as connection:
        document = connection.execute(
            """
            DELETE FROM case_documents
            WHERE case_id = %s AND id = %s
            RETURNING id, path
            """,
            (case_id, document_id),
        ).fetchone()
        if document:
            connection.execute("SELECT id FROM cases WHERE id = %s FOR UPDATE", (case_id,))
            _supersede_active_summary_jobs(connection, case_id)
            connection.execute(
                """
                UPDATE cases SET generated_summary = NULL, findings = '[]'::jsonb,
                    last_activity_at = %s
                WHERE id = %s
                """,
                (datetime.now(timezone.utc), case_id),
            )
            _enqueue_case_summary_if_ready(connection, case_id)
        return document


def get_pipeline_status(case_id: str) -> dict[str, Any] | None:
    with connect() as connection:
        case = connection.execute(
            "SELECT id, generated_summary, findings FROM cases WHERE id = %s",
            (case_id,),
        ).fetchone()
        if not case:
            return None
        documents = connection.execute(
            """
            SELECT id, name, pipeline_status AS status, pipeline_stage AS stage,
                   pipeline_error AS error, page_count AS "pageCount",
                   chunk_count AS "chunkCount", updated_at AS "updatedAt"
            FROM case_documents WHERE case_id = %s ORDER BY added_at
            """,
            (case_id,),
        ).fetchall()
        summary_job = connection.execute(
            """
            SELECT status, stage, error, updated_at
            FROM case_jobs WHERE case_id = %s AND kind = 'case_summary'
            ORDER BY updated_at DESC LIMIT 1
            """,
            (case_id,),
        ).fetchone()
    total = len(documents)
    completed = sum(document["status"] == "completed" for document in documents)
    failed = sum(document["status"] == "failed" for document in documents)
    active = next(
        (document for document in documents if document["status"] in {"queued", "processing"}),
        None,
    )
    if active:
        overall = "processing" if active["status"] == "processing" else "queued"
        stage = active["stage"] or active["status"]
    elif total == 0:
        overall, stage = "waiting_for_documents", None
    elif summary_job and summary_job["status"] in {"queued", "running"}:
        overall = "processing" if summary_job["status"] == "running" else "queued"
        stage = summary_job["stage"]
    elif failed and completed:
        overall = "partial"
        stage = "summary_failed" if summary_job and summary_job["status"] == "failed" else "completed"
    elif failed:
        overall, stage = "failed", "failed"
    elif summary_job and summary_job["status"] == "failed":
        overall, stage = "failed", "summary_failed"
    else:
        overall, stage = "completed", "completed"
    return {
        "caseId": case_id,
        "status": overall,
        "stage": stage,
        "totalDocuments": total,
        "processedDocuments": completed,
        "failedDocuments": failed,
        "documents": [
            {
                **document,
                "updatedAt": document["updatedAt"].isoformat(),
            }
            for document in documents
        ],
        "summary": case["generated_summary"],
        "findings": case["findings"],
        "updatedAt": (
            summary_job["updated_at"].isoformat()
            if summary_job
            else None
        ),
    }


def retry_failed_documents(case_id: str) -> dict[str, int | bool]:
    with connect() as connection:
        failed = connection.execute(
            "SELECT id FROM case_documents WHERE case_id = %s AND pipeline_status = 'failed'",
            (case_id,),
        ).fetchall()
        for document in failed:
            connection.execute(
                """
                UPDATE case_documents SET pipeline_status = 'queued',
                    pipeline_stage = 'queued', pipeline_error = NULL, updated_at = now()
                WHERE id = %s
                """,
                (document["id"],),
            )
            connection.execute(
                """
                INSERT INTO case_jobs (id, case_id, document_id, kind, status, stage)
                VALUES (%s, %s, %s, 'document', 'queued', 'queued')
                ON CONFLICT (document_id) DO UPDATE SET
                    status = 'queued', stage = 'queued', attempts = 0,
                    available_at = now(), lease_expires_at = NULL, error = NULL,
                    updated_at = now()
                """,
                (str(uuid4()), case_id, document["id"]),
            )
        if failed:
            connection.execute(
                "UPDATE cases SET generated_summary = NULL, findings = '[]'::jsonb WHERE id = %s",
                (case_id,),
            )
        failed_summary = connection.execute(
            """
            SELECT 1 FROM case_jobs
            WHERE case_id = %s AND kind = 'case_summary' AND status = 'failed'
            LIMIT 1
            """,
            (case_id,),
        ).fetchone()
        if failed_summary and not failed:
            connection.execute(
                """
                INSERT INTO case_jobs (id, case_id, kind, status, stage)
                VALUES (%s, %s, 'case_summary', 'queued', 'queued')
                ON CONFLICT DO NOTHING
                """,
                (str(uuid4()), case_id),
            )
    return {"documents": len(failed), "summary": bool(failed_summary and not failed)}


def restart_case_pipeline(case_id: str) -> dict[str, int] | None:
    with connect() as connection:
        if not connection.execute(
            "SELECT id FROM cases WHERE id = %s",
            (case_id,),
        ).fetchone():
            return None

        cancelled_jobs = connection.execute(
            """
            UPDATE case_jobs
            SET status = 'failed', stage = 'cancelled',
                error = 'Stopped and restarted by user',
                lease_expires_at = NULL, updated_at = now()
            WHERE case_id = %s AND status IN ('queued', 'running')
            RETURNING id
            """,
            (case_id,),
        ).fetchall()
        documents = connection.execute(
            """
            UPDATE case_documents
            SET pipeline_status = 'queued', pipeline_stage = 'queued',
                pipeline_error = NULL, updated_at = now()
            WHERE case_id = %s
            RETURNING id
            """,
            (case_id,),
        ).fetchall()

        for document in documents:
            connection.execute(
                """
                INSERT INTO case_jobs (id, case_id, document_id, kind, status, stage)
                VALUES (%s, %s, %s, 'document', 'queued', 'queued')
                ON CONFLICT (document_id) DO UPDATE SET
                    id = EXCLUDED.id, status = 'queued', stage = 'queued',
                    attempts = 0, available_at = now(), lease_expires_at = NULL,
                    error = NULL, updated_at = now()
                """,
                (str(uuid4()), case_id, document["id"]),
            )

    return {
        "documents": len(documents),
        "cancelledJobs": len(cancelled_jobs),
    }


def claim_next_job(max_attempts: int) -> dict[str, Any] | None:
    with connect() as connection:
        exhausted_jobs = connection.execute(
            """
            UPDATE case_jobs
            SET status = 'failed', stage = 'failed',
                error = 'Worker lease expired after the final attempt',
                lease_expires_at = NULL, updated_at = now()
            WHERE status = 'running'
              AND lease_expires_at < now()
              AND attempts >= %s
            RETURNING case_id, document_id
            """,
            (max_attempts,),
        ).fetchall()
        for expired_job in exhausted_jobs:
            if expired_job["document_id"]:
                connection.execute(
                    """
                    UPDATE case_documents
                    SET pipeline_status = 'failed', pipeline_stage = 'failed',
                        pipeline_error = 'Worker lease expired after the final attempt',
                        updated_at = now()
                    WHERE id = %s
                    """,
                    (expired_job["document_id"],),
                )
                connection.execute(
                    "SELECT id FROM cases WHERE id = %s FOR UPDATE",
                    (expired_job["case_id"],),
                )
                _enqueue_case_summary_if_ready(connection, expired_job["case_id"])
        return connection.execute(
            """
            WITH candidate AS (
                SELECT id
                FROM case_jobs job
                WHERE job.attempts < %s
                  AND (
                    (job.status = 'queued' AND job.available_at <= now())
                    OR (job.status = 'running' AND job.lease_expires_at < now())
                  )
                  AND (
                    job.kind = 'document'
                    OR NOT EXISTS (
                        SELECT 1 FROM case_jobs pending
                        WHERE pending.case_id = job.case_id
                          AND pending.kind = 'document'
                          AND pending.status IN ('queued', 'running')
                    )
                  )
                ORDER BY job.available_at, job.created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE case_jobs job
            SET status = 'running', stage = 'starting', attempts = attempts + 1,
                lease_expires_at = now() + (%s * interval '1 second'),
                updated_at = now(), error = NULL
            FROM candidate
            WHERE job.id = candidate.id
            RETURNING job.*
            """,
            (max_attempts, JOB_LEASE_SECONDS),
        ).fetchone()


def set_job_stage(
    job_id: str,
    stage: str,
    document_id: str | None = None,
    *,
    attempts: int,
) -> bool:
    with connect() as connection:
        job = connection.execute(
            """
            UPDATE case_jobs
            SET stage = %s, lease_expires_at = now() + (%s * interval '1 second'),
                updated_at = now()
            WHERE id = %s AND status = 'running' AND attempts = %s
            RETURNING id
            """,
            (stage, JOB_LEASE_SECONDS, job_id, attempts),
        ).fetchone()
        if not job:
            return False
        if document_id:
            connection.execute(
                """
                UPDATE case_documents
                SET pipeline_status = 'processing', pipeline_stage = %s, updated_at = now()
                WHERE id = %s
                """,
                (stage, document_id),
            )
    return True


def get_document_for_job(document_id: str) -> dict[str, Any] | None:
    with connect() as connection:
        return connection.execute(
            "SELECT * FROM case_documents WHERE id = %s",
            (document_id,),
        ).fetchone()


def _enqueue_case_summary_if_ready(
    connection: psycopg.Connection,
    case_id: str,
) -> None:
    pending = connection.execute(
        """
        SELECT 1 FROM case_documents
        WHERE case_id = %s AND pipeline_status IN ('queued', 'processing')
        LIMIT 1
        """,
        (case_id,),
    ).fetchone()
    completed = connection.execute(
        """
        SELECT 1 FROM case_documents
        WHERE case_id = %s AND pipeline_status = 'completed'
        LIMIT 1
        """,
        (case_id,),
    ).fetchone()
    if not pending and completed:
        connection.execute(
            """
            INSERT INTO case_jobs (id, case_id, kind, status, stage)
            VALUES (%s, %s, 'case_summary', 'queued', 'queued')
            ON CONFLICT DO NOTHING
            """,
            (str(uuid4()), case_id),
        )


def replace_document_chunks(
    job: dict[str, Any],
    document: dict[str, Any],
    pages: list[dict[str, Any]],
    chunks: list[dict[str, Any]],
    embeddings: list[list[float]],
) -> bool:
    if len(chunks) != len(embeddings):
        raise ValueError("Chunk and embedding counts do not match.")
    with connect() as connection:
        job_row = connection.execute(
            "SELECT status, attempts FROM case_jobs WHERE id = %s FOR UPDATE",
            (job["id"],),
        ).fetchone()
        if (
            not job_row
            or job_row["status"] != "running"
            or job_row["attempts"] != job["attempts"]
        ):
            return False
        connection.execute("DELETE FROM case_chunks WHERE document_id = %s", (document["id"],))
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO case_chunks (
                    id, case_id, document_id, ordinal, page_start, page_end, content, embedding
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::vector)
                """,
                [
                    (
                        chunk["id"], job["case_id"], document["id"], chunk["ordinal"],
                        chunk["pageStart"], chunk["pageEnd"], chunk["content"],
                        "[" + ",".join(str(value) for value in embedding) + "]",
                    )
                    for chunk, embedding in zip(chunks, embeddings, strict=True)
                ],
            )
        extracted_text = "\n\n".join(
            f"[Page {page['page']}]\n{page['text']}" for page in pages
        )
        connection.execute(
            """
            UPDATE case_documents
            SET pipeline_status = 'completed', pipeline_stage = 'completed',
                pipeline_error = NULL, extracted_text = %s, page_count = %s,
                chunk_count = %s, updated_at = now()
            WHERE id = %s
            """,
            (extracted_text, len(pages), len(chunks), document["id"]),
        )
        connection.execute(
            """
            UPDATE case_jobs
            SET status = 'succeeded', stage = 'completed', lease_expires_at = NULL,
                error = NULL, updated_at = now()
            WHERE id = %s
            """,
            (job["id"],),
        )
        connection.execute(
            "SELECT id FROM cases WHERE id = %s FOR UPDATE",
            (job["case_id"],),
        )
        _enqueue_case_summary_if_ready(connection, job["case_id"])
    return True


def get_case_text_for_summary(case_id: str, max_characters: int = 36_000) -> list[dict[str, Any]]:
    with connect() as connection:
        rows = connection.execute(
            """
            SELECT name, extracted_text
            FROM case_documents
            WHERE case_id = %s AND pipeline_status = 'completed'
            ORDER BY added_at
            """,
            (case_id,),
        ).fetchall()
    output = []
    remaining = max_characters
    for index, row in enumerate(rows):
        share = max(1, remaining // (len(rows) - index))
        source_text = row["extracted_text"]
        content = source_text[:share]
        if content:
            output.append(
                {
                    "name": row["name"],
                    "text": content,
                    "truncated": len(content) < len(source_text),
                }
            )
            remaining -= len(content)
        if remaining <= 0:
            break
    return output


def save_case_summary(
    job: dict[str, Any],
    summary: str,
    findings: list[dict[str, Any]],
) -> bool:
    with connect() as connection:
        connection.execute(
            "SELECT id FROM cases WHERE id = %s FOR UPDATE",
            (job["case_id"],),
        )
        summary_job = connection.execute(
            "SELECT status, attempts FROM case_jobs WHERE id = %s FOR UPDATE",
            (job["id"],),
        ).fetchone()
        if (
            not summary_job
            or summary_job["status"] != "running"
            or summary_job["attempts"] != job["attempts"]
        ):
            return False
        pending = connection.execute(
            """
            SELECT 1 FROM case_documents
            WHERE case_id = %s AND pipeline_status IN ('queued', 'processing')
            LIMIT 1
            """,
            (job["case_id"],),
        ).fetchone()
        if pending:
            connection.execute(
                """
                UPDATE case_jobs SET status = 'succeeded', stage = 'superseded',
                    lease_expires_at = NULL, updated_at = now()
                WHERE id = %s
                """,
                (job["id"],),
            )
            return False
        connection.execute(
            """
            UPDATE cases SET generated_summary = %s, findings = %s,
                last_activity_at = now()
            WHERE id = %s
            """,
            (summary, Jsonb(findings), job["case_id"]),
        )
        connection.execute(
            """
            UPDATE case_jobs SET status = 'succeeded', stage = 'completed',
                lease_expires_at = NULL, error = NULL, updated_at = now()
            WHERE id = %s
            """,
            (job["id"],),
        )
    return True


def fail_job(job: dict[str, Any], error: str, max_attempts: int) -> None:
    terminal = job["attempts"] >= max_attempts
    retry_delay = min(2 ** job["attempts"], 300)
    with connect() as connection:
        updated_job = connection.execute(
            """
            UPDATE case_jobs
            SET status = %s, stage = %s, available_at = now() + (%s * interval '1 second'),
                lease_expires_at = NULL, error = %s, updated_at = now()
            WHERE id = %s AND status = 'running' AND attempts = %s
            RETURNING id
            """,
            (
                "failed" if terminal else "queued",
                "failed" if terminal else "retrying",
                retry_delay,
                error[:1000],
                job["id"],
                job["attempts"],
            ),
        ).fetchone()
        if updated_job and job.get("document_id"):
            connection.execute(
                """
                UPDATE case_documents
                SET pipeline_status = %s, pipeline_stage = %s,
                    pipeline_error = %s, updated_at = now()
                WHERE id = %s
                """,
                (
                    "failed" if terminal else "queued",
                    "failed" if terminal else "retrying",
                    error[:1000],
                    job["document_id"],
                ),
            )
            if terminal:
                connection.execute(
                    "SELECT id FROM cases WHERE id = %s FOR UPDATE",
                    (job["case_id"],),
                )
                _enqueue_case_summary_if_ready(connection, job["case_id"])


def search_case_chunks(
    case_id: str,
    query: str,
    embedding: list[float] | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    if not embedding:
        with connect() as connection:
            return connection.execute(
                """
                SELECT chunk.id AS chunk_id, chunk.document_id, chunk.case_id,
                       chunk.content, chunk.page_start, chunk.page_end, document.name,
                       ts_rank_cd(chunk.search_vector, plainto_tsquery('english', %s)) AS score
                FROM case_chunks chunk
                JOIN case_documents document ON document.id = chunk.document_id
                WHERE chunk.case_id = %s
                  AND document.pipeline_status = 'completed'
                  AND chunk.search_vector @@ plainto_tsquery('english', %s)
                ORDER BY score DESC
                LIMIT %s
                """,
                (query, case_id, query, limit),
            ).fetchall()

    vector = "[" + ",".join(str(value) for value in embedding) + "]"
    with connect() as connection:
        return connection.execute(
            """
            WITH vector_matches AS (
                SELECT chunk.id,
                       row_number() OVER (ORDER BY chunk.embedding <=> %s::vector) AS rank
                FROM case_chunks chunk
                JOIN case_documents document ON document.id = chunk.document_id
                WHERE chunk.case_id = %s AND document.pipeline_status = 'completed'
                ORDER BY chunk.embedding <=> %s::vector
                LIMIT 20
            ),
            keyword_matches AS (
                SELECT chunk.id,
                       row_number() OVER (
                           ORDER BY ts_rank_cd(
                               chunk.search_vector,
                               plainto_tsquery('english', %s)
                           ) DESC
                       ) AS rank
                FROM case_chunks chunk
                JOIN case_documents document ON document.id = chunk.document_id
                WHERE chunk.case_id = %s
                  AND document.pipeline_status = 'completed'
                  AND chunk.search_vector @@ plainto_tsquery('english', %s)
                ORDER BY ts_rank_cd(
                    chunk.search_vector,
                    plainto_tsquery('english', %s)
                ) DESC
                LIMIT 20
            ),
            reciprocal_ranks AS (
                SELECT id, sum(1.0 / (60 + rank)) AS score
                FROM (
                    SELECT id, rank FROM vector_matches
                    UNION ALL
                    SELECT id, rank FROM keyword_matches
                ) matches
                GROUP BY id
            )
            SELECT chunk.id AS chunk_id, chunk.document_id, chunk.case_id,
                   chunk.content, chunk.page_start, chunk.page_end, document.name,
                   reciprocal_ranks.score
            FROM reciprocal_ranks
            JOIN case_chunks chunk ON chunk.id = reciprocal_ranks.id
            JOIN case_documents document ON document.id = chunk.document_id
            ORDER BY reciprocal_ranks.score DESC
            LIMIT %s
            """,
            (vector, case_id, vector, query, case_id, query, query, limit),
        ).fetchall()


def get_case_header_chunks(case_id: str, limit: int = 2) -> list[dict[str, Any]]:
    with connect() as connection:
        return connection.execute(
            """
            SELECT chunk.id AS chunk_id, chunk.document_id, chunk.case_id,
                   chunk.content, chunk.page_start, chunk.page_end, document.name,
                   1.0 AS score
            FROM case_chunks chunk
            JOIN case_documents document ON document.id = chunk.document_id
            WHERE chunk.case_id = %s
              AND document.pipeline_status = 'completed'
              AND chunk.page_start <= 2
            ORDER BY document.added_at ASC, chunk.ordinal ASC
            LIMIT %s
            """,
            (case_id, limit),
        ).fetchall()


def search_global_chunks(
    query: str,
    embedding: list[float],
    tenant_id: str | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    vector = "[" + ",".join(str(value) for value in embedding) + "]"
    with connect() as connection:
        return connection.execute(
            """
            WITH vector_matches AS (
                SELECT chunk.id,
                       row_number() OVER (ORDER BY chunk.embedding <=> %s::vector) AS rank
                FROM global_legal_chunks chunk
                JOIN global_legal_documents document ON document.id = chunk.document_id
                WHERE (document.tenant_id IS NULL OR document.tenant_id = %s)
                ORDER BY chunk.embedding <=> %s::vector
                LIMIT 20
            ),
            keyword_matches AS (
                SELECT chunk.id,
                       row_number() OVER (
                           ORDER BY ts_rank_cd(
                               chunk.search_vector,
                               plainto_tsquery('english', %s)
                           ) DESC
                       ) AS rank
                FROM global_legal_chunks chunk
                JOIN global_legal_documents document ON document.id = chunk.document_id
                WHERE (document.tenant_id IS NULL OR document.tenant_id = %s)
                  AND chunk.search_vector @@ plainto_tsquery('english', %s)
                ORDER BY ts_rank_cd(
                    chunk.search_vector,
                    plainto_tsquery('english', %s)
                ) DESC
                LIMIT 20
            ),
            reciprocal_ranks AS (
                SELECT id, sum(1.0 / (60 + rank)) AS score
                FROM (
                    SELECT id, rank FROM vector_matches
                    UNION ALL
                    SELECT id, rank FROM keyword_matches
                ) matches
                GROUP BY id
            )
            SELECT chunk.id AS chunk_id, chunk.document_id, chunk.section,
                   chunk.content, chunk.page_start, chunk.page_end,
                   document.title AS name, document.document_type,
                   document.jurisdiction, document.source, document.url,
                   document.publication_date, document.effective_date,
                   reciprocal_ranks.score
            FROM reciprocal_ranks
            JOIN global_legal_chunks chunk ON chunk.id = reciprocal_ranks.id
            JOIN global_legal_documents document ON document.id = chunk.document_id
            ORDER BY reciprocal_ranks.score DESC
            LIMIT %s
            """,
            (vector, tenant_id, vector, query, tenant_id, query, query, limit),
        ).fetchall()


def create_conversation(conversation: dict[str, Any]) -> dict[str, Any]:
    with connect() as connection:
        connection.execute(
            """
            INSERT INTO conversations (
                id, user_id, tenant_id, case_id, title, knowledge_scope, pinned, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                knowledge_scope = EXCLUDED.knowledge_scope,
                updated_at = EXCLUDED.updated_at
            """,
            (
                conversation["id"],
                conversation.get("user_id", "default-user"),
                conversation.get("tenant_id", "default-tenant"),
                conversation.get("case_id"),
                conversation.get("title", "New chat"),
                conversation.get("knowledge_scope", "combined"),
                conversation.get("pinned", False),
                conversation.get("created_at") or datetime.now(timezone.utc),
                conversation.get("updated_at") or datetime.now(timezone.utc),
            ),
        )
    return conversation


def get_conversation(conversation_id: str, tenant_id: str | None = None) -> dict[str, Any] | None:
    query = "SELECT id, user_id, tenant_id, case_id, title, knowledge_scope, pinned, created_at, updated_at FROM conversations WHERE id = %s"
    params: list[Any] = [conversation_id]
    if tenant_id:
        query += " AND tenant_id = %s"
        params.append(tenant_id)
    with connect() as connection:
        row = connection.execute(query, params).fetchone()
        if not row:
            # Check if this conversation_id is actually a case's chat_id
            case = connection.execute(
                "SELECT id, chat_id, title FROM cases WHERE chat_id = %s OR id = %s",
                (conversation_id, conversation_id),
            ).fetchone()
            if case:
                return {
                    "id": conversation_id,
                    "user_id": "default-user",
                    "tenant_id": tenant_id or "default-tenant",
                    "case_id": case["id"],
                    "title": case["title"],
                    "knowledge_scope": "case",
                    "pinned": False,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            return None
        return {
            "id": row["id"],
            "user_id": row["user_id"],
            "tenant_id": row["tenant_id"],
            "case_id": row["case_id"],
            "title": row["title"],
            "knowledge_scope": row["knowledge_scope"],
            "pinned": row["pinned"],
            "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
            "updated_at": row["updated_at"].isoformat() if hasattr(row["updated_at"], "isoformat") else str(row["updated_at"]),
        }


def list_conversations(user_id: str, tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
    with connect() as connection:
        rows = connection.execute(
            """
            SELECT id, user_id, tenant_id, case_id, title, knowledge_scope, pinned, created_at, updated_at
            FROM conversations
            WHERE user_id = %s AND tenant_id = %s
            ORDER BY updated_at DESC
            LIMIT %s
            """,
            (user_id, tenant_id, limit),
        ).fetchall()
        return [
            {
                "id": row["id"],
                "user_id": row["user_id"],
                "tenant_id": row["tenant_id"],
                "case_id": row["case_id"],
                "title": row["title"],
                "knowledge_scope": row["knowledge_scope"],
                "pinned": row["pinned"],
                "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
                "updated_at": row["updated_at"].isoformat() if hasattr(row["updated_at"], "isoformat") else str(row["updated_at"]),
            }
            for row in rows
        ]


def update_conversation(conversation_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    set_clauses = []
    values = []
    allowed = {"title", "knowledge_scope", "pinned"}
    for key, value in updates.items():
        if key in allowed:
            set_clauses.append(f"{key} = %s")
            values.append(value)
    if not set_clauses:
        return get_conversation(conversation_id)
    set_clauses.append("updated_at = now()")
    values.append(conversation_id)
    with connect() as connection:
        connection.execute(
            f"UPDATE conversations SET {', '.join(set_clauses)} WHERE id = %s",
            values,
        )
    return get_conversation(conversation_id)


def delete_conversation(conversation_id: str, user_id: str | None = None, tenant_id: str | None = None) -> bool:
    query = "DELETE FROM conversations WHERE id = %s"
    params: list[Any] = [conversation_id]
    if user_id and tenant_id:
        query += " AND user_id = %s AND tenant_id = %s"
        params.extend([user_id, tenant_id])
    with connect() as connection:
        result = connection.execute(query, params)
        return (result.rowcount or 0) > 0


def add_message(message: dict[str, Any]) -> dict[str, Any]:
    with connect() as connection:
        connection.execute(
            """
            INSERT INTO messages (id, conversation_id, role, content, citations, metadata, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                message["id"],
                message["conversation_id"],
                message["role"],
                message["content"],
                Jsonb(message.get("citations", [])),
                Jsonb(message.get("metadata", {})),
                message.get("created_at") or datetime.now(timezone.utc),
            ),
        )
        connection.execute(
            "UPDATE conversations SET updated_at = now() WHERE id = %s",
            (message["conversation_id"],),
        )
    return message


def get_conversation_messages(conversation_id: str, limit: int = 50) -> list[dict[str, Any]]:
    with connect() as connection:
        rows = connection.execute(
            """
            SELECT id, conversation_id, role, content, citations, metadata, created_at
            FROM messages
            WHERE conversation_id = %s
            ORDER BY created_at ASC
            LIMIT %s
            """,
            (conversation_id, limit),
        ).fetchall()
        return [
            {
                "id": row["id"],
                "conversation_id": row["conversation_id"],
                "role": row["role"],
                "content": row["content"],
                "citations": row["citations"] if isinstance(row["citations"], list) else [],
                "metadata": row["metadata"] if isinstance(row["metadata"], dict) else {},
                "attachments": (row["metadata"] or {}).get("attachments", []) if isinstance(row["metadata"], dict) else [],
                "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
            }
            for row in rows
        ]


def check_case_access(case_id: str, user_id: str, tenant_id: str) -> bool:
    with connect() as connection:
        # First verify case exists
        case = connection.execute("SELECT id FROM cases WHERE id = %s", (case_id,)).fetchone()
        if not case:
            return False
        # Check explicit case access restrictions
        access_count = connection.execute(
            "SELECT count(*) AS total FROM case_access WHERE case_id = %s",
            (case_id,),
        ).fetchone()
        if access_count and access_count["total"] > 0:
            user_access = connection.execute(
                "SELECT id FROM case_access WHERE case_id = %s AND user_id = %s",
                (case_id, user_id),
            ).fetchone()
            return user_access is not None
        # If no explicit restriction on this case, accessible to authorized tenant users
        return True


def grant_case_access(case_id: str, user_id: str, role: str = "viewer") -> None:
    with connect() as connection:
        connection.execute(
            """
            INSERT INTO case_access (id, case_id, user_id, role)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (case_id, user_id) DO UPDATE SET role = EXCLUDED.role
            """,
            (str(uuid4()), case_id, user_id, role),
        )


def add_global_document(document: dict[str, Any]) -> dict[str, Any]:
    with connect() as connection:
        connection.execute(
            """
            INSERT INTO global_legal_documents (
                id, tenant_id, title, document_type, jurisdiction, source, url,
                publication_date, effective_date, content_summary, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                document_type = EXCLUDED.document_type,
                jurisdiction = EXCLUDED.jurisdiction,
                url = EXCLUDED.url
            """,
            (
                document["id"],
                document.get("tenant_id"),
                document["title"],
                document.get("document_type", "statute"),
                document.get("jurisdiction", "Federal"),
                document.get("source", "official"),
                document.get("url"),
                document.get("publication_date"),
                document.get("effective_date"),
                document.get("content_summary"),
                document.get("created_at") or datetime.now(timezone.utc),
            ),
        )
    return document


def add_global_chunks(chunks: list[dict[str, Any]]) -> None:
    with connect() as connection:
        for chunk in chunks:
            vector = "[" + ",".join(str(value) for value in chunk["embedding"]) + "]"
            connection.execute(
                """
                INSERT INTO global_legal_chunks (
                    id, document_id, ordinal, page_start, page_end, section, content, embedding
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::vector)
                ON CONFLICT (document_id, ordinal) DO UPDATE SET
                    content = EXCLUDED.content,
                    embedding = EXCLUDED.embedding
                """,
                (
                    chunk["id"],
                    chunk["document_id"],
                    chunk["ordinal"],
                    chunk.get("page_start", 1),
                    chunk.get("page_end", 1),
                    chunk.get("section"),
                    chunk["content"],
                    vector,
                ),
            )


def delete_global_document(document_id: str) -> bool:
    with connect() as connection:
        connection.execute(
            "DELETE FROM global_legal_chunks WHERE document_id = %s",
            (document_id,),
        )
        result = connection.execute(
            "DELETE FROM global_legal_documents WHERE id = %s",
            (document_id,),
        )
        return (result.rowcount or 0) > 0


def log_audit_event(
    user_id: str,
    tenant_id: str,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> str:
    event_id = str(uuid4())
    try:
        with connect() as connection:
            connection.execute(
                """
                INSERT INTO audit_logs (id, user_id, tenant_id, action, resource_type, resource_id, details, ip_address, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    event_id,
                    user_id,
                    tenant_id,
                    action,
                    resource_type,
                    resource_id,
                    Jsonb(details or {}),
                    ip_address,
                    datetime.now(timezone.utc),
                ),
            )
    except Exception:
        # Audit logging should never crash the main request path if database is degraded
        logger.exception("Could not record audit log event %s", action)
    return event_id


def save_chat_attachment(attachment: dict[str, Any]) -> dict[str, Any]:
    with connect() as connection:
        try:
            connection.execute(
                """
                INSERT INTO chat_attachments (
                    id, chat_id, name, size, content_type, source, path, url, added_at,
                    pipeline_status, pipeline_stage, pipeline_error, extracted_text,
                    page_count, chunk_count, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    pipeline_status = EXCLUDED.pipeline_status,
                    pipeline_stage = EXCLUDED.pipeline_stage,
                    pipeline_error = EXCLUDED.pipeline_error,
                    extracted_text = EXCLUDED.extracted_text,
                    page_count = EXCLUDED.page_count,
                    chunk_count = EXCLUDED.chunk_count,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    attachment["id"],
                    attachment.get("chat_id") or "default-chat",
                    attachment["name"],
                    attachment["size"],
                    attachment.get("type") or attachment.get("content_type", "application/octet-stream"),
                    attachment.get("source", "upload"),
                    attachment["path"],
                    attachment["url"],
                    attachment.get("addedAt") or attachment.get("added_at") or datetime.now(timezone.utc),
                    attachment.get("pipeline_status", "staged"),
                    attachment.get("pipeline_stage", "staged"),
                    attachment.get("pipeline_error"),
                    attachment.get("extracted_text"),
                    attachment.get("page_count"),
                    attachment.get("chunk_count"),
                    datetime.now(timezone.utc),
                ),
            )
        except Exception as exc:
            if "pipeline_status_check" in str(exc).lower() or "check constraint" in str(exc).lower():
                try:
                    connection.execute("ALTER TABLE chat_attachments DROP CONSTRAINT IF EXISTS chat_attachments_pipeline_status_check;")
                    connection.execute("ALTER TABLE chat_attachments ADD CONSTRAINT chat_attachments_pipeline_status_check CHECK (pipeline_status IN ('staged', 'queued', 'processing', 'completed', 'failed'));")
                    connection.execute(
                        """
                        INSERT INTO chat_attachments (
                            id, chat_id, name, size, content_type, source, path, url, added_at,
                            pipeline_status, pipeline_stage, pipeline_error, extracted_text,
                            page_count, chunk_count, updated_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            pipeline_status = EXCLUDED.pipeline_status,
                            updated_at = EXCLUDED.updated_at
                        """,
                        (
                            attachment["id"],
                            attachment.get("chat_id") or "default-chat",
                            attachment["name"],
                            attachment["size"],
                            attachment.get("type") or attachment.get("content_type", "application/octet-stream"),
                            attachment.get("source", "upload"),
                            attachment["path"],
                            attachment["url"],
                            attachment.get("addedAt") or attachment.get("added_at") or datetime.now(timezone.utc),
                            attachment.get("pipeline_status", "staged"),
                            attachment.get("pipeline_stage", "staged"),
                            attachment.get("pipeline_error"),
                            attachment.get("extracted_text"),
                            attachment.get("page_count"),
                            attachment.get("chunk_count"),
                            datetime.now(timezone.utc),
                        ),
                    )
                except Exception:
                    raise exc
            else:
                raise
    return attachment


def update_chat_attachment_status(
    attachment_id: str,
    status: str,
    error: str | None = None,
    extracted_text: str | None = None,
    page_count: int | None = None,
    chunk_count: int | None = None,
) -> None:
    with connect() as connection:
        connection.execute(
            """
            UPDATE chat_attachments
            SET pipeline_status = %s,
                pipeline_stage = %s,
                pipeline_error = %s,
                extracted_text = COALESCE(%s, extracted_text),
                page_count = COALESCE(%s, page_count),
                chunk_count = COALESCE(%s, chunk_count),
                updated_at = now()
            WHERE id = %s
            """,
            (status, status, error, extracted_text, page_count, chunk_count, attachment_id),
        )


def save_chat_chunks(
    attachment_id: str,
    chat_id: str,
    chunks: list[dict[str, Any]],
    embeddings: list[list[float]],
) -> None:
    with connect() as connection:
        connection.execute("DELETE FROM chat_chunks WHERE attachment_id = %s", (attachment_id,))
        for chunk, embedding in zip(chunks, embeddings, strict=True):
            vector = "[" + ",".join(str(value) for value in embedding) + "]"
            connection.execute(
                """
                INSERT INTO chat_chunks (
                    id, chat_id, attachment_id, ordinal, page_start, page_end,
                    content, embedding
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::vector)
                """,
                (
                    chunk["id"],
                    chat_id,
                    attachment_id,
                    chunk["ordinal"],
                    chunk["pageStart"],
                    chunk["pageEnd"],
                    chunk["content"],
                    vector,
                ),
            )


def delete_chat_attachment_record(attachment_id: str) -> None:
    with connect() as connection:
        connection.execute("DELETE FROM chat_chunks WHERE attachment_id = %s", (attachment_id,))
        connection.execute("DELETE FROM chat_attachments WHERE id = %s", (attachment_id,))


def get_chat_attachments(chat_id: str) -> list[dict[str, Any]]:
    with connect() as connection:
        rows = connection.execute(
            """
            SELECT id, chat_id, name, size, content_type AS type, source, path, url,
                   added_at, pipeline_status, pipeline_stage, pipeline_error,
                   page_count, chunk_count
            FROM chat_attachments
            WHERE chat_id = %s
            ORDER BY added_at DESC
            """,
            (chat_id,),
        ).fetchall()
        return [
            {
                **row,
                "addedAt": row["added_at"].isoformat() if hasattr(row.get("added_at"), "isoformat") else str(row.get("added_at")),
            }
            for row in rows
        ]


def get_chat_attachment(attachment_id: str) -> dict[str, Any] | None:
    with connect() as connection:
        row = connection.execute(
            """
            SELECT id, chat_id, name, size, content_type AS type, source, path, url,
                   added_at, pipeline_status, pipeline_stage, pipeline_error,
                   page_count, chunk_count
            FROM chat_attachments
            WHERE id = %s
            """,
            (attachment_id,),
        ).fetchone()
        if not row:
            return None
        return {
            **row,
            "addedAt": row["added_at"].isoformat() if hasattr(row.get("added_at"), "isoformat") else str(row.get("added_at")),
        }


def get_staged_chat_attachments(chat_id: str, attachment_ids: list[str] | None = None) -> list[dict[str, Any]]:
    with connect() as connection:
        if attachment_ids:
            rows = connection.execute(
                """
                SELECT id, chat_id, name, size, content_type AS type, source, path, url,
                       added_at, pipeline_status, pipeline_stage, pipeline_error,
                       page_count, chunk_count, extracted_text
                FROM chat_attachments
                WHERE id = ANY(%s) OR (chat_id = %s AND pipeline_status = 'staged')
                ORDER BY added_at ASC
                """,
                (attachment_ids, chat_id),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT id, chat_id, name, size, content_type AS type, source, path, url,
                       added_at, pipeline_status, pipeline_stage, pipeline_error,
                       page_count, chunk_count, extracted_text
                FROM chat_attachments
                WHERE chat_id = %s AND pipeline_status = 'staged'
                ORDER BY added_at ASC
                """,
                (chat_id,),
            ).fetchall()
        return [
            {
                **row,
                "addedAt": row["added_at"].isoformat() if hasattr(row.get("added_at"), "isoformat") else str(row.get("added_at")),
            }
            for row in rows
        ]


def get_attachment_chunks(attachment_id: str) -> list[dict[str, Any]]:
    with connect() as connection:
        rows = connection.execute(
            """
            SELECT chunk.id AS chunk_id, chunk.attachment_id, chunk.chat_id,
                   chunk.content, chunk.page_start, chunk.page_end, attachment.name,
                   chunk.ordinal
            FROM chat_chunks chunk
            JOIN chat_attachments attachment ON attachment.id = chunk.attachment_id
            WHERE chunk.attachment_id = %s
            ORDER BY chunk.ordinal ASC
            """,
            (attachment_id,),
        ).fetchall()
        return [
            {
                "chunk_id": row["chunk_id"],
                "attachment_id": row["attachment_id"],
                "chat_id": row["chat_id"],
                "content": row["content"],
                "page_start": row["page_start"],
                "page_end": row["page_end"],
                "name": row["name"],
                "ordinal": row["ordinal"],
            }
            for row in rows
        ]


def search_chat_chunks(
    chat_id: str,
    query: str,
    embedding: list[float] | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    if not embedding:
        with connect() as connection:
            return connection.execute(
                """
                SELECT chunk.id AS chunk_id, chunk.attachment_id, chunk.chat_id,
                       chunk.content, chunk.page_start, chunk.page_end, attachment.name,
                       ts_rank_cd(chunk.search_vector, plainto_tsquery('english', %s)) AS score
                FROM chat_chunks chunk
                JOIN chat_attachments attachment ON attachment.id = chunk.attachment_id
                WHERE chunk.chat_id = %s
                  AND attachment.pipeline_status = 'completed'
                  AND chunk.search_vector @@ plainto_tsquery('english', %s)
                ORDER BY score DESC
                LIMIT %s
                """,
                (query, chat_id, query, limit),
            ).fetchall()

    vector = "[" + ",".join(str(value) for value in embedding) + "]"
    with connect() as connection:
        return connection.execute(
            """
            WITH vector_matches AS (
                SELECT chunk.id,
                       row_number() OVER (ORDER BY chunk.embedding <=> %s::vector) AS rank
                FROM chat_chunks chunk
                JOIN chat_attachments attachment ON attachment.id = chunk.attachment_id
                WHERE chunk.chat_id = %s AND attachment.pipeline_status = 'completed'
                ORDER BY chunk.embedding <=> %s::vector
                LIMIT 20
            ),
            keyword_matches AS (
                SELECT chunk.id,
                       row_number() OVER (
                           ORDER BY ts_rank_cd(
                               chunk.search_vector,
                               plainto_tsquery('english', %s)
                           ) DESC
                       ) AS rank
                FROM chat_chunks chunk
                JOIN chat_attachments attachment ON attachment.id = chunk.attachment_id
                WHERE chunk.chat_id = %s
                  AND attachment.pipeline_status = 'completed'
                  AND chunk.search_vector @@ plainto_tsquery('english', %s)
                ORDER BY ts_rank_cd(
                    chunk.search_vector,
                    plainto_tsquery('english', %s)
                ) DESC
                LIMIT 20
            ),
            reciprocal_ranks AS (
                SELECT id, sum(1.0 / (60 + rank)) AS score
                FROM (
                    SELECT id, rank FROM vector_matches
                    UNION ALL
                    SELECT id, rank FROM keyword_matches
                ) matches
                GROUP BY id
            )
            SELECT chunk.id AS chunk_id, chunk.attachment_id, chunk.chat_id,
                   chunk.content, chunk.page_start, chunk.page_end, attachment.name,
                   reciprocal_ranks.score
            FROM reciprocal_ranks
            JOIN chat_chunks chunk ON chunk.id = reciprocal_ranks.id
            JOIN chat_attachments attachment ON attachment.id = chunk.attachment_id
            ORDER BY reciprocal_ranks.score DESC
            LIMIT %s
            """,
            (vector, chat_id, vector, query, chat_id, query, query, limit),
        ).fetchall()


def get_chat_header_chunks(chat_id: str, limit: int = 2) -> list[dict[str, Any]]:
    with connect() as connection:
        return connection.execute(
            """
            SELECT chunk.id AS chunk_id, chunk.attachment_id, chunk.chat_id,
                   chunk.content, chunk.page_start, chunk.page_end, attachment.name,
                   1.0 AS score
            FROM chat_chunks chunk
            JOIN chat_attachments attachment ON attachment.id = chunk.attachment_id
            WHERE chunk.chat_id = %s
              AND attachment.pipeline_status = 'completed'
              AND chunk.page_start <= 2
            ORDER BY attachment.added_at ASC, chunk.ordinal ASC
            LIMIT %s
            """,
            (chat_id, limit),
        ).fetchall()


