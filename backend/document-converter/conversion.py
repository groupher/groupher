"""Bounded conversion pipeline for one uploaded external document.

Upload stream
    |
    v
filename / MIME / byte limits
    |
    v
PDF or OOXML structure checks
    |
    v
MarkItDown -> Markdown + source metadata + diagnostics

See docs/bulk-import/article-publish-import-refactor.md for ownership boundaries.
"""

from __future__ import annotations

from io import BytesIO
from pathlib import PurePath
from tempfile import SpooledTemporaryFile
from typing import BinaryIO, Protocol
from zipfile import BadZipFile, ZipFile

from fastapi import UploadFile
from markitdown import StreamInfo
from starlette.concurrency import run_in_threadpool

from contracts import (
    ConversionRequestError,
    Diagnostic,
    DocumentConversionResult,
    SourceMetadata,
)
from settings import ALLOWED_MIME_TYPES, GENERIC_MIME_TYPE, OOXML_REQUIRED_MEMBERS, Settings


READ_CHUNK_BYTES = 1024 * 1024


class Converter(Protocol):
    """Minimal MarkItDown-compatible converter interface used by the service."""

    def convert_stream(
        self,
        stream: BinaryIO,
        *,
        stream_info: StreamInfo,
    ) -> object:
        """Convert one validated seekable stream into a Markdown-bearing result."""
        ...


def _normalized_filename(filename: str | None) -> str:
    if not filename:
        raise ConversionRequestError(400, "missing_filename", "A filename is required.")

    if "\x00" in filename or "/" in filename or "\\" in filename:
        raise ConversionRequestError(
            400,
            "invalid_filename",
            "The filename must not contain a path.",
        )

    normalized = PurePath(filename).name
    if normalized in {"", ".", ".."} or normalized != filename:
        raise ConversionRequestError(400, "invalid_filename", "The filename is invalid.")

    return normalized


def _validate_source(filename: str | None, content_type: str | None) -> tuple[str, str, str]:
    normalized_filename = _normalized_filename(filename)
    extension = PurePath(normalized_filename).suffix.lower()
    if extension not in ALLOWED_MIME_TYPES:
        raise ConversionRequestError(
            415,
            "unsupported_extension",
            f"Unsupported file extension: {extension or '(none)'}. No conversion was attempted.",
        )

    normalized_mime = (content_type or "").partition(";")[0].strip().lower()
    if not normalized_mime:
        raise ConversionRequestError(415, "missing_mime_type", "A MIME type is required.")

    allowed_mime_types = ALLOWED_MIME_TYPES[extension]
    if normalized_mime != GENERIC_MIME_TYPE and normalized_mime not in allowed_mime_types:
        raise ConversionRequestError(
            415,
            "mime_type_mismatch",
            f"MIME type {normalized_mime} does not match {extension}.",
        )

    return normalized_filename, extension, normalized_mime


async def _copy_upload(
    upload: UploadFile,
    destination: BinaryIO,
    max_upload_bytes: int,
) -> int:
    size = 0

    while chunk := await upload.read(READ_CHUNK_BYTES):
        size += len(chunk)
        if size > max_upload_bytes:
            raise ConversionRequestError(
                413,
                "file_too_large",
                f"The file exceeds the {max_upload_bytes}-byte upload limit.",
            )
        destination.write(chunk)

    if size == 0:
        raise ConversionRequestError(400, "empty_file", "The uploaded file is empty.")

    destination.seek(0)
    return size


def _validate_ooxml_archive(stream: BinaryIO, extension: str, settings: Settings) -> None:
    try:
        with ZipFile(stream) as archive:
            members = archive.infolist()
            if len(members) > settings.max_archive_entries:
                raise ConversionRequestError(
                    413,
                    "archive_too_many_entries",
                    "The document archive contains too many entries.",
                )

            total_size = 0
            for member in members:
                member_parts = member.filename.replace("\\", "/").split("/")
                if member.filename.startswith("/") or ".." in member_parts:
                    raise ConversionRequestError(
                        422,
                        "unsafe_archive_path",
                        "The document archive contains an unsafe path.",
                    )
                if member.flag_bits & 0x1:
                    raise ConversionRequestError(
                        422,
                        "encrypted_archive",
                        "Encrypted document archives are not supported.",
                    )

                total_size += member.file_size
                if total_size > settings.max_archive_bytes:
                    raise ConversionRequestError(
                        413,
                        "archive_too_large",
                        "The document archive expands beyond the allowed size.",
                    )

            required_member = OOXML_REQUIRED_MEMBERS[extension]
            if required_member not in archive.namelist():
                raise ConversionRequestError(
                    422,
                    "invalid_file_content",
                    f"The uploaded file is not a valid {extension} document.",
                )
    except BadZipFile as error:
        raise ConversionRequestError(
            422,
            "invalid_file_content",
            f"The uploaded file is not a valid {extension} document.",
        ) from error
    finally:
        stream.seek(0)


def _validate_file_content(stream: BinaryIO, extension: str, settings: Settings) -> None:
    if extension in OOXML_REQUIRED_MEMBERS:
        _validate_ooxml_archive(stream, extension, settings)
        return

    if extension == ".pdf":
        signature = stream.read(5)
        stream.seek(0)
        if signature != b"%PDF-":
            raise ConversionRequestError(
                422,
                "invalid_file_content",
                "The uploaded file is not a valid .pdf document.",
            )


def _markdown_from(result: object) -> str:
    markdown = getattr(result, "markdown", None)
    if not isinstance(markdown, str):
        markdown = getattr(result, "text_content", None)

    if not isinstance(markdown, str):
        raise RuntimeError("MarkItDown returned no Markdown content")

    return markdown


def _markitdown_stream(stream: BinaryIO) -> BytesIO:
    stream.seek(0)
    return BytesIO(stream.read())


async def convert_upload(
    file: UploadFile,
    settings: Settings,
    converter: Converter,
) -> DocumentConversionResult:
    """Validate, spool, convert, and close one upload without persisting source data."""
    try:
        filename, extension, mime_type = _validate_source(file.filename, file.content_type)
        diagnostics: list[Diagnostic] = []

        if mime_type == GENERIC_MIME_TYPE:
            diagnostics.append(
                Diagnostic(
                    level="warning",
                    code="generic_mime_type",
                    message=(
                        "The client sent a generic MIME type; "
                        "the extension and file content were used."
                    ),
                )
            )

        with SpooledTemporaryFile(max_size=settings.spool_bytes, mode="w+b") as stream:
            size = await _copy_upload(file, stream, settings.max_upload_bytes)
            _validate_file_content(stream, extension, settings)
            stream_info = StreamInfo(
                extension=extension,
                filename=filename,
                mimetype=None if mime_type == GENERIC_MIME_TYPE else mime_type,
            )

            try:
                result = await run_in_threadpool(
                    converter.convert_stream,
                    _markitdown_stream(stream),
                    stream_info=stream_info,
                )
                markdown = _markdown_from(result)
            except ConversionRequestError:
                raise
            except Exception as error:
                raise ConversionRequestError(
                    422,
                    "conversion_failed",
                    "The document could not be converted.",
                ) from error
    finally:
        await file.close()

    return DocumentConversionResult(
        markdown=markdown,
        source=SourceMetadata(
            filename=filename,
            mimeType=mime_type,
            sizeBytes=size,
        ),
        diagnostics=diagnostics,
    )
