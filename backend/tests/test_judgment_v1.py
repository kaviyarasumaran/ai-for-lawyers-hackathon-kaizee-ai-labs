"""Comprehensive test suite for Judgment Validity Tracking (API v1).

Tests:
1. Search endpoint across public/verified records.
2. AI Classification & Validation for:
   - ADM Jabalpur (Overruled by 9-Judge Puttaswamy).
   - Puttaswamy (Followed by 5-Judge Navtej Johar).
   - Vidya Drolia (Distinguished by 7-Judge In Re Interplay).
   - P. Ramachandra Rao (Doubted / Conflicting approach).
3. Bench strength rule enforcement (Article 141 hierarchy).
4. Treatment history and judgment detail retrieval.
"""

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.judgment_classifier import validate_treatment_against_rules
from app.main import app


class JudgmentValidityV1Tests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_search_judgments_by_query(self):
        resp = self.client.post(
            "/api/v1/judgment/search",
            json={"query": "ADM Jabalpur", "court": "SUPREME_COURT"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreater(data["total"], 0)
        first = data["results"][0]
        self.assertIn("Jabalpur", first["title"])
        self.assertEqual(first["year"], 1976)
        self.assertIn("1976 INSC", first["neutral_citation"])

    def test_search_judgments_filter_year(self):
        resp = self.client.post(
            "/api/v1/judgment/search",
            json={"query": "Puttaswamy", "year": 2017},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(any("Puttaswamy" in r["title"] for r in data["results"]))

    def test_analyze_adm_jabalpur_overruled(self):
        resp = self.client.post(
            "/api/v1/judgment/analyze",
            json={"judgment_id": "adm_jabalpur"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertEqual(data["overall_status"], "OVERRULED")
        self.assertEqual(data["judgment"]["title"], "Additional District Magistrate, Jabalpur v. Shivkant Shukla")
        self.assertEqual(data["judgment"]["bench_strength"], 5)

        treatments = data["treatments"]
        self.assertGreater(len(treatments), 0)
        puttaswamy_treatment = next((t for t in treatments if "Puttaswamy" in t["later_judgment"]), None)
        self.assertIsNotNone(puttaswamy_treatment)
        self.assertEqual(puttaswamy_treatment["type"], "OVERRULED")
        self.assertEqual(puttaswamy_treatment["bench_strength"], 9)
        self.assertTrue(len(puttaswamy_treatment["supporting_paragraphs"]) > 0)
        self.assertIn("Para 121", puttaswamy_treatment["supporting_paragraphs"])
        self.assertIn("is hereby overruled", puttaswamy_treatment["supporting_text"])
        self.assertEqual(puttaswamy_treatment["verification_status"], "VERIFIED")
        self.assertGreaterEqual(puttaswamy_treatment["confidence"], 0.95)

    def test_analyze_puttaswamy_followed(self):
        resp = self.client.post(
            "/api/v1/judgment/analyze",
            json={"judgment_id": "puttaswamy_2017"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertEqual(data["overall_status"], "FOLLOWED")
        treatments = data["treatments"]
        navtej = next((t for t in treatments if "Navtej" in t["later_judgment"]), None)
        self.assertIsNotNone(navtej)
        self.assertEqual(navtej["type"], "FOLLOWED")

    def test_analyze_vidya_drolia_distinguished(self):
        resp = self.client.post(
            "/api/v1/judgment/analyze",
            json={"judgment_id": "vidya_drolia"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertEqual(data["overall_status"], "DISTINGUISHED")
        treatments = data.get("treatments", [])
        interplay = next((t for t in treatments if "Interplay" in t["later_judgment"]), None)
        self.assertIsNotNone(interplay)
        self.assertEqual(interplay["type"], "DISTINGUISHED")

    def test_analyze_ramachandra_rao_doubted(self):
        resp = self.client.post(
            "/api/v1/judgment/analyze",
            json={"judgment_id": "ramachandra_rao"},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertEqual(data["overall_status"], "DOUBTED")

    def test_bench_strength_constraint_enforced(self):
        # A 2-judge bench cannot overrule a 5-judge bench under Indian constitutional law
        t_type, reason, conf, status = validate_treatment_against_rules(
            treatment_type="OVERRULED",
            orig_bench_strength=5,
            later_bench_strength=2,
            supporting_text="We disagree with the earlier bench.",
        )
        self.assertEqual(t_type, "DOUBTED")
        self.assertIn("cannot overrule a larger 5-Judge bench", reason)
        self.assertEqual(status, "EVIDENCE_REVIEW_REQUIRED")

    def test_get_judgment_details(self):
        resp = self.client.get("/api/v1/judgment/adm_jabalpur")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["id"], "adm_jabalpur")
        self.assertIn("Shivkant Shukla", data["title"])

        # Not found test
        resp_404 = self.client.get("/api/v1/judgment/non_existent_case_xyz")
        self.assertEqual(resp_404.status_code, 404)

    def test_get_treatment_history(self):
        resp = self.client.get("/api/v1/judgment/adm_jabalpur/treatment-history")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["judgment_id"], "adm_jabalpur")
        self.assertGreater(data["total_treatments"], 0)
        self.assertIn("history", data)


if __name__ == "__main__":
    unittest.main()
