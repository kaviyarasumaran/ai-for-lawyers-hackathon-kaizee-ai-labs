import unittest
from unittest.mock import patch

import psycopg
from psycopg.conninfo import conninfo_to_dict

from app import postgres
from app.config import Settings


class FakeResult:
    def __init__(self, row=None) -> None:
        self.row = row

    def fetchone(self):
        return self.row


class FakeCursor:
    def __init__(self) -> None:
        self.rows = []

    def __enter__(self):
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def executemany(self, _query: str, rows: list[tuple]) -> None:
        self.rows = list(rows)


class FakeConnection:
    def __init__(self) -> None:
        self.cursor_instance = FakeCursor()

    def __enter__(self):
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def execute(self, query: str, _params=()):
        if "SELECT status, attempts FROM case_jobs" in query:
            return FakeResult({"status": "running", "attempts": 1})
        return FakeResult()

    def cursor(self) -> FakeCursor:
        return self.cursor_instance


class PostgresConnectionTests(unittest.TestCase):
    def test_appends_configured_tenant_to_pooler_username(self) -> None:
        settings = Settings(
            _env_file=None,
            POSTGRES_DSN="postgresql://postgres:secret@db.example:5432/postgres",
            POSTGRES_TENANT_ID="dev_tenant",
        )
        with (
            patch("app.postgres.get_settings", return_value=settings),
            patch("app.postgres.psycopg.connect", return_value="connection") as connect,
        ):
            result = postgres.connect()

        self.assertEqual(result, "connection")
        dsn = connect.call_args.args[0]
        self.assertEqual(conninfo_to_dict(dsn)["user"], "postgres.dev_tenant")
        self.assertIsNone(connect.call_args.kwargs["prepare_threshold"])

    def test_does_not_append_duplicate_tenant_suffix(self) -> None:
        settings = Settings(
            _env_file=None,
            POSTGRES_DSN="postgresql://postgres.dev_tenant:secret@db.example:5432/postgres",
            POSTGRES_TENANT_ID="dev_tenant",
        )
        with (
            patch("app.postgres.get_settings", return_value=settings),
            patch("app.postgres.psycopg.connect", return_value="connection") as connect,
        ):
            postgres.connect()

        self.assertEqual(
            conninfo_to_dict(connect.call_args.args[0])["user"],
            "postgres.dev_tenant",
        )

    def test_pooler_tenant_error_has_actionable_configuration_message(self) -> None:
        settings = Settings(
            _env_file=None,
            POSTGRES_DSN="postgresql://postgres:secret@db.example:5432/postgres",
        )
        with (
            patch("app.postgres.get_settings", return_value=settings),
            patch(
                "app.postgres.psycopg.connect",
                side_effect=psycopg.OperationalError("no tenant identifier provided"),
            ),
            self.assertRaisesRegex(RuntimeError, "POSTGRES_TENANT_ID"),
        ):
            postgres.connect()

    def test_replace_document_chunks_batches_inserts_with_cursor(self) -> None:
        connection = FakeConnection()
        chunk = {
            "id": "chunk-1",
            "ordinal": 0,
            "pageStart": 1,
            "pageEnd": 1,
            "content": "A short case excerpt.",
        }
        with patch("app.postgres.connect", return_value=connection):
            saved = postgres.replace_document_chunks(
                {"id": "job-1", "case_id": "case-1", "attempts": 1},
                {"id": "document-1"},
                [{"page": 1, "text": "A short case excerpt."}],
                [chunk],
                [[0.5] * postgres.EMBEDDING_DIMENSIONS],
            )

        self.assertTrue(saved)
        self.assertEqual(len(connection.cursor_instance.rows), 1)
        self.assertEqual(connection.cursor_instance.rows[0][2], "document-1")
        self.assertEqual(
            connection.cursor_instance.rows[0][-1],
            "[" + ",".join(["0.5"] * postgres.EMBEDDING_DIMENSIONS) + "]",
        )


if __name__ == "__main__":
    unittest.main()
