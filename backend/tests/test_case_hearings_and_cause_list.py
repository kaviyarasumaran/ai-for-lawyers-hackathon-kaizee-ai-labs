"""Tests for case cause list matching and hearing records with Case KB vector ingestion."""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.routers.cases import CaseMatchRequest, HearingRecordCreate, match_case_cause_list, record_case_hearing


class CaseHearingsAndCauseListTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.sample_case = {
            "id": "case_test_123",
            "title": "A.JOHN BOSCO Matter",
            "matterType": "Writ Petition",
            "parties": "A.JOHN BOSCO Vs. THE DISTRICT COLLECTOR AND 5 OTHERS.",
            "causeList": {
                "caseNumber": "WP/43363/2026",
                "hearings": [],
            },
        }
        self.sample_cause_items = [
            {
                "id": "mhc_item_1",
                "itemNumber": "1",
                "caseNumber": "WP/43363/2026",
                "courtNumber": "Court No. 01",
                "judge": "THE HON'BLE MR.JUSTICE G.ARUL MURUGAN",
                "parties": "A.JOHN BOSCO Vs. THE DISTRICT COLLECTOR AND 5 OTHERS.",
                "counsels": "Advocate on Record",
                "category": "For Admission",
                "session": "Afternoon Session (02:15 PM)",
                "date": "03-11-2026",
            }
        ]

    @patch("app.routers.cases.postgres.get_case")
    @patch("app.routers.cases.postgres.update_case_cause_list")
    @patch("app.routers.cases.get_cause_list_from_store")
    async def test_match_case_cause_list_success(self, mock_store, mock_update, mock_get):
        mock_get.return_value = self.sample_case
        mock_store.return_value = {"items": self.sample_cause_items}
        mock_update.side_effect = lambda cid, cdata: {"id": cid, "causeList": cdata}

        req = CaseMatchRequest(caseNumber="WP/43363/2026")
        res = await match_case_cause_list("case_test_123", req)

        self.assertTrue(res["isListed"])
        self.assertIsNotNone(res["item"])
        self.assertEqual(res["item"]["courtNumber"], "Court No. 01")
        self.assertEqual(res["item"]["itemNumber"], "1")
        self.assertEqual(res["causeList"]["status"], "Listed")
        self.assertIn("Court No. 01", res["causeList"]["alert"])

    @patch("app.routers.cases.postgres.get_case")
    @patch("app.routers.cases.postgres.update_case_cause_list")
    @patch("app.routers.cases.get_cause_list_from_store")
    async def test_match_case_cause_list_unlisted(self, mock_store, mock_update, mock_get):
        mock_get.return_value = self.sample_case
        mock_store.return_value = {"items": self.sample_cause_items}
        mock_update.side_effect = lambda cid, cdata: {"id": cid, "causeList": cdata}

        req = CaseMatchRequest(caseNumber="WP/99999/2026", parties="Unrelated Vs. Entity")
        res = await match_case_cause_list("case_test_123", req)

        self.assertFalse(res["isListed"])
        self.assertIsNone(res["item"])
        self.assertEqual(res["causeList"]["status"], "Unlisted")

    @patch("app.routers.cases.postgres.get_case")
    @patch("app.routers.cases.postgres.update_case_cause_list")
    @patch("app.routers.cases.postgres.ingest_hearing_record_to_kb")
    @patch("app.routers.cases.pipeline.create_embeddings", new_callable=AsyncMock)
    async def test_record_case_hearing_ingests_to_kb(self, mock_embed, mock_ingest, mock_update, mock_get):
        mock_get.return_value = self.sample_case
        mock_update.side_effect = lambda cid, cdata: {"id": cid, "causeList": cdata}
        mock_embed.return_value = [[0.1] * 768]
        mock_ingest.return_value = "doc_hearing_abc123"

        req = HearingRecordCreate(
            date="03-11-2026",
            courtNumber="Court No. 01",
            judge="THE HON'BLE MR.JUSTICE G.ARUL MURUGAN",
            stage="For Admission",
            arguments="Submitted that petitioner has clear title and possession. Interim stay requested.",
            observations="Court directed private notice to respondents.",
            outcome="Notice ordered returnable in 2 weeks. Interim status quo granted.",
            nextDate="17-11-2026",
            audioTranscribed=True,
        )

        res = await record_case_hearing("case_test_123", req)

        self.assertTrue(res["success"])
        self.assertEqual(res["hearing"]["date"], "03-11-2026")
        self.assertEqual(res["documentId"], "doc_hearing_abc123")
        self.assertEqual(res["causeList"]["nextHearingDate"], "17-11-2026")
        self.assertEqual(len(res["causeList"]["hearings"]), 1)
        mock_ingest.assert_called_once()

    @patch("app.routers.cases.postgres.get_case")
    @patch("app.routers.cases.postgres.update_case_cause_list")
    @patch("app.routers.cases.get_cause_list_from_store")
    async def test_match_case_cause_list_slashed_and_numeric(self, mock_store, mock_update, mock_get):
        mock_get.return_value = self.sample_case
        mock_store.return_value = {"items": self.sample_cause_items}
        mock_update.side_effect = lambda cid, cdata: {"id": cid, "causeList": cdata}

        # Test slashed matching (43363/2026)
        req_slashed = CaseMatchRequest(caseNumber="43363/2026")
        res1 = await match_case_cause_list("case_test_123", req_slashed)
        self.assertTrue(res1["isListed"])
        self.assertEqual(res1["item"]["caseNumber"], "WP/43363/2026")

        # Test numeric token matching (43363)
        req_num = CaseMatchRequest(caseNumber="43363")
        res2 = await match_case_cause_list("case_test_123", req_num)
        self.assertTrue(res2["isListed"])
        self.assertEqual(res2["item"]["caseNumber"], "WP/43363/2026")

        # Test party fallback
        req_party = CaseMatchRequest(caseNumber="", parties="A.JOHN BOSCO Vs. THE DISTRICT COLLECTOR")
        res3 = await match_case_cause_list("case_test_123", req_party)
        self.assertTrue(res3["isListed"])
        self.assertEqual(res3["item"]["itemNumber"], "1")


if __name__ == "__main__":
    unittest.main()
