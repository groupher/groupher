# Document Converter

Standalone Python 3.12 service for converting one external document to
Markdown. It is deliberately unaware of Groupher articles, communities,
GraphQL, and Plate Editor state.

## API

`GET /health` returns `{ "status": "ok" }`.

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
python3.12 -m venv .venv
.venv/bin/python -m pip install -e '.[test]'
.venv/bin/python -m pytest
.venv/bin/uvicorn app:app --reload
```

Example conversion:

```sh
curl -F 'file=@./example.docx' http://127.0.0.1:8000/convert
```

The test suite creates real DOCX, PDF, PPTX, and XLSX documents in memory and
sends them through the public multipart endpoint.

## Vercel setup

Create a Vercel project whose Root Directory is
`services/document-converter`. `vercel.json` selects FastAPI and Vercel reads
the dependencies and Python constraint from `pyproject.toml`.

After deployment, smoke-test both endpoints:

```sh
curl https://your-deployment.vercel.app/health
curl -F 'file=@./example.docx' https://your-deployment.vercel.app/convert
```

This project does not change the routing of Groupher's existing `main`,
`dashboard`, `landing`, or `gateway` deployments.
