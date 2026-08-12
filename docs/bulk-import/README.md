# Content Import 文档索引

本目录集中维护批量/多来源导入的架构、产品流程、实施计划和联调记录。

| 文档                                                                         | 负责边界                                                       |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`content_import_architecture.md`](./content_import_architecture.md)         | 跨来源总体架构、公共术语、Node/Phoenix 职责与持久映射          |
| [`markdown_title_normalization.md`](./markdown_title_normalization.md)       | MD/MDX 元数据标题、可见标题、导航标题与前导 H1 消费规则        |
| [`bulk_import.md`](./bulk_import.md)                                         | GitHub Docs Bulk Import 产品步骤、Review、冲突与验收           |
| [`content_import_refactor_plan.md`](./content_import_refactor_plan.md)       | 重构实施计划、历史迁移证据与剩余 release gate                  |
| [`import_file_sdk.md`](./import_file_sdk.md)                                 | PreviewStore、Files SDK、PostgreSQL staging 与临时对象生命周期 |
| [`import_process_log.md`](./import_process_log.md)                           | Preview/Job Process 投影、轮询与过程日志                       |
| [`article_publish_import_refactor.md`](./article_publish_import_refactor.md) | 共享 Import Content、Rich Editor codec、publisher 与 BodyBag   |
| [`import_error_handling.md`](./import_error_handling.md)                     | 联调错误复盘、Back/reset、重复来源覆盖与回归清单               |

阅读顺序建议：先看总体架构和产品流程；实施时再进入 Files SDK、Process、publisher 和 refactor plan；排查异常时从错误处理复盘进入对应边界。
