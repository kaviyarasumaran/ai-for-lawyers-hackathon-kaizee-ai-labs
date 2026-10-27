import unittest
from unittest.mock import patch
from types import SimpleNamespace

from app import storage
from app.config import Settings


class FakeStorageResponse:
    def __init__(self, status_code: int, payload: dict | None = None) -> None:
        self.status_code = status_code
        self.payload = payload or {}

    def json(self) -> dict:
        return self.payload


class FakeStorageClient:
    requests = []
    response_status = 200
    response_payload = {}

    def __init__(self, timeout: float) -> None:
        self.timeout = timeout

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_: object) -> None:
        return None

    async def post(self, url: str, **kwargs):
        type(self).requests.append(("POST", url, kwargs))
        return FakeStorageResponse(type(self).response_status, type(self).response_payload)

    async def request(self, method: str, url: str, **kwargs):
        type(self).requests.append((method, url, kwargs))
        return FakeStorageResponse(type(self).response_status, type(self).response_payload)


class SupabaseStorageTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        FakeStorageClient.requests = []
        FakeStorageClient.response_status = 200
        FakeStorageClient.response_payload = {}
        self.settings = SimpleNamespace(
            supabase_url="http://supabase.local:8000/",
            supabase_secret_key="test-secret",
            supabase_bucket="case documents",
            supabase_timeout_seconds=30,
        )
        self.settings_patch = patch("app.storage.get_settings", return_value=self.settings)
        self.settings_patch.start()
        self.client_patch = patch("app.storage.httpx.AsyncClient", FakeStorageClient)
        self.client_patch.start()
        self.addCleanup(self.settings_patch.stop)
        self.addCleanup(self.client_patch.stop)

    async def test_uploads_file_with_backend_credentials_and_returns_public_url(self) -> None:
        url = await storage.upload_file("cases/case-1/brief one.pdf", b"contents", "application/pdf")

        self.assertEqual(
            url,
            "http://supabase.local:8000/storage/v1/object/public/case%20documents/cases/case-1/brief%20one.pdf",
        )
        method, request_url, request = FakeStorageClient.requests[0]
        self.assertEqual(method, "POST")
        self.assertTrue(request_url.endswith("/storage/v1/object/case%20documents/cases/case-1/brief%20one.pdf"))
        self.assertEqual(request["headers"]["apikey"], "test-secret")
        self.assertEqual(request["headers"]["Authorization"], "Bearer test-secret")
        self.assertEqual(request["content"], b"contents")

    async def test_delete_uses_supabase_storage_remove_endpoint(self) -> None:
        await storage.delete_file("cases/case-1/brief.pdf")

        method, request_url, request = FakeStorageClient.requests[0]
        self.assertEqual(method, "DELETE")
        self.assertTrue(request_url.endswith("/storage/v1/object/case%20documents"))
        self.assertEqual(request["json"], {"prefixes": ["cases/case-1/brief.pdf"]})

    async def test_missing_bucket_error_is_actionable(self) -> None:
        FakeStorageClient.response_status = 400
        FakeStorageClient.response_payload = {
            "error": "Bucket not found",
            "code": "NoSuchBucket",
        }

        with self.assertRaises(storage.StorageError) as error:
            await storage.upload_file("cases/case-1/file", b"contents", "text/plain")

        self.assertIn("case documents", str(error.exception))
        self.assertIn("Create it in the Supabase Storage dashboard", str(error.exception))

    async def test_storage_operations_fail_explicitly_when_unconfigured(self) -> None:
        self.settings.supabase_secret_key = None
        with self.assertRaises(storage.StorageError) as error:
            await storage.upload_file("cases/case-1/file", b"contents", "text/plain")

        self.assertEqual(error.exception.status_code, 503)
        self.assertIn("SUPABASE_SERVICE_ROLE_KEY", str(error.exception))

    def test_settings_accept_conventional_service_role_environment_name(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "SUPABASE_URL": "http://supabase.local:8000",
                "SUPABASE_SERVICE_ROLE_KEY": "rotated-test-key",
            },
            clear=True,
        ):
            settings = Settings(_env_file=None)

        self.assertEqual(settings.supabase_url, "http://supabase.local:8000")
        self.assertEqual(settings.supabase_secret_key, "rotated-test-key")

    def test_settings_accept_self_hosted_service_role_environment_name(self) -> None:
        with patch.dict(
            "os.environ",
            {
                "SUPABASE_URL": "http://supabase.local:8000",
                "SERVICE_ROLE_KEY": "rotated-test-key",
            },
            clear=True,
        ):
            settings = Settings(_env_file=None)

        self.assertEqual(settings.supabase_secret_key, "rotated-test-key")
