import unittest
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch

from bson import ObjectId
from fastapi.testclient import TestClient

from app import main


class FakeCaseCursor:
    def __init__(self, records: list[dict]) -> None:
        self.records = records

    def sort(self, field: str, direction: int):
        self.records.sort(key=lambda item: item[field], reverse=direction < 0)
        return self

    def __aiter__(self):
        self.index = 0
        return self

    async def __anext__(self):
        if self.index >= len(self.records):
            raise StopAsyncIteration
        record = deepcopy(self.records[self.index])
        self.index += 1
        return record


class FakeCasesCollection:
    def __init__(self) -> None:
        self.records = {}

    def find(self, _query: dict) -> FakeCaseCursor:
        return FakeCaseCursor(list(self.records.values()))

    async def find_one(self, query: dict) -> dict | None:
        record = self.records.get(query["id"])
        return deepcopy(record) if record else None

    async def insert_one(self, case: dict) -> None:
        case["_id"] = ObjectId()
        self.records[case["id"]] = deepcopy(case)

    async def update_one(self, query: dict, update: dict):
        record = self.records.get(query["id"])
        if record is None:
            return SimpleNamespace(matched_count=0)
        record.update(update.get("$set", {}))
        for field, value in update.get("$push", {}).items():
            record.setdefault(field, []).append(deepcopy(value))
        for field, criterion in update.get("$pull", {}).items():
            record[field] = [
                item for item in record.get(field, [])
                if any(item.get(key) != value for key, value in criterion.items())
            ]
        return SimpleNamespace(matched_count=1)

    async def delete_one(self, query: dict):
        record = self.records.pop(query["id"], None)
        return SimpleNamespace(deleted_count=1 if record else 0)


class FakeDocumentCollection:
    def __init__(self) -> None:
        self.records = {}

    def find(self, query: dict | None = None) -> FakeCaseCursor:
        if not query:
            return FakeCaseCursor(list(self.records.values()))
        chat_id = query.get("chat_id")
        if chat_id is not None:
            filtered = [r for r in self.records.values() if r.get("chat_id") == chat_id]
            return FakeCaseCursor(filtered)
        return FakeCaseCursor(list(self.records.values()))

    async def find_one(self, query: dict) -> dict | None:
        record = self.records.get(query["id"])
        return deepcopy(record) if record else None

    async def insert_one(self, document: dict) -> None:
        document["_id"] = ObjectId()
        self.records[document["id"]] = deepcopy(document)

    async def delete_one(self, query: dict):
        record = self.records.pop(query["id"], None)
        return SimpleNamespace(deleted_count=1 if record else 0)


class FakePostgresCases:
    def __init__(self) -> None:
        self.records = {}

    def list_cases(self):
        return [deepcopy(record) for record in self.records.values()]

    def create_case(self, case: dict) -> dict:
        saved = {**deepcopy(case), "documents": [], "findings": [], "generatedSummary": None}
        self.records[case["id"]] = saved
        return deepcopy(saved)

    def get_case(self, case_id: str) -> dict | None:
        return deepcopy(self.records.get(case_id))

    def update_case(self, case_id: str, updates: dict) -> dict | None:
        record = self.records.get(case_id)
        if record is None:
            return None
        record.update(deepcopy(updates))
        record["lastActivityAt"] = "2026-01-01T00:00:00+00:00"
        return deepcopy(record)

    def get_case_documents(self, case_id: str) -> list[dict]:
        case = self.records.get(case_id)
        return [
            {"id": item["id"], "path": item["path"]}
            for item in case["documents"]
        ] if case else []

    def delete_case(self, case_id: str) -> bool:
        return self.records.pop(case_id, None) is not None

    def add_case_document(self, document: dict) -> dict | None:
        case = self.records.get(document["caseId"])
        if case is None:
            return None
        saved = {key: value for key, value in document.items() if key != "caseId"}
        case["documents"].append(deepcopy(saved))
        return deepcopy(saved)

    def delete_case_document(self, case_id: str, document_id: str) -> dict | None:
        case = self.records.get(case_id)
        if case is None:
            return None
        for document in case["documents"]:
            if document["id"] == document_id:
                case["documents"].remove(document)
                return {"id": document_id, "path": document["path"]}
        return None

    def get_pipeline_status(self, case_id: str) -> dict | None:
        case = self.records.get(case_id)
        if case is None:
            return None
        return {
            "caseId": case_id,
            "status": "queued" if case["documents"] else "waiting_for_documents",
            "stage": "queued" if case["documents"] else None,
            "totalDocuments": len(case["documents"]),
            "processedDocuments": 0,
            "failedDocuments": 0,
            "documents": [],
            "summary": None,
            "findings": [],
            "updatedAt": None,
        }

    def retry_failed_documents(self, _case_id: str) -> dict:
        return {"documents": 0, "summary": False}

    def restart_case_pipeline(self, case_id: str) -> dict | None:
        case = self.records.get(case_id)
        if case is None:
            return None
        for document in case["documents"]:
            document["pipelineStatus"] = "queued"
            document["pipelineStage"] = "queued"
            document["pipelineError"] = None
        return {"documents": len(case["documents"]), "cancelledJobs": 1}


