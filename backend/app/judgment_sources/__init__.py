"""Modular Indian Court Judgment Sources and Citation Adapters."""

from app.judgment_sources.base import BaseJudgmentAdapter
from app.judgment_sources.manager import JudgmentSourcesManager

__all__ = ["BaseJudgmentAdapter", "JudgmentSourcesManager"]
