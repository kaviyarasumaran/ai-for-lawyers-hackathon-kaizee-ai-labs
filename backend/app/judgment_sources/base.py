"""Base class for Indian Judgment Sources and Adapters."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseJudgmentAdapter(ABC):
    """Abstract interface for judgment retrieval, search, and citation analysis."""

    name: str = "base"
    source_display_name: str = "Base Source"
    official_source_url: str = ""

    @abstractmethod
    async def search(
        self,
        query: str,
        court: str | None = None,
        year: int | None = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Search publicly accessible records by judgment title, citation, or neutral citation."""
        raise NotImplementedError

    @abstractmethod
    async def get_judgment(self, judgment_id: str) -> dict[str, Any] | None:
        """Retrieve original judgment metadata and textual content."""
        raise NotImplementedError

    @abstractmethod
    async def get_citing_judgments(
        self,
        judgment: dict[str, Any],
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Retrieve subsequent judgments that cite or refer to the given judgment."""
        raise NotImplementedError
