"""HTTP boundary for the standalone document-to-Markdown converter.

Upload -> origin check -> bounded conversion -> Markdown response

See docs/bulk-import/article-publish-import-refactor.md for the service boundary.
"""

from __future__ import annotations

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from markitdown import MarkItDown
from starlette.middleware.cors import CORSMiddleware

from contracts import (
    ConversionErrorResult,
    ConversionRequestError,
    Diagnostic,
    DocumentConversionResult,
)
from conversion import Converter, convert_upload
from settings import Settings


def _validate_origin(request: Request, settings: Settings) -> None:
    origin = request.headers.get("origin")
    if origin and settings.allowed_origins and origin not in settings.allowed_origins:
        raise ConversionRequestError(
            403,
            "origin_not_allowed",
            "The request origin is not allowed.",
        )


def create_app(
    *,
    settings: Settings | None = None,
    converter: Converter | None = None,
) -> FastAPI:
    """Build the converter app with injectable settings and converter for tests."""
    active_settings = settings or Settings.from_environment()
    active_converter = converter or MarkItDown(enable_plugins=False)
    app = FastAPI(title="Groupher Document Converter")

    if active_settings.allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=sorted(active_settings.allowed_origins),
            allow_methods=["POST"],
            allow_headers=["content-type"],
            max_age=86_400,
        )

    @app.exception_handler(ConversionRequestError)
    async def conversion_request_error_handler(
        _request: Request,
        error: ConversionRequestError,
    ) -> JSONResponse:
        """Project a stable converter failure into the public diagnostics contract."""
        payload = ConversionErrorResult(diagnostics=[error.diagnostic])
        return JSONResponse(status_code=error.status_code, content=payload.model_dump())

    @app.exception_handler(RequestValidationError)
    async def request_validation_error_handler(
        _request: Request,
        _error: RequestValidationError,
    ) -> JSONResponse:
        """Normalize framework multipart validation failures into one public error."""
        payload = ConversionErrorResult(
            diagnostics=[
                Diagnostic(
                    level="error",
                    code="invalid_request",
                    message="A multipart file field named 'file' is required.",
                )
            ]
        )
        return JSONResponse(status_code=422, content=payload.model_dump())

    @app.get("/health")
    async def health() -> dict[str, str]:
        """Return the stateless service health marker."""
        return {"status": "ok"}

    @app.post(
        "/convert",
        responses={
            400: {"model": ConversionErrorResult},
            403: {"model": ConversionErrorResult},
            413: {"model": ConversionErrorResult},
            415: {"model": ConversionErrorResult},
            422: {"model": ConversionErrorResult},
        },
    )
    async def convert(
        request: Request,
        file: UploadFile = File(...),
    ) -> DocumentConversionResult:
        """Validate and convert one uploaded external document into Markdown."""
        try:
            _validate_origin(request, active_settings)
        except ConversionRequestError:
            await file.close()
            raise

        return await convert_upload(file, active_settings, active_converter)

    return app


app = create_app()
