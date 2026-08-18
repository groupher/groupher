"""Environment-backed limits for the standalone document converter.

Deployment environment -> validated Settings -> HTTP/conversion limits

See docs/bulk-import/article-publish-import-refactor.md for fixed service ownership.
"""

from __future__ import annotations

from dataclasses import dataclass
from os import getenv


DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024
DEFAULT_MAX_ARCHIVE_BYTES = 250 * 1024 * 1024
DEFAULT_MAX_ARCHIVE_ENTRIES = 4_096
DEFAULT_SPOOL_BYTES = 2 * 1024 * 1024

ALLOWED_MIME_TYPES = {
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".htm": {"application/xhtml+xml", "text/html"},
    ".html": {"application/xhtml+xml", "text/html"},
    ".pdf": {"application/pdf"},
    ".pptx": {"application/vnd.openxmlformats-officedocument.presentationml.presentation"},
    ".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
}
GENERIC_MIME_TYPE = "application/octet-stream"
OOXML_REQUIRED_MEMBERS = {
    ".docx": "word/document.xml",
    ".pptx": "ppt/presentation.xml",
    ".xlsx": "xl/workbook.xml",
}


def _positive_int(value: str | None, fallback: int) -> int:
    if value is None:
        return fallback

    try:
        parsed = int(value)
    except ValueError:
        return fallback

    return parsed if parsed > 0 else fallback


@dataclass(frozen=True)
class Settings:
    """Validated converter limits and optional browser-origin allowlist."""
    max_upload_bytes: int = DEFAULT_MAX_UPLOAD_BYTES
    max_archive_bytes: int = DEFAULT_MAX_ARCHIVE_BYTES
    max_archive_entries: int = DEFAULT_MAX_ARCHIVE_ENTRIES
    spool_bytes: int = DEFAULT_SPOOL_BYTES
    allowed_origins: frozenset[str] = frozenset()

    @classmethod
    def from_environment(cls) -> Settings:
        """Load positive limits and normalized allowed origins from the environment."""
        return cls(
            max_upload_bytes=_positive_int(
                getenv("DOCUMENT_CONVERTER_MAX_BYTES"),
                DEFAULT_MAX_UPLOAD_BYTES,
            ),
            max_archive_bytes=_positive_int(
                getenv("DOCUMENT_CONVERTER_MAX_ARCHIVE_BYTES"),
                DEFAULT_MAX_ARCHIVE_BYTES,
            ),
            max_archive_entries=_positive_int(
                getenv("DOCUMENT_CONVERTER_MAX_ARCHIVE_ENTRIES"),
                DEFAULT_MAX_ARCHIVE_ENTRIES,
            ),
            spool_bytes=_positive_int(
                getenv("DOCUMENT_CONVERTER_SPOOL_BYTES"),
                DEFAULT_SPOOL_BYTES,
            ),
            allowed_origins=frozenset(
                origin.strip()
                for origin in getenv("DOCUMENT_CONVERTER_ALLOWED_ORIGINS", "").split(",")
                if origin.strip()
            ),
        )
