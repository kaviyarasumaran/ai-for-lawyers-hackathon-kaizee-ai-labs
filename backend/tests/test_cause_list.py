"""Unit tests for Madras High Court Cause List fetcher, OCR parser, and AI query engine."""

import tempfile
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from starlette.testclient import TestClient

from app.cause_list_db import (
    answer_cause_list_query,
    create_cause_list_pdf_from_items,
    empty_mhc_cause_list,
    extract_text_from_pdf_bytes,
    get_mhc_cause_list_url,
    normalize_date_to_ddmmyyyy,
    parse_mhc_cause_list_text,
)
from app.cause_list_pipeline import (
    compute_next_run_info,
    compute_schedule_events_info,
    purge_all_cause_lists,
)
from app.main import app


class CauseListEngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._temp_dir = tempfile.TemporaryDirectory()
        cls._temp_path = Path(cls._temp_dir.name)
        (cls._temp_path / "store").mkdir(parents=True, exist_ok=True)
        (cls._temp_path / "pdfs").mkdir(parents=True, exist_ok=True)
        cls._store_patcher = patch("app.cause_list_pipeline.STORE_DIR", cls._temp_path / "store")
        cls._pdfs_patcher = patch("app.cause_list_pipeline.PDFS_DIR", cls._temp_path / "pdfs")
        cls._hist_patcher = patch("app.cause_list_pipeline.HISTORY_FILE", cls._temp_path / "pipeline_history.json")
        cls._store_patcher.start()
        cls._pdfs_patcher.start()
        cls._hist_patcher.start()

    @classmethod
    def tearDownClass(cls):
        cls._store_patcher.stop()
        cls._pdfs_patcher.stop()
        cls._hist_patcher.stop()
        cls._temp_dir.cleanup()

    def setUp(self):
        self.client = TestClient(app)

    def test_normalize_date_formats(self):
        code1, disp1 = normalize_date_to_ddmmyyyy("27102026")
        self.assertEqual(code1, "27102026")
        self.assertEqual(disp1, "27-10-2026")

        code2, disp2 = normalize_date_to_ddmmyyyy("2026-10-27")
        self.assertEqual(code2, "27102026")
        self.assertEqual(disp2, "27-10-2026")

        code3, _ = normalize_date_to_ddmmyyyy(None)
        self.assertEqual(len(code3), 8)

    def test_mhc_cause_list_url_construction(self):
        url = get_mhc_cause_list_url("27102026")
        self.assertEqual(
            url,
            "https://mhc.tn.gov.in/judis/clists/clists-madras/causelists/pdf/cause_27102026.pdf",
        )

    def test_empty_cause_list_structure(self):
        data = empty_mhc_cause_list("27102026", "27-10-2026")
        self.assertEqual(data["date"], "27102026")
        self.assertEqual(data["courtName"], "High Court of Judicature at Madras")
        self.assertEqual(data["totalItems"], 0)
        self.assertEqual(data["items"], [])
        self.assertEqual(data["courts"], [])

    def test_create_and_extract_pdf_from_items(self):
        sample_items = [
            {
                "id": "item_1",
                "itemNumber": "1",
                "caseNumber": "W.P. No. 10293 / 2026",
                "courtNumber": "Court No. 01",
                "judge": "The Hon'ble The Chief Justice",
                "parties": "Petitioner Vs. State of Tamil Nadu",
                "counsels": "Advocate on Record",
                "category": "Motion Cases",
                "session": "Morning Session (10:30 AM)",
            }
        ]
        pdf_bytes = create_cause_list_pdf_from_items(sample_items, "27102026", "27-10-2026")
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))

        text = extract_text_from_pdf_bytes(pdf_bytes)
        self.assertIn("HIGH COURT OF JUDICATURE AT MADRAS", text)
        self.assertIn("27-10-2026", text)
        self.assertIn("W.P. No. 10293 / 2026", text)

    def test_parse_mhc_cause_list_text(self):
        sample_text = """
        IN THE HIGH COURT OF JUDICATURE AT MADRAS
        COURT NO. 01
        THE HON'BLE THE CHIEF JUSTICE
        FOR ADMISSION - AT 10.30 A.M.
        1 WP/10293/2026
        PETITIONER VS STATE OF TAMIL NADU
        M/S. A.R. SUNDARAM
        MR. P. MUTHUKUMAR GOVT PLEADER
        """
        items = parse_mhc_cause_list_text(sample_text, "27-10-2026")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["itemNumber"], "1")
        self.assertEqual(items[0]["courtNumber"], "Court No. 01")
        self.assertIn("WP/10293/2026", items[0]["caseNumber"])

    def test_ai_query_item_lookup(self):
        test_items = [
            {
                "id": "cl_1",
                "itemNumber": "1",
                "caseNumber": "W.P. No. 24891 / 2026",
                "courtNumber": "Court No. 01",
                "judge": "The Hon'ble The Chief Justice",
                "parties": "Petitioner Vs. Respondent",
                "counsels": "M/s. A.R. Sundaram, Senior Counsel",
                "category": "Motion Cases",
                "session": "Morning Session (10:30 AM)",
            }
        ]
        res = answer_cause_list_query("Which court is item number 1 listed in?", "27102026", test_items)
        self.assertIn("Court No. 01", res["answer"])
        self.assertIn("Item No. 1", res["answer"])
        self.assertIn("cl_1", res["matchingItemIds"])

    def test_ai_query_counsel_lookup(self):
        test_items = [
            {
                "id": "cl_1",
                "itemNumber": "1",
                "caseNumber": "W.P. No. 24891 / 2026",
                "courtNumber": "Court No. 01",
                "judge": "The Hon'ble The Chief Justice",
                "parties": "Petitioner Vs. Respondent",
                "counsels": "M/s. A.R. Sundaram, Senior Counsel",
                "category": "Motion Cases",
                "session": "Morning Session (10:30 AM)",
            }
        ]
        res = answer_cause_list_query("Is advocate Sundaram appearing in any matters today?", "27102026", test_items)
        self.assertIn("cl_1", res["matchingItemIds"])
        self.assertIn("W.P. No. 24891", res["answer"])

    def test_ai_query_empty_state(self):
        res = answer_cause_list_query("Show cases listed today", "27102026", [])
        self.assertIn("no listed cases", res["answer"])
        self.assertEqual(res["matchingItemIds"], [])

    def test_get_cause_list_endpoint(self):
        response = self.client.get("/api/cause-list?date=27102026")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["date"], "27102026")
        self.assertIn("items", payload)
        self.assertIn("totalItems", payload)
        self.assertIn("page", payload)
        self.assertIn("pageSize", payload)

    def test_get_cause_list_endpoint_pagination(self):
        # Test with pagination query params page and pageSize
        response = self.client.get("/api/cause-list?date=27102026&page=1&pageSize=2")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["page"], 1)
        self.assertEqual(payload["pageSize"], 2)
        self.assertIn("totalPages", payload)
        self.assertIn("totalFiltered", payload)
        self.assertIn("hasMore", payload)
        self.assertIn("hasPrev", payload)
        self.assertLessEqual(len(payload["items"]), 2)

    def test_get_cause_list_endpoint_page_alias_and_search_filter(self):
        # Test with page_size alias and search filter
        response = self.client.get("/api/cause-list?date=27102026&page=1&page_size=5&search=xyznotfoundquery999")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["page"], 1)
        self.assertEqual(payload["pageSize"], 5)
        self.assertEqual(payload["totalFiltered"], 0)
        self.assertEqual(payload["items"], [])

    def test_download_cause_list_pdf_endpoint(self):
        response = self.client.get("/api/cause-list/download?date=27102026")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_ai_query_endpoint(self):
        response = self.client.post(
            "/api/cause-list/ai-query",
            json={"query": "Show cases listed for final hearing", "date": "27102026", "items": []},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("answer", payload)

    def test_pipeline_schedule_calculation(self):
        info = compute_next_run_info(1, 0)
        self.assertIn("nextRunAt", info)
        self.assertGreater(info["secondsRemaining"], 0)
        self.assertIn("01:00 AM IST", info["scheduleRule"])

    def test_pipeline_status_endpoint(self):
        response = self.client.get("/api/cause-list/pipeline/status")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["schedulerActive"])
        self.assertIn("nextRunAt", payload)
        self.assertIn("targetSchedule", payload)

    def test_pipeline_trigger_endpoint(self):
        sample_items = [
            {
                "id": "item_1",
                "itemNumber": "1",
                "caseNumber": "W.P. No. 10293 / 2026",
                "courtNumber": "Court No. 01",
                "judge": "The Hon'ble The Chief Justice",
                "parties": "Petitioner Vs. State of Tamil Nadu",
                "counsels": "Advocate on Record",
                "category": "Motion Cases",
                "session": "Morning Session (10:30 AM)",
            }
        ]
        sample_pdf = create_cause_list_pdf_from_items(sample_items, "27102026", "27-10-2026")
        with patch("app.cause_list_pipeline.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.content = sample_pdf
            mock_client.get.return_value = mock_resp
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            response = self.client.post("/api/cause-list/pipeline/trigger", json={"date": "27102026"})
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertTrue(payload["success"])
            self.assertIn("run", payload)
            self.assertEqual(payload["run"]["status"], "SUCCESS")

    def test_pipeline_history_endpoint(self):
        response = self.client.get("/api/cause-list/pipeline/history?limit=10")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsInstance(payload, list)

    def test_compute_schedule_events_info(self):
        events = compute_schedule_events_info()
        self.assertIn("sync", events)
        self.assertIn("purge", events)
        self.assertIn("01:00 AM IST", events["sync"]["scheduleRule"])
        self.assertIn("11:55 PM IST", events["purge"]["scheduleRule"])
        self.assertGreater(events["sync"]["secondsRemaining"], 0)
        self.assertGreater(events["purge"]["secondsRemaining"], 0)

    def test_pipeline_purge_endpoint(self):
        response = self.client.post("/api/cause-list/pipeline/purge")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["run"]["status"], "PURGED")

    def test_get_cause_list_never_triggers_pipeline_or_embeddings(self):
        with (
            patch("app.routers.cause_list.execute_cause_list_pipeline", new_callable=AsyncMock) as mock_pipe,
            patch("app.court_list_assistant_pipeline.create_embeddings", new_callable=AsyncMock) as mock_embed,
        ):
            # Calling GET with an arbitrary unstored date
            response = self.client.get("/api/cause-list?date=01012099")
            self.assertEqual(response.status_code, 200)
            mock_pipe.assert_not_called()
            mock_embed.assert_not_called()

    def test_ai_query_empty_never_triggers_pipeline_or_embeddings(self):
        with (
            patch("app.routers.cause_list.execute_cause_list_pipeline", new_callable=AsyncMock) as mock_pipe,
            patch("app.court_list_assistant_pipeline.create_embeddings", new_callable=AsyncMock) as mock_embed,
        ):
            response = self.client.post(
                "/api/cause-list/ai-query",
                json={"query": "Show court 1 cases", "date": "01012099", "items": []},
            )
            self.assertEqual(response.status_code, 200)
            mock_pipe.assert_not_called()
            mock_embed.assert_not_called()

    def test_normalize_date_matches_ist_timezone(self):
        import zoneinfo
        from datetime import datetime
        ist_now = datetime.now(zoneinfo.ZoneInfo("Asia/Kolkata"))
        expected_code = ist_now.strftime("%d%m%Y")
        expected_disp = ist_now.strftime("%d-%m-%Y")
        code, disp = normalize_date_to_ddmmyyyy(None)
        self.assertEqual(code, expected_code)
        self.assertEqual(disp, expected_disp)

    def test_scheduler_auto_triggers_today_sync(self):
        import asyncio
        from datetime import datetime
        from app.cause_list_db import IST_TIMEZONE
        from app.cause_list_pipeline import run_cause_list_scheduler

        stop_event = asyncio.Event()

        async def run_test():
            fake_now = datetime(2026, 11, 4, 1, 15, tzinfo=IST_TIMEZONE)
            with (
                patch("app.cause_list_pipeline.get_cause_list_from_store", return_value=None),
                patch("app.cause_list_pipeline.execute_cause_list_pipeline", new_callable=AsyncMock) as mock_exec,
                patch("app.cause_list_pipeline.datetime") as mock_dt,
            ):
                mock_dt.now.return_value = fake_now
                mock_exec.return_value = {"success": True, "data": {"totalItems": 10}}
                task = asyncio.create_task(run_cause_list_scheduler(stop_event))
                await asyncio.sleep(0.05)
                stop_event.set()
                await task
                mock_exec.assert_called_once()
                call_args = mock_exec.call_args[1]
                self.assertEqual(call_args["trigger_type"], "SCHEDULED_0100AM")

        asyncio.run(run_test())


if __name__ == "__main__":
    unittest.main()
