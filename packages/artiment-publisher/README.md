# @groupher/artiment-publisher

Private workspace package for the canonical Plate value to BodyBag pipeline.

It owns structure and size validation, canonical JSON and body hashing, Markdown,
HTML sanitization, TOC, plain text, and digest derivation. Runtime-specific HTTP,
authorization, GraphQL, staging, and apply workflows stay in their owning apps.

This package is consumed directly from the monorepo workspace and is not published
to the npm registry or deployed as a standalone service.
