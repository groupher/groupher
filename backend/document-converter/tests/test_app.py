from __future__ import annotations

from dataclasses import dataclass
from typing import BinaryIO

import pytest
from fastapi.testclient import TestClient
from markitdown import StreamInfo

from app import Settings, create_app


MIME_TYPES = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "html": "text/html",
    "pdf": "application/pdf",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


def test_health(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["schemaVersion"] == "health.v1"
    assert body["status"] == "ok"
    assert body["service"] == "document-converter"
    assert isinstance(body["version"], str)
    assert isinstance(body["environment"], str)
    assert isinstance(body["timestamp"], str)
    assert isinstance(body["uptimeMs"], int)
    assert body["checks"] == []


@pytest.mark.parametrize(
    ("extension", "fixture_name", "expected"),
    [
        ("docx", "docx_bytes", "DOCX Fixture Heading"),
        ("html", "html_bytes", "HTML Fixture Heading"),
        ("pdf", "pdf_bytes", "PDF Fixture Heading"),
        ("pptx", "pptx_bytes", "PPTX Fixture Heading"),
        ("xlsx", "xlsx_bytes", "XLSX Fixture"),
    ],
)
def test_converts_real_documents(
    client: TestClient,
    request: pytest.FixtureRequest,
    extension: str,
    fixture_name: str,
    expected: str,
) -> None:
    payload = request.getfixturevalue(fixture_name)
    response = client.post(
        "/convert",
        files={"file": (f"fixture.{extension}", payload, MIME_TYPES[extension])},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert expected in body["markdown"]
    assert body["source"] == {
        "filename": f"fixture.{extension}",
        "mimeType": MIME_TYPES[extension],
        "sizeBytes": len(payload),
    }
    assert body["diagnostics"] == []


def test_accepts_generic_mime_type_with_warning(client: TestClient, docx_bytes: bytes) -> None:
    response = client.post(
        "/convert",
        files={"file": ("fixture.docx", docx_bytes, "application/octet-stream")},
    )

    assert response.status_code == 200
    assert response.json()["diagnostics"] == [
        {
            "level": "warning",
            "code": "generic_mime_type",
            "message": (
                "The client sent a generic MIME type; "
                "the extension and file content were used."
            ),
        }
    ]


@pytest.mark.parametrize(
    ("filename", "mime_type", "expected_status", "expected_code"),
    [
        ("../fixture.pdf", "application/pdf", 400, "invalid_filename"),
        ("fixture.exe", "application/octet-stream", 415, "unsupported_extension"),
        ("fixture.pdf", "text/plain", 415, "mime_type_mismatch"),
    ],
)
def test_rejects_invalid_source(
    client: TestClient,
    filename: str,
    mime_type: str,
    expected_status: int,
    expected_code: str,
) -> None:
    response = client.post(
        "/convert",
        files={"file": (filename, b"not converted", mime_type)},
    )

    assert response.status_code == expected_status
    assert response.json()["diagnostics"][0]["code"] == expected_code


def test_rejects_empty_file(client: TestClient) -> None:
    response = client.post(
        "/convert",
        files={"file": ("fixture.pdf", b"", "application/pdf")},
    )

    assert response.status_code == 400
    assert response.json()["diagnostics"][0]["code"] == "empty_file"


def test_rejects_file_with_invalid_signature(client: TestClient) -> None:
    response = client.post(
        "/convert",
        files={"file": ("fixture.pdf", b"not a pdf", "application/pdf")},
    )

    assert response.status_code == 422
    assert response.json()["diagnostics"][0]["code"] == "invalid_file_content"


def test_rejects_ooxml_archive_larger_than_configured_limit(docx_bytes: bytes) -> None:
    settings = Settings(max_archive_bytes=128)
    client = TestClient(create_app(settings=settings))

    response = client.post(
        "/convert",
        files={"file": ("fixture.docx", docx_bytes, MIME_TYPES["docx"])},
    )

    assert response.status_code == 413
    assert response.json()["diagnostics"][0]["code"] == "archive_too_large"


def test_maps_missing_file_field_to_diagnostic(client: TestClient) -> None:
    response = client.post("/convert")

    assert response.status_code == 422
    assert response.json() == {
        "diagnostics": [
            {
                "level": "error",
                "code": "invalid_request",
                "message": "A multipart file field named 'file' is required.",
            }
        ]
    }


def test_rejects_file_larger_than_configured_limit(pdf_bytes: bytes) -> None:
    client = TestClient(create_app(settings=Settings(max_upload_bytes=8)))

    response = client.post(
        "/convert",
        files={"file": ("fixture.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 413
    assert response.json()["diagnostics"][0]["code"] == "file_too_large"


def test_rejects_unlisted_browser_origin(pdf_bytes: bytes) -> None:
    settings = Settings(allowed_origins=frozenset({"https://dash.groupher.com"}))
    client = TestClient(create_app(settings=settings))

    response = client.post(
        "/convert",
        headers={"origin": "https://untrusted.example"},
        files={"file": ("fixture.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 403
    assert response.json()["diagnostics"][0]["code"] == "origin_not_allowed"


def test_allows_configured_browser_origin_preflight() -> None:
    origin = "https://dash.groupher.com"
    settings = Settings(allowed_origins=frozenset({origin}))
    client = TestClient(create_app(settings=settings))

    response = client.options(
        "/convert",
        headers={
            "access-control-request-method": "POST",
            "origin": origin,
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


@dataclass
class BrokenConverter:
    def convert_stream(self, _stream: BinaryIO, *, stream_info: StreamInfo) -> object:
        raise ValueError(stream_info.filename)


def test_maps_converter_failure_to_safe_diagnostic(pdf_bytes: bytes) -> None:
    client = TestClient(create_app(converter=BrokenConverter()))

    response = client.post(
        "/convert",
        files={"file": ("fixture.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 422
    assert response.json() == {
        "diagnostics": [
            {
                "level": "error",
                "code": "conversion_failed",
                "message": "The document could not be converted.",
            }
        ]
    }
