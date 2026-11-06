"""Unit tests for the dedicated Court List Assistant Pipeline.

Tests:
1. Semantic chunking into case listings and bench summaries.
2. Vector indexing and store management.
3. Hybrid retrieval (semantic similarity + legal keyword matching).
4. LLM response generation with source grounding and follow-up parsing.
5. Fallback deterministic synthesis when LLM is unavailable.
6. Vector store purging for single-day retention.
"""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.court_list_assistant_pipeline import (
    CauseListChunk,
    chunk_cause_list_items,
    execute_court_list_assistant_pipeline,
    generate_court_list_llm_response,
    index_cause_list_for_assistant,
    purge_court_list_assistant_cache,
    retrieve_relevant_cause_list_chunks,
)


class CourtListAssistantPipelineTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.sample_items = [
            {
                "id": "item_cl_1",
                "itemNumber": "1",
                "caseNumber": "W.P. No. 10293 / 2026",
                "courtNumber": "Court No. 01",
                "judge": "The Hon'ble The Chief Justice",
                "parties": "A. Ramaswamy Vs. State of Tamil Nadu",
                "counsels": "M/s. A.R. Sundaram, Senior Counsel",
                "category": "Motion Cases",
                "session": "Morning Session (10:30 AM)",
                "notes": "Original records to be placed before bench.",
            },
            {
                "id": "item_cl_2",
                "itemNumber": "2",
                "caseNumber": "Crl.O.P. No. 4582 / 2026",
                "courtNumber": "Court No. 07",
                "judge": "The Hon'ble Mr. Justice N. Anand Venkatesh",
                "parties": "K. Murugan Vs. Inspector of Police",
                "counsels": "Mr. P. Muthukumar, Government Pleader",
                "category": "For Admission",
                "session": "Morning Session (10:30 AM)",
                "notes": "Notice of motion returnable in 2 weeks.",
            },
            {
                "id": "item_cl_3",
                "itemNumber": "3",
                "caseNumber": "W.A. No. 892 / 2026",
                "courtNumber": "Court No. 01",
                "judge": "The Hon'ble The Chief Justice",
                "parties": "ABC Corporation Vs. Commercial Tax Officer",
                "counsels": "Mr. S. Jayaraman, Advocate",
                "category": "Final Hearing",
                "session": "Afternoon Session (02:15 PM)",
                "notes": "",
            },
        ]

    async def asyncTearDown(self):
        await purge_court_list_assistant_cache(keep_date_code=None)

    def test_chunking_creates_case_listings_and_bench_summaries(self):
        chunks = chunk_cause_list_items(self.sample_items, display_date="27-10-2026")
        self.assertGreater(len(chunks), len(self.sample_items))

        # Check case listing chunk
        case_chunks = [c for c in chunks if c.chunk_type == "case_listing"]
        self.assertEqual(len(case_chunks), 3)
        c1 = case_chunks[0]
        self.assertEqual(c1.item_number, "1")
        self.assertEqual(c1.case_number, "W.P. No. 10293 / 2026")
        self.assertEqual(c1.court_number, "Court No. 01")
        self.assertIn("W.P. No. 10293 / 2026", c1.content)
        self.assertIn("Sundaram", c1.content)

        # Check bench summary chunks
        bench_chunks = [c for c in chunks if c.chunk_type == "bench_summary"]
        self.assertGreaterEqual(len(bench_chunks), 2)  # Court No. 01 and Court No. 07
        courts_represented = {b.court_number for b in bench_chunks}
        self.assertIn("Court No. 01", courts_represented)
        self.assertIn("Court No. 07", courts_represented)

    async def test_indexing_items_and_vector_caching(self):
        # Mock embeddings to return 768-dim vectors
        fake_vector = [0.1] * 768
        with patch("app.court_list_assistant_pipeline.create_embeddings", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [fake_vector, fake_vector, fake_vector, fake_vector, fake_vector]
            res = await index_cause_list_for_assistant("27102026", self.sample_items, "27-10-2026", allow_embed=True)
            self.assertEqual(res["date_code"], "27102026")
            self.assertGreater(len(res["chunks"]), 0)

    async def test_retrieve_relevant_chunks_by_item_number(self):
        with patch("app.court_list_assistant_pipeline.create_embeddings", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [[0.0] * 768 for _ in range(10)]
            top_chunks, matching_ids = await retrieve_relevant_cause_list_chunks(
                query="What is Item No. 2?",
                date_code="27102026",
                items=self.sample_items,
                display_date="27-10-2026",
                top_k=3,
            )
            self.assertGreater(len(top_chunks), 0)
            self.assertIn("item_cl_2", matching_ids)
            top_listing = [c for c in top_chunks if c.chunk_type == "case_listing"][0]
            self.assertEqual(top_listing.item_number, "2")
            self.assertIn("Court No. 07", top_listing.court_number)

    async def test_retrieve_relevant_chunks_by_counsel_name(self):
        with patch("app.court_list_assistant_pipeline.create_embeddings", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [[0.0] * 768 for _ in range(10)]
            top_chunks, matching_ids = await retrieve_relevant_cause_list_chunks(
                query="Is advocate Sundaram appearing today?",
                date_code="27102026",
                items=self.sample_items,
                display_date="27-10-2026",
                top_k=3,
            )
            self.assertIn("item_cl_1", matching_ids)
            self.assertIn("Sundaram", top_chunks[0].content)

    async def test_llm_response_generation_with_mocked_llm(self):
        chunks = chunk_cause_list_items(self.sample_items, display_date="27-10-2026")
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": (
                            "**Item No. 1** (`W.P. No. 10293 / 2026`) is listed before the **Hon'ble The Chief Justice** in **Court No. 01**.\n\n"
                            "Suggested Follow-ups:\n"
                            "- What is the next item in Court No. 01?\n"
                            "- Show cases listed for final hearing"
                        )
                    }
                }
            ]
        }

        with (
            patch("app.court_list_assistant_pipeline.get_settings") as mock_settings,
            patch("app.court_list_assistant_pipeline.httpx.AsyncClient") as mock_client_cls,
        ):
            settings = MagicMock()
            settings.llm_api_base_url = "http://localhost:1234/v1"
            settings.llm_model = "test-legal-model"
            settings.llm_key = None
            settings.llm_timeout_seconds = 30
            mock_settings.return_value = settings

            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_cls.return_value.__aenter__.return_value = mock_client

            res = await generate_court_list_llm_response(
                query="Which court is item number 1 listed in?",
                date_code="27102026",
                display_date="27-10-2026",
                chunks=chunks[:3],
                all_items=self.sample_items,
                matching_ids=["item_cl_1"],
            )

            self.assertIn("Court No. 01", res["answer"])
            self.assertIn("item_cl_1", res["matchingItemIds"])
            self.assertEqual(res["highlightCourt"], "Court No. 01")
            self.assertGreater(len(res["suggestedFollowUps"]), 0)

    async def test_fallback_deterministic_response_when_llm_offline(self):
        chunks = chunk_cause_list_items(self.sample_items, display_date="27-10-2026")

        with patch("app.court_list_assistant_pipeline.get_settings") as mock_settings:
            settings = MagicMock()
            settings.llm_api_base_url = None  # Simulates unconfigured / offline LLM
            settings.llm_model = None
            mock_settings.return_value = settings

            res = await generate_court_list_llm_response(
                query="Which court is item number 1 listed in?",
                date_code="27102026",
                display_date="27-10-2026",
                chunks=chunks[:2],
                all_items=self.sample_items,
                matching_ids=["item_cl_1"],
            )

            self.assertIn("Item No. 1", res["answer"])
            self.assertIn("Court No. 01", res["answer"])
            self.assertIn("item_cl_1", res["matchingItemIds"])

    async def test_execute_court_list_assistant_pipeline_end_to_end(self):
        with patch("app.court_list_assistant_pipeline.create_embeddings", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [[0.0] * 768 for _ in range(10)]
            result = await execute_court_list_assistant_pipeline(
                query="What matters are listed in Court No. 07?",
                date="27102026",
                items=self.sample_items,
            )
            self.assertIn("answer", result)
            self.assertIn("matchingItemIds", result)
            self.assertIn("item_cl_2", result["matchingItemIds"])
            self.assertIn("suggestedFollowUps", result)

    async def test_execute_pipeline_empty_items(self):
        result = await execute_court_list_assistant_pipeline(
            query="Show listed cases",
            date="27102026",
            items=[],
        )
        self.assertIn("no listed cases", result["answer"])
        self.assertEqual(result["matchingItemIds"], [])

    async def test_party_name_search_returns_exact_item_and_court(self):
        result = await execute_court_list_assistant_pipeline(
            query="A. Ramaswamy Vs. State of Tamil Nadu",
            date="27102026",
            items=self.sample_items,
        )
        self.assertIn("Item No. 1", result["answer"])
        self.assertIn("Court No. 01", result["answer"])
        self.assertIn("item_cl_1", result["matchingItemIds"])

    async def test_nonexistent_party_search_returns_no_listed_matters(self):
        result = await execute_court_list_assistant_pipeline(
            query="Nonexistent Company Vs. Another Org",
            date="27102026",
            items=self.sample_items,
        )
        self.assertIn("No listed matter(s) found", result["answer"])
        self.assertEqual(result["matchingItemIds"], [])

    async def test_purge_court_list_assistant_cache_single_day_retention(self):
        with patch("app.court_list_assistant_pipeline.create_embeddings", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [[0.0] * 768 for _ in range(10)]
            # Index day 1 and day 2
            await index_cause_list_for_assistant("27102026", self.sample_items, "27-10-2026")
            await index_cause_list_for_assistant("28102026", self.sample_items, "28-10-2026")

            # Purge keeping only 28102026
            purged = await purge_court_list_assistant_cache(keep_date_code="28102026")
            self.assertIn("27102026", purged)
            self.assertNotIn("28102026", purged)

            # Purge all (e.g. 11:55 PM daily purge)
            purged_all = await purge_court_list_assistant_cache(keep_date_code=None)
            self.assertIn("28102026", purged_all)


if __name__ == "__main__":
    unittest.main()
