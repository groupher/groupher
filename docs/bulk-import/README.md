# Content Import 文档索引

本目录集中维护批量/多来源导入的架构、产品流程、实施计划和联调记录。

| 文档                                                                         | 负责边界                                                       |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`content-import-architecture.md`](./content-import-architecture.md)         | 跨来源总体架构、公共术语、Node/Phoenix 职责与持久映射          |
| [`markdown-title-normalization.md`](./markdown-title-normalization.md)       | MD/MDX 元数据标题、可见标题、导航标题与前导 H1 消费规则        |
| [`bulk-import.md`](./bulk-import.md)                                         | GitHub Docs Bulk Import 产品步骤、Review、冲突与验收           |
| [`content-import-refactor-plan.md`](./content-import-refactor-plan.md)       | 重构实施计划、历史迁移证据与剩余 release gate                  |
| [`import-file-sdk.md`](./import-file-sdk.md)                                 | PreviewStore、Files SDK、PostgreSQL staging 与临时对象生命周期 |
| [`import-process-log.md`](./import-process-log.md)                           | Preview/Job Process 投影、轮询与过程日志                       |
| [`article-publish-import-refactor.md`](./article-publish-import-refactor.md) | 共享 Import Content、Rich Editor codec、publisher 与 BodyBag   |
| [`import-error-handling.md`](./import-error-handling.md)                     | 联调错误复盘、Back/reset、重复来源覆盖与回归清单               |

阅读顺序建议：先看总体架构和产品流程；实施时再进入 Files SDK、Process、publisher 和 refactor plan；排查异常时从错误处理复盘进入对应边界。
