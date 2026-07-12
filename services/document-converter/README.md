# Document Converter

Minimal Vercel Python Runtime service used to verify the document conversion
deployment boundary before adding MarkItDown and file uploads.

## Endpoints

- `GET /health` returns `{ "status": "ok" }`.
- `POST /convert` returns an empty Markdown result.

## Vercel setup

Create a Vercel project whose Root Directory is
`services/document-converter`. Vercel reads `pyproject.toml`, installs the
declared Python dependencies, and loads the FastAPI application from
`app:app`.

After deployment, verify both endpoints:

```sh
curl https://your-deployment.vercel.app/health
curl -X POST https://your-deployment.vercel.app/convert
```

This standalone project does not change the routing of Groupher's existing
`main`, `dashboard`, `landing`, or `gateway` Vercel projects. A private Vercel
Service binding can be added later if the dashboard deployment is migrated to
a multi-service project.
