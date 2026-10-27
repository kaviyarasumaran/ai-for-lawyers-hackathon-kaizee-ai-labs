import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app import main, pipeline


class KnowledgeBasePipelineAsyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_process_knowledge_base_document_extracts_and_persists(self) -> None:
        doc_id = "kb-test-123"
        filename = "statutory_circular.txt"
        content = b"Pursuant to Section 138 of the Negotiable Instruments Act, the legal notice is mandatory."

        with (
            patch("app.pipeline.load_model", new_callable=AsyncMock) as mock_load,
            patch("app.pipeline.eject_model", new_callable=AsyncMock) as mock_eject,
            patch("app.pipeline.create_embeddings", new_callable=AsyncMock) as mock_embed,
            patch("app.postgres.add_global_document") as mock_add_doc,
            patch("app.postgres.add_global_chunks") as mock_add_chunks,
            patch("app.database.get_database") as mock_get_db,
        ):
            mock_embed.return_value = [[0.1] * 768]
            mock_db = unittest.mock.MagicMock()
            mock_coll = unittest.mock.MagicMock()
            mock_coll.update_one = AsyncMock(return_value=None)
            mock_db.__getitem__.return_value = mock_coll
            mock_get_db.return_value = mock_db

            result = await pipeline.process_knowledge_base_document(
                document_id=doc_id,
                name=filename,
                content=content,
                folder_id="folder-corp",
                folder_name="Corporate Acts",
                public_url="http://supabase/kb/statutory_circular.txt",
            )

            self.assertEqual(result["status"], "completed")
            self.assertGreaterEqual(result["chunkCount"], 1)

            # Verified PostgreSQL global_legal_documents insertion
            mock_add_doc.assert_called_once()
            doc_arg = mock_add_doc.call_args[0][0]
            self.assertEqual(doc_arg["id"], doc_id)
            self.assertEqual(doc_arg["title"], filename)
            self.assertEqual(doc_arg["source"], "Corporate Acts")

            # Verified PostgreSQL global_legal_chunks insertion
            mock_add_chunks.assert_called_once()
            chunks_arg = mock_add_chunks.call_args[0][0]
            self.assertGreaterEqual(len(chunks_arg), 1)
            self.assertIn("Section 138", chunks_arg[0]["content"])

            # Verified MongoDB update with status 'ready' and formatted chunks
            self.assertGreaterEqual(mock_coll.update_one.call_count, 1)
            final_update_arg = mock_coll.update_one.call_args[0][1]["$set"]
            self.assertEqual(final_update_arg["status"], "ready")
            self.assertEqual(final_update_arg["progress"], 100)
            self.assertGreaterEqual(len(final_update_arg["chunks"]), 1)


class KnowledgeBaseEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(main.app)

    def test_upload_and_delete_knowledge_base_document(self) -> None:
        fake_storage = {}

        class FakeCollection:
            def find(self, _query):
                return self

            def sort(self, _field, _order):
                return self

            def __aiter__(self):
                self._iter = iter(fake_storage.values())
                return self

            async def __anext__(self):
                try:
                    return next(self._iter)
                except StopIteration:
                    raise StopAsyncIteration

            async def insert_one(self, doc):
                fake_storage[doc["id"]] = doc

            async def find_one(self, query):
                return fake_storage.get(query.get("id"))

            async def delete_one(self, query):
                removed = fake_storage.pop(query.get("id"), None)
                res = unittest.mock.MagicMock()
                res.deleted_count = 1 if removed else 0
                return res

        fake_coll = FakeCollection()

        with (
            patch("app.routers.knowledge_base.get_documents_collection", return_value=fake_coll),
            patch("app.routers.knowledge_base.upload_file", new_callable=AsyncMock) as mock_upload,
            patch("app.routers.knowledge_base.delete_file", new_callable=AsyncMock) as mock_delete,
            patch("app.routers.knowledge_base.process_knowledge_base_document", new_callable=AsyncMock) as mock_proc,
            patch("app.postgres.delete_global_document") as mock_pg_delete,
        ):
            mock_upload.return_value = "http://supabase/storage/v1/object/public/kb/doc.pdf"
            mock_pg_delete.return_value = True

            res = self.client.post(
                "/api/knowledge-base/documents",
                files={"file": ("doc.pdf", b"%PDF-1.4 mock pdf content", "application/pdf")},
                data={"folder_id": "fld-1", "folder_name": "Compliance"},
            )
            self.assertEqual(res.status_code, 201)
            data = res.json()
            doc_id = data["id"]
            self.assertEqual(data["status"], "queued")
            self.assertEqual(data["folderName"], "Compliance")

            # Status retrieval
            get_res = self.client.get(f"/api/knowledge-base/documents/{doc_id}")
            self.assertEqual(get_res.status_code, 200)
            self.assertEqual(get_res.json()["name"], "doc.pdf")

            # Deletion
            del_res = self.client.delete(f"/api/knowledge-base/documents/{doc_id}")
            self.assertEqual(del_res.status_code, 204)
            mock_delete.assert_called_once()
            mock_pg_delete.assert_called_once_with(doc_id)


if __name__ == "__main__":
    unittest.main()
