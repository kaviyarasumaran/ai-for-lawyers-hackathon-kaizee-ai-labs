import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app import pipeline
from app.pipeline import _summary_payload, chunk_pages, extract_document


class DocumentPipelineTests(unittest.TestCase):
    def test_cancelled_job_does_not_advance_to_processing(self) -> None:
        job = {"id": "job-1", "attempts": 2}
        with patch("app.pipeline.postgres.set_job_stage", return_value=False) as set_stage:
            with self.assertRaises(pipeline.PipelineJobCancelled):
                pipeline._set_job_stage(job, "downloading", "document-1")

        set_stage.assert_called_once_with(
            "job-1",
            "downloading",
            "document-1",
            attempts=2,
        )

    def test_chunks_are_bounded_and_keep_page_provenance(self) -> None:
        pages = [
            {"page": 1, "text": ("First page evidence. " * 200)},
            {"page": 2, "text": ("Second page evidence. " * 200)},
        ]

        chunks = chunk_pages(pages)

        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(chunk["content"]) <= 2_800 for chunk in chunks))
        self.assertEqual(chunks[0]["pageStart"], 1)
        self.assertEqual(chunks[-1]["pageEnd"], 2)
        self.assertTrue(all(chunk["ordinal"] == index for index, chunk in enumerate(chunks)))

    def test_extracts_plain_text_as_a_single_page(self) -> None:
        pages = extract_document("brief.txt", b"Relevant facts from the case record.")

        self.assertEqual(pages, [{"page": 1, "text": "Relevant facts from the case record."}])

    def test_extracts_text_from_a_pdf_page(self) -> None:
        import pymupdf

        document = pymupdf.open()
        page = document.new_page()
        expected = "A sufficiently detailed case record paragraph for reliable PDF extraction."
        page.insert_text((72, 72), expected)
        content = document.tobytes()
        document.close()

        pages = extract_document("brief.pdf", content)

        self.assertEqual(pages[0]["page"], 1)
        self.assertIn(expected, pages[0]["text"])

    def test_case_summary_requires_a_structured_summary(self) -> None:
        summary, findings = _summary_payload(
            '{"summary":"A short draft.","findings":[{"title":"Issue","detail":"The record is unclear.","sources":["brief.pdf, p. 2"]}]}'
        )

        self.assertEqual(summary, "A short draft.")
        self.assertEqual(findings[0]["sources"], ["brief.pdf, p. 2"])
        with self.assertRaises(ValueError):
            _summary_payload('{"summary":"","findings":[]}')


class FakeProviderResponse:
    def __init__(self, payload: dict) -> None:
        self.payload = payload
        self.status_code = 200
        self.text = "{}"

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self.payload


class FakeProviderClient:
    requests = []
    response_payload = {}

    def __init__(self, timeout: float) -> None:
        self.timeout = timeout

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_: object) -> None:
        return None

    async def post(self, url: str, *, headers: dict, json: dict):
        type(self).requests.append((url, headers, json))
        return FakeProviderResponse(type(self).response_payload)


class LmStudioRequestTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        FakeProviderClient.requests = []
        FakeProviderClient.response_payload = {}
        self.client_patch = patch(
            "app.pipeline.httpx.AsyncClient",
            FakeProviderClient,
        )
        self.client_patch.start()
        self.addCleanup(self.client_patch.stop)

    async def test_embeddings_use_the_advertised_lm_studio_model_id(self) -> None:
        settings = SimpleNamespace(
            embedding_api_base_url="http://localhost:1234/v1",
            embedding_api_key=None,
            embedding_model="text-embedding-nomic-embed-text-v1.5",
            embedding_timeout_seconds=60,
        )
        FakeProviderClient.response_payload = {
            "data": [{"index": 0, "embedding": [0.25] * 768}],
        }
        with patch("app.pipeline.get_settings", return_value=settings):
            embeddings = await pipeline.create_embeddings(["a case excerpt"])

        self.assertEqual(len(embeddings[0]), 768)
        self.assertEqual(
            FakeProviderClient.requests[0][2]["model"],
            "text-embedding-nomic-embed-text-v1.5",
        )

    async def test_case_summary_uses_lm_studio_supported_json_schema_format(self) -> None:
        settings = SimpleNamespace(
            llm_api_base_url="http://localhost:1234/v1",
            llm_api_key=None,
            llm_model="google/gemma-4-e2b",
            llm_timeout_seconds=60,
        )
        FakeProviderClient.response_payload = {
            "choices": [
                {
                    "message": {
                        "content": '{"summary":"A short draft.","findings":[]}',
                    },
                },
            ],
        }
        saved = []
        with (
            patch("app.pipeline.get_settings", return_value=settings),
            patch(
                "app.pipeline.postgres.get_case_text_for_summary",
                return_value=[
                    {"name": "brief.pdf", "text": "The agreement was signed in March.", "truncated": False},
                ],
            ),
            patch(
                "app.pipeline.postgres.save_case_summary",
                side_effect=lambda *args: saved.append(args),
            ),
        ):
            await pipeline._process_summary({"id": "job-1", "case_id": "case-1"})

        payload = FakeProviderClient.requests[0][2]
        self.assertEqual(payload["response_format"]["type"], "json_schema")
        self.assertEqual(payload["response_format"]["json_schema"]["name"], "case_summary")
        self.assertEqual(saved[0][1], "A short draft.")

    async def test_auto_trigger_and_process_available_jobs(self) -> None:
        processed_jobs = []
        jobs_queue = [
            {"id": "doc-job-1", "kind": "document", "document_id": "doc-1", "case_id": "case-1"},
            {"id": "sum-job-2", "kind": "case_summary", "document_id": None, "case_id": "case-1"},
        ]

        def fake_claim(_attempts):
            return jobs_queue.pop(0) if jobs_queue else None

        async def fake_process(job):
            processed_jobs.append(job["id"])

        with (
            patch("app.pipeline.postgres.claim_next_job", side_effect=fake_claim),
            patch("app.pipeline.process_job", side_effect=fake_process),
        ):
            pipeline.notify_job_available()
            count = await pipeline.process_available_jobs()

        self.assertEqual(count, 2)
        self.assertEqual(processed_jobs, ["doc-job-1", "sum-job-2"])

    async def test_models_are_loaded_on_trigger_and_ejected_after_completion(self) -> None:
        jobs_queue = [
            {"id": "doc-job-1", "kind": "document", "document_id": "doc-1", "case_id": "case-1"},
            {"id": "sum-job-2", "kind": "case_summary", "document_id": None, "case_id": "case-1"},
        ]

        def fake_claim(_attempts):
            return jobs_queue.pop(0) if jobs_queue else None

        loaded_calls = []
        ejected_calls = []

        async def fake_load(model_name, *args, **kwargs):
            loaded_calls.append(model_name)
            return True

        async def fake_eject(model_name, *args, **kwargs):
            ejected_calls.append(model_name)
            return True

        with (
            patch("app.pipeline.postgres.claim_next_job", side_effect=fake_claim),
            patch("app.pipeline.process_job", return_value=None),
            patch("app.pipeline.load_model", side_effect=fake_load),
            patch("app.pipeline.eject_model", side_effect=fake_eject),
        ):
            await pipeline.process_available_jobs()

        # Both embedding and LLM models should be loaded during the pipeline
        self.assertIn("text-embedding-nomic-embed-text-v1.5", loaded_calls)
        self.assertIn("google/gemma-4-e2b", loaded_calls)

        # Both models MUST be ejected after pipeline completion
        self.assertIn("text-embedding-nomic-embed-text-v1.5", ejected_calls)
        self.assertIn("google/gemma-4-e2b", ejected_calls)


class ModelManagerTests(unittest.IsolatedAsyncioTestCase):
    async def test_load_and_eject_model_http_calls(self) -> None:
        from app.model_manager import eject_model, load_model

        mock_responses = []

        class MockClient:
            def __init__(self, *args, **kwargs):
                pass
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            async def post(self, url, headers=None, json=None):
                mock_responses.append((url, json))
                class Resp:
                    status_code = 200
                    text = '{"status":"ok"}'
                return Resp()

        with patch("app.model_manager.httpx.AsyncClient", MockClient):
            loaded = await load_model("google/gemma-4-e2b", "http://localhost:1234/v1")
            self.assertTrue(loaded)
            self.assertEqual(mock_responses[0][0], "http://localhost:1234/api/v1/models/load")
            self.assertEqual(mock_responses[0][1], {"model": "google/gemma-4-e2b"})

            ejected = await eject_model("google/gemma-4-e2b", "http://localhost:1234/v1")
            self.assertTrue(ejected)
            self.assertEqual(mock_responses[1][0], "http://localhost:1234/api/v1/models/unload")
            self.assertEqual(mock_responses[1][1]["instance_id"], "google/gemma-4-e2b")

    async def test_load_model_skips_when_already_loaded(self) -> None:
        from app import model_manager

        # Clear state
        model_manager._known_loaded_models.clear()
        model_manager._preloaded_models.clear()

        post_calls = []

        class MockLoadedClient:
            def __init__(self, *args, **kwargs):
                pass
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                pass
            async def get(self, url, headers=None):
                class Resp:
                    status_code = 200
                    def json(self):
                        return {"data": [{"id": "google/gemma-4-e2b", "object": "model"}]}
                return Resp()
            async def post(self, url, headers=None, json=None):
                post_calls.append((url, json))
                class Resp:
                    status_code = 200
                return Resp()

        with patch("app.model_manager.httpx.AsyncClient", MockLoadedClient):
            # Model is already in LM Studio /v1/models list
            loaded = await model_manager.load_model("google/gemma-4-e2b", "http://localhost:1234/v1")
            self.assertTrue(loaded)
            # CRITICAL: Verify NO POST to load was made because model was already loaded!
            self.assertEqual(len(post_calls), 0)

            # Subsequent load request for the already loaded model also skips reload
            loaded_again = await model_manager.load_model("google/gemma-4-e2b", "http://localhost:1234/v1")
            self.assertTrue(loaded_again)
            self.assertEqual(len(post_calls), 0)

            # Preloaded model should NOT be ejected
            ejected = await model_manager.eject_model("google/gemma-4-e2b", "http://localhost:1234/v1")
            self.assertTrue(ejected)
            self.assertEqual(len(post_calls), 0)


if __name__ == "__main__":
    unittest.main()
