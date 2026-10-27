import io
import unittest
from unittest.mock import AsyncMock, patch
import zipfile
import xml.etree.ElementTree as ET

import pymupdf
from fastapi.testclient import TestClient

from app import main, pipeline, postgres


class ChatMediaPipelineTests(unittest.IsolatedAsyncioTestCase):
    def test_extract_document_from_image(self) -> None:
        # Create a simple image pixmap
        pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 100, 100), 0)
        png_bytes = pix.tobytes("png")

        pages = pipeline.extract_document("evidence_scan.png", png_bytes)
        self.assertGreaterEqual(len(pages), 1)
        self.assertEqual(pages[0]["page"], 1)
        self.assertIn("text", pages[0])

    def test_extract_document_from_docx(self) -> None:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr(
                "word/document.xml",
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                "<w:body><w:p><w:r><w:t>Confidential Settlement Agreement Terms</w:t></w:r></w:p></w:body>"
                "</w:document>",
            )
        docx_bytes = buf.getvalue()

        pages = pipeline.extract_document("settlement.docx", docx_bytes)
        self.assertEqual(len(pages), 1)
        self.assertIn("Confidential Settlement Agreement Terms", pages[0]["text"])

    def test_extract_document_from_audio(self) -> None:
        audio_bytes = b"ID3\x04\x00\x00\x00\x00\x00#TIT2\x00\x00\x00\x14\x00\x00\x03Deposition Recording"
        pages = pipeline.extract_document("client_recording.mp3", audio_bytes)
        self.assertEqual(len(pages), 1)
        self.assertIn("Audio", pages[0]["text"])

    def test_extract_document_from_audio_with_transcription(self) -> None:
        audio_bytes = b"sample_audio_bytes"
        with patch("app.pipeline.transcribe_audio_bytes", return_value="The defendant stated he was not present at the venue."):
            pages = pipeline.extract_document("witness_call.mp3", audio_bytes)
            self.assertEqual(len(pages), 1)
            self.assertIn("[Audio Transcription: witness_call.mp3]", pages[0]["text"])
            self.assertIn("The defendant stated he was not present at the venue.", pages[0]["text"])

    async def test_process_chat_attachment_runs_ocr_and_manages_model(self) -> None:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 100, 100), 0)
        png_bytes = pix.tobytes("png")

        with (
            patch("app.pipeline.load_model", new_callable=AsyncMock) as mock_load,
            patch("app.pipeline.eject_model", new_callable=AsyncMock) as mock_eject,
            patch("app.pipeline.create_embeddings", new_callable=AsyncMock) as mock_embed,
            patch("app.postgres.update_chat_attachment_status", return_value=None),
            patch("app.postgres.save_chat_chunks", return_value=None),
            patch("app.database.get_database") as mock_get_db,
        ):
            mock_db = unittest.mock.MagicMock()
            mock_coll = unittest.mock.MagicMock()
            mock_coll.update_one = AsyncMock(return_value=None)
            mock_db.__getitem__.return_value = mock_coll
            mock_get_db.return_value = mock_db
            mock_embed.return_value = [[0.1] * 768]
            result = await pipeline.process_chat_attachment(
                attachment_id="test-att-123",
                name="contract_photo.png",
                content=png_bytes,
                chat_id="chat-abc",
            )

            self.assertEqual(result["status"], "completed")
            self.assertGreaterEqual(result["pageCount"], 1)
            # Verify auto-load and auto-eject lifecycle
            mock_load.assert_awaited()
            mock_eject.assert_awaited()


class GeneralChatRetrievalTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(main.app)

    def test_general_chat_retrieves_from_chat_knowledge_base(self) -> None:
        fake_chunks = [
            {
                "name": "lease_agreement.png",
                "page_start": 1,
                "page_end": 1,
                "content": "Tenant agrees to pay monthly rent of $50,000 due on the first day of each calendar month.",
            }
        ]

        class FakeAsyncClient:
            request_json = None

            def __init__(self, *args, **kwargs) -> None:
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def post(self, _url, **kwargs):
                FakeAsyncClient.request_json = kwargs.get("json")
                return unittest.mock.MagicMock(
                    raise_for_status=lambda: None,
                    json=lambda: {
                        "choices": [
                            {
                                "message": {
                                    "content": "According to the lease agreement, monthly rent is $50,000 payable on the 1st."
                                }
                            }
                        ]
                    },
                )

        async def fake_embeddings(_texts, *, query=False):
            return [[0.0] * 768]

        with (
            patch.object(main.settings, "llm_api_base_url", "https://llm.example/v1/"),
            patch.object(main.settings, "llm_api_key", None),
            patch.object(main.settings, "llm_model", "example-model"),
            patch.object(main.settings, "embedding_api_base_url", "https://embed.example/v1/"),
            patch.object(main.settings, "embedding_model", "example-embed"),
            patch.object(main.httpx, "AsyncClient", FakeAsyncClient),
            patch("app.main.create_embeddings", side_effect=fake_embeddings),
            patch("app.postgres.search_chat_chunks", return_value=fake_chunks),
            patch("app.postgres.create_conversation", return_value={}),
            patch("app.postgres.add_message", return_value={}),
            patch.object(main.postgres, "case_migration_ready", True),
        ):
            response = self.client.post(
                "/api/chat",
                json={
                    "chatId": "chat-general-789",
                    "messages": [{"role": "user", "content": "What is the monthly rent?"}],
                },
            )

            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["chatId"], "chat-general-789")
            self.assertEqual(len(data["sources"]), 1)
            self.assertEqual(data["sources"][0]["name"], "lease_agreement.png")
            # Verify the prompt contained the retrieved chat KB excerpt
            messages_sent = FakeAsyncClient.request_json["messages"]
            system_contexts = [m["content"] for m in messages_sent if m["role"] == "system"]
            self.assertTrue(any("lease_agreement.png" in ctx for ctx in system_contexts))

    def test_should_skip_chat_query_embedding_logic(self) -> None:
        with (
            patch.object(main.settings, "llm_api_base_url", "http://localhost:1234/v1"),
            patch.object(main.settings, "llm_model", "google/gemma-4-e2b"),
            patch.object(main.settings, "embedding_api_base_url", "http://localhost:1234/v1"),
            patch.object(main.settings, "embedding_model", "text-embedding-nomic-embed-text-v1.5"),
            patch.object(main.settings, "chat_query_embeddings", False),
        ):
            # Same host + different models = skip embedding to avoid unloading LLM
            self.assertTrue(main.should_skip_chat_query_embedding())

        with (
            patch.object(main.settings, "llm_api_base_url", "http://localhost:1234/v1"),
            patch.object(main.settings, "llm_model", "google/gemma-4-e2b"),
            patch.object(main.settings, "embedding_api_base_url", "http://localhost:8001/v1"),
            patch.object(main.settings, "embedding_model", "text-embedding-nomic-embed-text-v1.5"),
            patch.object(main.settings, "chat_query_embeddings", False),
        ):
            # Different host = don't skip embedding
            self.assertFalse(main.should_skip_chat_query_embedding())

        with (
            patch.object(main.settings, "llm_api_base_url", "http://localhost:1234/v1"),
            patch.object(main.settings, "llm_model", "google/gemma-4-e2b"),
            patch.object(main.settings, "embedding_api_base_url", "http://localhost:1234/v1"),
            patch.object(main.settings, "embedding_model", "text-embedding-nomic-embed-text-v1.5"),
            patch.object(main.settings, "chat_query_embeddings", True),
        ):
            # User explicitly enabled chat_query_embeddings = don't skip
            self.assertFalse(main.should_skip_chat_query_embedding())

    def test_chat_skips_embedding_on_same_host_to_prevent_model_reloading(self) -> None:
        class FakeAsyncClient:
            request_json = None

            def __init__(self, *args, **kwargs) -> None:
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def post(self, _url, **kwargs):
                FakeAsyncClient.request_json = kwargs.get("json")
                return unittest.mock.MagicMock(
                    status_code=200,
                    raise_for_status=lambda: None,
                    json=lambda: {
                        "choices": [
                            {
                                "message": {
                                    "content": "The petitioner is ABC Corporation."
                                }
                            }
                        ]
                    },
                )

        mock_create_embeddings = AsyncMock(return_value=[[0.0] * 768])
        mock_search_chat = unittest.mock.MagicMock(return_value=[])

        with (
            patch.object(main.settings, "llm_api_base_url", "http://localhost:1234/v1"),
            patch.object(main.settings, "llm_api_key", None),
            patch.object(main.settings, "llm_model", "google/gemma-4-e2b"),
            patch.object(main.settings, "embedding_api_base_url", "http://localhost:1234/v1"),
            patch.object(main.settings, "embedding_model", "text-embedding-nomic-embed-text-v1.5"),
            patch.object(main.settings, "chat_query_embeddings", False),
            patch.object(main.httpx, "AsyncClient", FakeAsyncClient),
            patch("app.main.create_embeddings", mock_create_embeddings),
            patch("app.postgres.search_chat_chunks", mock_search_chat),
            patch("app.postgres.create_conversation", return_value={}),
            patch("app.postgres.add_message", return_value={}),
            patch.object(main.postgres, "case_migration_ready", True),
            patch("app.main.is_model_loaded", new_callable=AsyncMock, return_value=True),
            patch("app.main.load_model", new_callable=AsyncMock) as mock_load,
        ):
            response = self.client.post(
                "/api/chat",
                json={
                    "chatId": "chat-test-same-host",
                    "messages": [{"role": "user", "content": "Who is the petitioner?"}],
                },
            )

            self.assertEqual(response.status_code, 200)
            # CRITICAL: create_embeddings must NOT be called on same host
            mock_create_embeddings.assert_not_called()
            # CRITICAL: load_model must NOT be called if model is already loaded
            mock_load.assert_not_called()
            # postgres search should have been called with query_embedding=None
            mock_search_chat.assert_called_once()
            _, args, kwargs = mock_search_chat.mock_calls[0]
            # args: (effective_chat_id, search_query, query_embedding)
            self.assertIsNone(args[2])

    def test_upload_chat_attachment_caches_locally_and_serves_file(self) -> None:
        import pymupdf
        from app.routers.chat_files import ATTACHMENT_CACHE_DIR

        doc = pymupdf.open()
        p = doc.new_page()
        p.insert_text((72, 72), "Charges framed against Accused under BNS Section 103.")
        pdf_bytes = doc.tobytes()
        doc.close()

        mock_coll = unittest.mock.MagicMock()
        mock_coll.insert_one = AsyncMock(return_value=None)
        mock_coll.find_one = AsyncMock(return_value=None)

        with (
            patch("app.routers.chat_files.upload_file", new_callable=AsyncMock) as mock_upload,
            patch("app.routers.chat_files.get_attachments_collection", return_value=mock_coll),
            patch("app.postgres.save_chat_attachment", return_value=None),
        ):
            mock_upload.return_value = "https://storage.example/chat-attachments/mock.pdf"

            response = self.client.post(
                "/api/chat/attachments",
                data={"source": "upload", "chat_id": "chat-test-cache"},
                files={"file": ("Criminal Case Document - Mock Draft.pdf", pdf_bytes, "application/pdf")},
            )
            self.assertEqual(response.status_code, 201)
            data = response.json()
            att_id = data["id"]
            self.assertEqual(data["name"], "Criminal Case Document - Mock Draft.pdf")
            self.assertEqual(data["pipeline_status"], "staged")

            # Check cache file exists on disk
            cached_path = ATTACHMENT_CACHE_DIR / att_id / "Criminal Case Document - Mock Draft.pdf"
            self.assertTrue(cached_path.exists())
            self.assertEqual(cached_path.read_bytes(), pdf_bytes)

            # Test GET /api/chat/attachments/{att_id}/file
            with (
                patch("app.postgres.get_chat_attachment", return_value={
                    "id": att_id,
                    "chat_id": "chat-test-cache",
                    "name": "Criminal Case Document - Mock Draft.pdf",
                    "path": f"chat-attachments/{att_id}/Criminal Case Document - Mock Draft.pdf",
                    "type": "application/pdf",
                }),
            ):
                file_resp = self.client.get(f"/api/chat/attachments/{att_id}/file?chat_id=chat-test-cache")
                self.assertEqual(file_resp.status_code, 200)
                self.assertEqual(file_resp.content, pdf_bytes)

    def test_send_chat_triggers_ocr_and_injects_document_into_context(self) -> None:
        import pymupdf

        doc = pymupdf.open()
        p = doc.new_page()
        p.insert_text((72, 72), "STATE OF MAHARASHTRA VS. RAJESH SHARMA. The accused is charged under Section 302 IPC.")
        pdf_bytes = doc.tobytes()
        doc.close()

        # Cache file
        att_id = "test-doc-mock-draft"
        att_name = "Criminal Case Document - Mock Draft.pdf"
        from app.routers.chat_files import save_to_cache
        save_to_cache(att_id, att_name, pdf_bytes)

        staged_att = {
            "id": att_id,
            "chat_id": "chat-draft-review",
            "name": att_name,
            "path": f"chat-attachments/{att_id}/{att_name}",
            "type": "application/pdf",
            "pipeline_status": "staged",
        }

        class FakeAsyncClient:
            request_json = None

            def __init__(self, *args, **kwargs) -> None:
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def post(self, _url, **kwargs):
                FakeAsyncClient.request_json = kwargs.get("json")
                return unittest.mock.MagicMock(
                    status_code=200,
                    raise_for_status=lambda: None,
                    json=lambda: {
                        "choices": [
                            {
                                "message": {
                                    "content": "Based on the Criminal Case Document - Mock Draft, the accused Rajesh Sharma is charged under Section 302 IPC."
                                }
                            }
                        ]
                    },
                )

        with (
            patch.object(main.settings, "llm_api_base_url", "https://llm.example/v1/"),
            patch.object(main.settings, "llm_api_key", None),
            patch.object(main.settings, "llm_model", "example-model"),
            patch.object(main.settings, "embedding_api_base_url", "https://embed.example/v1/"),
            patch.object(main.settings, "embedding_model", "example-embed"),
            patch.object(main.httpx, "AsyncClient", FakeAsyncClient),
            patch("app.main.create_embeddings", AsyncMock(return_value=[[0.0] * 768])),
            patch("app.postgres.get_staged_chat_attachments", return_value=[staged_att]),
            patch("app.postgres.search_chat_chunks", return_value=[]),
            patch("app.postgres.create_conversation", return_value={}),
            patch("app.postgres.add_message", return_value={}),
            patch("app.postgres.update_chat_attachment_status", return_value=None),
            patch("app.postgres.save_chat_chunks", return_value=None),
            patch.object(main.postgres, "case_migration_ready", True),
        ):
            response = self.client.post(
                "/api/chat",
                json={
                    "chatId": "chat-draft-review",
                    "attachment_ids": [att_id],
                    "messages": [
                        {
                            "role": "user",
                            "content": "Please review the attached Criminal Case Document - Mock Draft.pdf.",
                            "attachments": [staged_att],
                        }
                    ],
                },
            )

            self.assertEqual(response.status_code, 200)
            data = response.json()
            # Assert sources includes the attached document
            self.assertTrue(len(data["sources"]) >= 1)
            self.assertEqual(data["sources"][0]["name"], att_name)
            self.assertIn("Rajesh Sharma", data["reply"])

            # Verify the prompt sent to the LLM contained the extracted document text
            sent_messages = FakeAsyncClient.request_json["messages"]
            system_contexts = [m["content"] for m in sent_messages if m["role"] == "system"]
            combined_system = "\n".join(system_contexts)
            self.assertIn("Criminal Case Document - Mock Draft.pdf", combined_system)
            self.assertIn("STATE OF MAHARASHTRA VS. RAJESH SHARMA", combined_system)
            self.assertIn("Under NO circumstances should you ask the user to upload or attach the document", combined_system)


if __name__ == "__main__":
    unittest.main()
