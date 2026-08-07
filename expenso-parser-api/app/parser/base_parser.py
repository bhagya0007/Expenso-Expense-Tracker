from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseParser(ABC):
    """Abstract Base Class for Bank Statement Parsers."""

    @abstractmethod
    def parse_content(self, file_bytes: bytes, file_name: str) -> Dict[str, Any]:
        pass
