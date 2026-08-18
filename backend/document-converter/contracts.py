"""Public document-converter DTOs.

HTTP boundary -> Pydantic DTO -> bounded JSON response -> Content Import caller

See docs/bulk-import/article-publish-import-refactor.md for the HTTP contract.
"""

from typing import Literal

from pydantic import BaseModel


class Diagnostic(BaseModel):
    """One stable conversion warning or error safe to return to the caller."""
    level: Literal["warning", "error"]
    code: str
    message: str


class SourceMetadata(BaseModel):
    """Identity and measured size of the converted upload."""
    filename: str
    mimeType: str
    sizeBytes: int


class DocumentConversionResult(BaseModel):
    """Successful Markdown conversion payload."""
    markdown: str
    source: SourceMetadata
    diagnostics: list[Diagnostic]


class ConversionErrorResult(BaseModel):
    """Failure response containing only bounded public diagnostics."""
    diagnostics: list[Diagnostic]


class ConversionRequestError(Exception):
    """Expected request or conversion failure with an HTTP-safe diagnostic."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.diagnostic = Diagnostic(level="error", code=code, message=message)