class FakeLLMResponse:
    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return {"choices": [{"message": {"content": "A cautious legal information response."}}]}


class FakeAsyncClient:
    request_url = None
    request_headers = None
    request_json = None

    def __init__(self, timeout: Any = None) -> None:
        self.timeout = timeout

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_: object) -> None:
        return None

    async def post(self, url: str, *, headers: dict, json: dict) -> FakeLLMResponse:
        type(self).request_url = url
        type(self).request_headers = headers
        type(self).request_json = json
        return FakeLLMResponse()

    def stream(self, method: str, url: str, *, headers: dict, json: dict):
        type(self).request_url = url
        type(self).request_headers = headers
        type(self).request_json = json

        class StreamContext:
            async def __aenter__(ctx_self):
                class StreamResp:
                    status_code = 200

                    async def aiter_lines(self):
                        yield 'data: {"choices":[{"delta":{"content":"Streamed "}}]}'
                        yield 'data: {"choices":[{"delta":{"content":"reply."}}]}'
                        yield 'data: [DONE]'

                return StreamResp()

            async def __aexit__(ctx_self, *args):
                pass

        return StreamContext()


class ChatEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(main.app)

    def test_returns_service_unavailable_when_model_is_not_configured(self) -> None:
        with patch.object(main.settings, "llm_model", None):
            response = self.client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "What should I check?"}]},
            )

        self.assertEqual(response.status_code, 503)
        self.assertIn("LLM_MODEL", response.json()["detail"])

    def test_sends_history_to_configured_provider_and_returns_reply(self) -> None:
        with (
            patch.object(main.settings, "llm_api_base_url", "https://llm.example/v1/"),
            patch.object(main.settings, "llm_api_key", None),
            patch.object(main.settings, "llm_model", "example-model"),
            patch.object(main.httpx, "AsyncClient", FakeAsyncClient),
        ):
            response = self.client.post(
                "/api/chat",
                json={
                    "messages": [
                        {"role": "user", "content": "I am reviewing a lease."},
                        {"role": "assistant", "content": "What jurisdiction applies?"},
                        {"role": "user", "content": "India."},
                    ],
                    "chatId": "general-chat-123",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["reply"], "A cautious legal information response.")
        self.assertEqual(response.json()["chatId"], "general-chat-123")
        self.assertEqual(FakeAsyncClient.request_url, "https://llm.example/v1/chat/completions")
        self.assertEqual(FakeAsyncClient.request_headers, {})
        provider_messages = FakeAsyncClient.request_json["messages"]
        self.assertEqual(provider_messages[0]["role"], "system")
        self.assertEqual(provider_messages[-1]["content"], "India.")

    def test_streaming_chat_response_yields_sse(self) -> None:
        with (
            patch.object(main.settings, "llm_api_base_url", "https://llm.example/v1/"),
            patch.object(main.settings, "llm_api_key", None),
            patch.object(main.settings, "llm_model", "example-model"),
            patch.object(main.httpx, "AsyncClient", FakeAsyncClient),
        ):
            response = self.client.post(
                "/api/chat",
                json={
                    "messages": [{"role": "user", "content": "What is the procedure?"}],
                    "chatId": "stream-chat-1",
                    "stream": True,
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/event-stream", response.headers.get("content-type", ""))
        lines = [line.strip() for line in response.text.split("\n") if line.strip()]
        self.assertTrue(any("Streamed " in line for line in lines))
        self.assertTrue(any("reply." in line for line in lines))
        self.assertIn("data: [DONE]", lines)

    def test_sends_authorization_header_when_lm_studio_auth_is_enabled(self) -> None:
        with (
            patch.object(main.settings, "llm_api_base_url", "http://localhost:1234/v1"),
            patch.object(main.settings, "llm_api_key", "local-secret"),
            patch.object(main.settings, "llm_model", "loaded-model"),
            patch.object(main.httpx, "AsyncClient", FakeAsyncClient),
        ):
            response = self.client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "Hello."}]},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            FakeAsyncClient.request_headers,
            {"Authorization": "Bearer local-secret"},
        )

    def test_case_chat_includes_parties_and_normalizes_petitioner_question(self) -> None:
        fake_case = {
            "id": "case-999",
            "title": "Rajesh Kumar vs. State",
            "parties": "Rajesh Kumar (Petitioner) vs. State (Respondent)",
            "matterType": "Writ Petition",
            "summary": "Petition challenging unlawful notice.",
        }
        with (
            patch.object(main.settings, "llm_api_base_url", "https://llm.example/v1/"),
            patch.object(main.settings, "llm_api_key", None),
            patch.object(main.settings, "llm_model", "example-model"),
            patch.object(main.postgres, "get_case", return_value=fake_case),
            patch.object(main.postgres, "get_pipeline_status", return_value={"processedDocuments": 0}),
            patch.object(main.httpx, "AsyncClient", FakeAsyncClient),
        ):
            response = self.client.post(
                "/api/chat",
                json={
                    "caseId": "case-999",
                    "messages": [
                        {"role": "user", "content": "I am looking into this matter."},
                        {"role": "assistant", "content": "I can help with Rajesh Kumar vs. State."},
                        {"role": "user", "content": "who is the petitionar"},
                    ],
                },
            )

        self.assertEqual(response.status_code, 200)
        system_content = next(
            m["content"] for m in FakeAsyncClient.request_json["messages"]
            if "Parties (Petitioner / Respondent)" in m.get("content", "")
        )
        self.assertIn("Rajesh Kumar (Petitioner)", system_content)
        self.assertIn("Rajesh Kumar vs. State", system_content)

    def test_accepts_flexible_message_and_id_formats(self) -> None:
        with (
            patch.object(main.settings, "llm_api_base_url", "https://llm.example/v1/"),
            patch.object(main.settings, "llm_api_key", None),
            patch.object(main.settings, "llm_model", "example-model"),
            patch.object(main.httpx, "AsyncClient", FakeAsyncClient),
        ):
            response = self.client.post(
                "/api/chat",
                json={
                    "conversation_id": "conv-456",
                    "message": "What are the key risks?",
                    "case_id": None,
                    "knowledge_scope": "global",
                },
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["chatId"], "conv-456")
            self.assertEqual(FakeAsyncClient.request_json["messages"][-1]["content"], "What are the key risks?")

            response2 = self.client.post(
                "/api/chat",
                json={
                    "chatId": "",
                    "messages": [{"role": "user", "content": "Tell me about jurisdiction."}],
                },
            )
            self.assertEqual(response2.status_code, 200)
            self.assertIsNone(response2.json()["chatId"])

    def test_rejects_requests_without_a_user_message(self) -> None:
        response = self.client.post(
            "/api/chat",
            json={"messages": [{"role": "assistant", "content": "Hello."}]},
        )

        self.assertEqual(response.status_code, 422)

    def test_case_chat_retrieves_and_includes_document_excerpts(self) -> None:
        async def fake_embeddings(_texts: list[str], *, query: bool = False):
            self.assertTrue(query)
            return [[0.0] * 768]

        with (
            patch.object(main.settings, "llm_api_base_url", "http://localhost:1234/v1"),
            patch.object(main.settings, "llm_api_key", None),
            patch.object(main.settings, "llm_model", "example-model"),
            patch.object(
                main.postgres,
                "get_pipeline_status",
                return_value={"processedDocuments": 1},
            ),
            patch.object(
                main.postgres,
                "search_case_chunks",
                return_value=[
                    {
                        "name": "brief.pdf",
                        "page_start": 4,
                        "page_end": 4,
                        "content": "The contract was executed on 1 January.",
                        "score": 0.91,
                    }
                ],
            ),
            patch.object(main, "create_embeddings", fake_embeddings),
            patch.object(main.httpx, "AsyncClient", FakeAsyncClient),
        ):
            response = self.client.post(
                "/api/chat",
                json={
                    "caseId": "case-1",
                    "messages": [{"role": "user", "content": "When was it signed?"}],
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["sources"][0]["name"], "brief.pdf")
        system_context = FakeAsyncClient.request_json["messages"][1]["content"]
        self.assertIn("brief.pdf, page(s) 4-4", system_context)
        self.assertIn("The contract was executed on 1 January.", system_context)

    def test_case_chat_without_processed_documents_does_not_require_embeddings(self) -> None:
        with (
            patch.object(main.settings, "llm_api_base_url", "http://localhost:1234/v1"),
            patch.object(main.settings, "llm_api_key", None),
            patch.object(main.settings, "llm_model", "example-model"),
            patch.object(
                main.postgres,
                "get_pipeline_status",
                return_value={"processedDocuments": 0},
            ),
            patch.object(main, "create_embeddings") as embeddings,
            patch.object(main.httpx, "AsyncClient", FakeAsyncClient),
        ):
            response = self.client.post(
                "/api/chat",
                json={
                    "caseId": "case-1",
                    "messages": [{"role": "user", "content": "What is in this matter?"}],
                },
            )

        self.assertEqual(response.status_code, 200)
        embeddings.assert_not_called()


class CaseEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(main.app)
        self.store = FakePostgresCases()
        self.patches = [
            patch("app.routers.cases.postgres.list_cases", self.store.list_cases),
            patch("app.routers.cases.postgres.create_case", self.store.create_case),
            patch("app.routers.cases.postgres.get_case", self.store.get_case),
            patch("app.routers.cases.postgres.update_case", self.store.update_case),
            patch("app.routers.cases.postgres.get_case_documents", self.store.get_case_documents),
            patch("app.routers.cases.postgres.delete_case", self.store.delete_case),
            patch("app.routers.cases.postgres.add_case_document", self.store.add_case_document),
            patch("app.routers.cases.postgres.delete_case_document", self.store.delete_case_document),
            patch("app.routers.cases.postgres.get_pipeline_status", self.store.get_pipeline_status),
            patch("app.routers.cases.postgres.retry_failed_documents", self.store.retry_failed_documents),
            patch("app.routers.cases.postgres.restart_case_pipeline", self.store.restart_case_pipeline),
        ]
        for patcher in self.patches:
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_case_crud_lifecycle(self) -> None:
        created = self.client.post(
            "/api/cases",
            json={
                "title": "Lease review",
                "matterType": "Contract review",
                "parties": "Tenant and landlord",
                "summary": "Review deposit and notice terms.",
                "status": "Open",
            },
        )
        self.assertEqual(created.status_code, 201)
        case_id = created.json()["id"]
        self.assertEqual(created.json()["title"], "Lease review")
        self.assertTrue(created.json()["chatId"])
        self.assertNotEqual(created.json()["chatId"], case_id)
        self.assertNotIn("_id", created.json())

        listed = self.client.get("/api/cases")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual([item["id"] for item in listed.json()], [case_id])

        fetched = self.client.get(f"/api/cases/{case_id}")
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched.json()["matterType"], "Contract review")
        self.assertEqual(fetched.json()["chatId"], created.json()["chatId"])

        updated = self.client.put(
            f"/api/cases/{case_id}",
            json={"title": "Updated lease review", "status": "In progress"},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["title"], "Updated lease review")
        self.assertEqual(updated.json()["status"], "In progress")

        deleted = self.client.delete(f"/api/cases/{case_id}")
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(self.client.get(f"/api/cases/{case_id}").status_code, 404)

    def test_update_rejects_empty_payload(self) -> None:
        response = self.client.put("/api/cases/nonexistent", json={})
        self.assertEqual(response.status_code, 422)

    def test_case_routes_wait_for_legacy_migration(self) -> None:
        with patch("app.routers.cases.postgres.case_migration_ready", False):
            response = self.client.get("/api/cases")

        self.assertEqual(response.status_code, 503)
        self.assertIn("migration", response.json()["detail"].lower())

    def test_case_document_upload_and_delete(self) -> None:
        self.store.records["file-case"] = {
            "id": "file-case",
            "documents": [],
            "lastActivityAt": "2026-01-01T00:00:00+00:00",
        }
        with (
            patch(
                "app.routers.cases.upload_file",
                return_value="http://supabase/storage/v1/object/public/case-documents/test.pdf",
            ),
            patch("app.routers.cases.delete_file") as delete_file,
        ):
            uploaded = self.client.post(
                "/api/cases/file-case/documents",
                files={"file": ("test.pdf", b"case evidence", "application/pdf")},
                data={"source": "upload"},
            )
            self.assertEqual(uploaded.status_code, 201)
            document = uploaded.json()
            self.assertEqual(document["name"], "test.pdf")
            self.assertEqual(document["size"], len(b"case evidence"))
            self.assertEqual(
                self.client.get("/api/cases/file-case").json()["documents"][0]["id"],
                document["id"],
            )

            deleted = self.client.delete(
                f"/api/cases/file-case/documents/{document['id']}",
            )

        self.assertEqual(deleted.status_code, 204)
        delete_file.assert_called_once_with(document["path"])
        self.assertEqual(self.client.get("/api/cases/file-case").json()["documents"], [])

    def test_document_upload_queues_processing_and_pipeline_status_is_available(self) -> None:
        self.store.records["pipeline-case"] = {
            "id": "pipeline-case",
            "documents": [],
            "lastActivityAt": "2026-01-01T00:00:00+00:00",
        }
        with (
            patch(
                "app.routers.cases.upload_file",
                return_value="http://supabase/storage/document.pdf",
            ),
            patch("app.routers.cases.pipeline.trigger_pipeline_processing") as trigger_mock,
        ):
            uploaded = self.client.post(
                "/api/cases/pipeline-case/documents",
                files={"file": ("document.pdf", b"case evidence", "application/pdf")},
            )
        self.assertEqual(uploaded.status_code, 201)
        self.assertEqual(uploaded.json()["pipelineStatus"], "queued")
        trigger_mock.assert_called_once()
        self.assertEqual(
            self.client.get("/api/cases/pipeline-case/pipeline").json()["status"],
            "queued",
        )

    def test_restarts_case_pipeline_and_returns_requeued_document_count(self) -> None:
        self.store.records["restart-case"] = {
            "id": "restart-case",
            "documents": [
                {"id": "document-1", "pipelineStatus": "processing"},
                {"id": "document-2", "pipelineStatus": "completed"},
            ],
            "lastActivityAt": "2026-01-01T00:00:00+00:00",
        }

        response = self.client.post("/api/cases/restart-case/pipeline/restart")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["restartedDocuments"], 2)
        self.assertEqual(response.json()["cancelledJobs"], 1)
        self.assertEqual(response.json()["status"], "queued")

    def test_restart_pipeline_returns_not_found_for_missing_case(self) -> None:
        response = self.client.post("/api/cases/missing-case/pipeline/restart")

        self.assertEqual(response.status_code, 404)


class SupabaseFileEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(main.app)
        self.chat_collection = FakeDocumentCollection()
        self.kb_collection = FakeDocumentCollection()
        self.chat_patch = patch(
            "app.routers.chat_files.get_attachments_collection",
            return_value=self.chat_collection,
        )
        self.kb_patch = patch(
            "app.routers.knowledge_base.get_documents_collection",
            return_value=self.kb_collection,
        )
        self.chat_patch.start()
        self.kb_patch.start()
        self.addCleanup(self.chat_patch.stop)
        self.addCleanup(self.kb_patch.stop)

    def test_chat_attachment_persists_and_can_be_removed(self) -> None:
        with (
            patch(
                "app.routers.chat_files.upload_file",
                return_value="http://supabase/storage/v1/object/public/case-documents/chat.txt",
            ),
            patch("app.routers.chat_files.delete_file") as delete_file,
        ):
            uploaded = self.client.post(
                "/api/chat/attachments",
                files={"file": ("chat.txt", b"chat attachment", "text/plain")},
                data={"source": "camera"},
            )
            self.assertEqual(uploaded.status_code, 201)
            self.assertEqual(self.client.get("/api/chat/attachments").json()[0]["id"], uploaded.json()["id"])

            deleted = self.client.delete(f"/api/chat/attachments/{uploaded.json()['id']}")

        self.assertEqual(deleted.status_code, 204)
        delete_file.assert_called_once_with(uploaded.json()["path"])

    def test_chat_media_and_kb_security_isolation(self) -> None:
        """
        Verifies chat-level and chat KB-level security:
        1. Media uploaded to Chat A cannot be accessed from Chat B.
        2. Deleting media from Chat A using Chat B's permission raises 403 Forbidden.
        3. Only authorized callers with the right chat_id can access or delete the media.
        """
        with (
            patch(
                "app.routers.chat_files.upload_file",
                return_value="http://supabase/storage/v1/object/public/case-documents/chat_a.png",
            ),
            patch("app.routers.chat_files.delete_file"),
            patch("app.routers.chat_files.process_chat_attachment"),
        ):
            # 1. Upload media to Chat A
            upload_a = self.client.post(
                "/api/chat/attachments",
                files={"file": ("evidence_a.png", b"evidence-a-content", "image/png")},
                data={"source": "upload", "chat_id": "chat-secure-AAA"},
            )
            self.assertEqual(upload_a.status_code, 201)
            att_a_id = upload_a.json()["id"]

            # 2. Upload media to Chat B
            upload_b = self.client.post(
                "/api/chat/attachments",
                files={"file": ("evidence_b.png", b"evidence-b-content", "image/png")},
                data={"source": "upload", "chat_id": "chat-secure-BBB"},
            )
            self.assertEqual(upload_b.status_code, 201)
            att_b_id = upload_b.json()["id"]

            # 3. Query attachments for Chat A -> must contain ONLY Chat A's media
            res_a = self.client.get("/api/chat/attachments?chat_id=chat-secure-AAA")
            self.assertEqual(res_a.status_code, 200)
            items_a = res_a.json()
            ids_a = {item["id"] for item in items_a}
            self.assertIn(att_a_id, ids_a)
            self.assertNotIn(att_b_id, ids_a)

            # 4. Query attachments for Chat B -> must contain ONLY Chat B's media
            res_b = self.client.get("/api/chat/attachments?chat_id=chat-secure-BBB")
            self.assertEqual(res_b.status_code, 200)
            items_b = res_b.json()
            ids_b = {item["id"] for item in items_b}
            self.assertIn(att_b_id, ids_b)
            self.assertNotIn(att_a_id, ids_b)

            # 5. Security permission check: Chat B attempting to delete Chat A's media
            del_unauth = self.client.delete(f"/api/chat/attachments/{att_a_id}?chat_id=chat-secure-BBB")
            self.assertEqual(del_unauth.status_code, 403)
            self.assertIn("denied", del_unauth.json()["detail"].lower())

            # 6. Authorized delete: Chat A deleting its own media succeeds
            del_auth = self.client.delete(f"/api/chat/attachments/{att_a_id}?chat_id=chat-secure-AAA")
            self.assertEqual(del_auth.status_code, 204)

            # Clean up Chat B attachment
            self.client.delete(f"/api/chat/attachments/{att_b_id}?chat_id=chat-secure-BBB")

    def test_knowledge_base_document_persists_and_can_be_removed(self) -> None:
        with (
            patch(
                "app.routers.knowledge_base.upload_file",
                return_value="http://supabase/storage/v1/object/public/case-documents/kb.txt",
            ),
            patch("app.routers.knowledge_base.delete_file") as delete_file,
        ):
            uploaded = self.client.post(
                "/api/knowledge-base/documents",
                files={"file": ("kb.txt", b"knowledge base text", "text/plain")},
                data={"folder_id": "folder-1", "folder_name": "Research"},
            )
            self.assertEqual(uploaded.status_code, 201)
            listed = self.client.get("/api/knowledge-base/documents")
            self.assertEqual(listed.json()[0]["folderName"], "Research")

            deleted = self.client.delete(
                f"/api/knowledge-base/documents/{uploaded.json()['id']}",
            )

        self.assertEqual(deleted.status_code, 204)
        delete_file.assert_called_once_with(uploaded.json()["path"])

    def test_rename_chat_conversation(self) -> None:
        with patch("app.postgres.update_conversation") as mock_update:
            mock_update.return_value = {
                "id": "chat-test-rename",
                "user_id": "default-user",
                "tenant_id": "default-tenant",
                "case_id": None,
                "title": "Renamed Chat Title",
                "knowledge_scope": "global",
                "pinned": False,
                "created_at": "2026-03-30T10:00:00Z",
                "updated_at": "2026-03-30T10:05:00Z",
            }

            # Test PATCH /api/chat/conversations/{chat_id}
            res = self.client.patch(
                "/api/chat/conversations/chat-test-rename",
                json={"title": "Renamed Chat Title"},
            )
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["title"], "Renamed Chat Title")
            self.assertEqual(res.json()["status"], "success")

            # Empty title validation
            res_bad = self.client.patch(
                "/api/chat/conversations/chat-test-rename",
                json={"title": "   "},
            )
            self.assertEqual(res_bad.status_code, 422)

    def test_chat_attachment_staged_status_and_video_handling(self) -> None:
        # 1. Attachment upload creates a staged record (does not prematurely process OCR)
        with patch("app.routers.chat_files.upload_file", return_value="http://storage/test-video.mp4"):
            res = self.client.post(
                "/api/chat/attachments",
                files={"file": ("cctv_footage.mp4", b"\x00\x00\x00\x20ftypisom", "video/mp4")},
                data={"source": "upload", "chat_id": "chat-stage-123"},
            )
            self.assertEqual(res.status_code, 201)
            data = res.json()
            self.assertEqual(data["pipeline_status"], "staged")
            self.assertEqual(data["name"], "cctv_footage.mp4")

        # 2. Pipeline extract_document handles video suffixes gracefully without unsupported file error
        from app.pipeline import extract_document
        pages = extract_document("surveillance.mp4", b"\x00\x00\x00\x20ftypisom")
        self.assertGreaterEqual(len(pages), 1)
        self.assertIn("surveillance.mp4", str(pages[0]["text"]))


if __name__ == "__main__":
    unittest.main()
