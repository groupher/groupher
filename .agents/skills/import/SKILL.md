---
name: import
description: Diagnose or change Groupher content import, from a single source entering an editor to reviewing and applying a Docs dataset. Use for conversion, staging, source mapping and import recovery.
---

# Import

Start with the [runtime boundary](../../../docs/import/app-boundary.md). The Import Worker reads external sources and coordinates analysis and apply. The Converter Worker handles supported office documents. Cloudflare Workflows and R2 hold workflow execution and temporary artifacts. Phoenix owns admission, persistent jobs, BodyBag staging and the domain transaction. Trace the deployed entrypoints in `backend/import` and `backend/converter`. [Runtime guide](../../../docs/import/runtime-migration.md)

## Single item

Identify the source format, target thread and requested outcome. For editor insertion, verify the imported content in the editor. For a persistent save, follow the target’s normal [Content Publisher](../content-publisher/SKILL.md) and Phoenix write path, then reload the saved article. Keep thread-specific permissions, version checks and required fields. Markdown/MDX can enter the shared codec directly. Only supported file formats use the converter. [Codec and publishing contract](../../../docs/import/article-publish-import-refactor.md)

## Bulk Docs

Trace one source revision through analysis, SourceTree, Review, the selected plan, staging, atomic Docs apply and source mappings. Check that an interrupted apply can be retried, a changed target revision is detected, and a failed transaction leaves the Docs tree consistent. Preserve title provenance, review decisions and hierarchy when testing framework adapters. A successful preview covers only the stages before apply. [Bulk product flow](../../../docs/import/bulk-import.md) · [ImportPlan](../../../docs/import/import-plan.md) · [Recovery](../../../docs/import/import-error-handling.md)

Run the focused Worker checks for the changed phase and Phoenix integration checks when staging, authorization or apply changes. Use browser acceptance when the editor or Review interaction changes. [Import documentation index](../../../docs/import/README.md)
