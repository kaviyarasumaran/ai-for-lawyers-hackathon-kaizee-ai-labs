import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.citator_db import (
    LANDMARK_CITATIONS_DB,
    extract_potential_citations,
    lookup_citation,
    verify_citation_query,
)
from app.main import app


class JudgmentValidityCitatorTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_lookup_citation_known_landmarks(self):
        asian = lookup_citation("Asian Resurfacing of Road Agency")
        self.assertIsNotNone(asian)
        self.assertEqual(asian["status"], "overruled")
        self.assertIn("High Court Bar Association", asian["treatment"])

        nn_global = lookup_citation("NN Global")
        self.assertIsNotNone(nn_global)
        self.assertEqual(nn_global["status"], "overruled")
        self.assertIn("Interplay", nn_global["analysis"])

        kesavananda = lookup_citation("Kesavananda Bharati")
        self.assertIsNotNone(kesavananda)
        self.assertEqual(kesavananda["status"], "good_law")

    def test_extract_potential_citations_patterns(self):
        sample_text = (
            "As held in (2018) 16 SCC 299, interim stay cannot automatically expire. "
            "Further in 2024 INSC 150 the Constitution Bench settled this principle."
        )
        extracted = extract_potential_citations(sample_text)
        self.assertTrue(any("2018" in c or "INSC" in c for c in extracted))

    def test_verify_citation_fallback(self):
        result = verify_citation_query("State of Maharashtra v. Unknown Appellant (2020) 2 SCC 999")
        self.assertEqual(result["status"], "good_law")
        self.assertIn("Supreme Court of India", result["court"])

    @patch("app.postgres.case_migration_ready", True)
    @patch("app.postgres.list_cases")
    def test_get_judgment_validity_overview(self, mock_list_cases):
        mock_list_cases.return_value = [
            {
                "id": "case-test-1",
                "title": "Commercial Arbitration Dispute",
                "precedents": [
                    {
                        "caseName": "Bhatia International v. Bulk Trading",
                        "citation": "(2002) 4 SCC 105",
                        "status": "overruled",
                        "court": "Supreme Court of India",
                    }
                ],
            }
        ]

        response = self.client.get("/api/judgment-validity")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("stats", data)
        self.assertIn("precedents", data)
        self.assertGreater(data["stats"]["total"], 5)
        self.assertGreater(data["stats"]["overruled"], 0)

    @patch("app.postgres.case_migration_ready", True)
    def test_post_verify_citation(self):
        response = self.client.post(
            "/api/judgment-validity/verify",
            json={"citation": "Asian Resurfacing of Road Agency v. CBI"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "overruled")
        self.assertIn("High Court Bar Association", data["treatment"])

    @patch("app.postgres.case_migration_ready", True)
    def test_post_batch_verify(self):
        response = self.client.post(
            "/api/judgment-validity/batch",
            json={"citations": ["Shreya Singhal v. Union of India", "NN Global Mercantile"]},
        )
        self.assertEqual(response.status_code, 200)
        results = response.json()
        self.assertEqual(len(results), 2)
        statuses = {r["caseName"]: r["status"] for r in results}
        self.assertEqual(statuses.get("Shreya Singhal v. Union of India"), "good_law")


if __name__ == "__main__":
    unittest.main()
