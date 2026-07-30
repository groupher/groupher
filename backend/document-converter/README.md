# Document Converter

Standalone Python 3.12 service for converting one external document to
Markdown. It is deliberately unaware of Groupher articles, communities,
GraphQL, and Plate Editor state.

## API

`GET /health` returns the shared `health.v1` contract:

```json
{
  "schemaVersion": "health.v1",
  "status": "ok",
  "service": "document-converter",
  "version": "dev",
  "environment": "development",
  "timestamp": "2026-07-26T00:00:00Z",
  "uptimeMs": 12345,
  "checks": []
}
```

`POST /convert` accepts one `multipart/form-data` field named `file`. Supported
extensions are PDF, DOCX, PPTX, XLSX, HTML, and HTM. The response shape is:

```json
{
  "markdown": "# Converted document",
  "source": {
    "filename": "document.docx",
    "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "sizeBytes": 1234
  },
  "diagnostics": []
}
```

Errors return a non-2xx status with structured diagnostics:

```json
{
  "diagnostics": [
    {
      "level": "error",
      "code": "unsupported_extension",
      "message": "Unsupported file extension: .zip. No conversion was attempted."
    }
  ]
}
```

The service validates filename, extension, MIME type, actual streamed size,
OOXML/PDF signatures, archive expansion, archive paths, and optional browser
origin before invoking MarkItDown. It only calls MarkItDown's stream API, so
user input is never treated as a local path or URI.

## MarkItDown capability

This service is backed by `markitdown 0.1.6`. With built-in converters enabled
and plugins disabled, the installed converter can handle these source families:

- PDF documents.
- PowerPoint presentations: PPTX.
- Word documents: DOCX.
- Excel spreadsheets: XLS and XLSX.
- Images, including metadata extraction and OCR when the runtime dependencies
  are available.
- Audio, including metadata extraction and speech transcription when configured
  with the required runtime dependencies.
- HTML pages and fragments.
- Plain text and other text-like inputs.
- CSV.
- JSON.
- XML.
- ZIP archives, by iterating over supported entries.
- YouTube URLs.
- EPUB books.
- Jupyter notebooks: IPYNB.
- Outlook messages: MSG.
- RSS feeds.
- Wikipedia pages.
- Bing search result pages.

The current HTTP boundary intentionally exposes only bounded file upload
conversion for PDF, DOCX, PPTX, XLSX, HTML, and HTM. URL-based sources such as
YouTube, Wikipedia, RSS, Bing results, and arbitrary web pages are MarkItDown
capabilities, but this service does not expose a URL conversion endpoint yet.
Additional file families such as images, audio, CSV, JSON, XML, ZIP, EPUB, MSG,
IPYNB, and XLS should be enabled only after adding explicit MIME/extension
allowlists, safety validation, size limits, and tests for each family.

## Configuration

- `DOCUMENT_CONVERTER_MAX_BYTES`: maximum streamed upload size. Defaults to
  25 MiB.
- `DOCUMENT_CONVERTER_MAX_ARCHIVE_BYTES`: maximum uncompressed size of an
  Office document archive. Defaults to 250 MiB.
- `DOCUMENT_CONVERTER_MAX_ARCHIVE_ENTRIES`: maximum number of files inside an
  Office document archive. Defaults to 4096.
- `DOCUMENT_CONVERTER_SPOOL_BYTES`: memory threshold before the temporary
  stream rolls over to disk. Defaults to 2 MiB.
- `DOCUMENT_CONVERTER_ALLOWED_ORIGINS`: optional comma-separated browser Origin
  allowlist. Requests without an `Origin` header remain valid for
  server-to-server use. Configure this value in production when browsers call
  the service directly.

## Local development

Use Python 3.12, matching the deployment runtime:

```sh
make be.document-converter.install
make be.document-converter.test
make be.document-converter.start
```

Example conversion:

```sh
curl -F 'file=@./example.docx' http://127.0.0.1:8000/convert
```

The test suite creates real DOCX, PDF, PPTX, and XLSX documents in memory and
sends them through the public multipart endpoint.

Dev Hub manages the same service on port `8000`. It expects the virtualenv at
`backend/document-converter/.venv`; run `make be.document-converter.install`
once before starting Converter from Dev Hub.

## Vercel setup

Create a Vercel project whose Root Directory is
`backend/document-converter`. `vercel.json` selects FastAPI and Vercel reads
the dependencies and Python constraint from `pyproject.toml`.

After deployment, smoke-test both endpoints:

```sh
curl https://your-deployment.vercel.app/health
curl -F 'file=@./example.docx' https://your-deployment.vercel.app/convert
```

This project does not change the routing of Groupher's existing `main`,
`dashboard`, `landing`, or `gateway` deployments.
