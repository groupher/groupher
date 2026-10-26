# ReviewBot / AlertWall

> 状态：current

当前实现为 ReviewBot / AlertWall V2。目录暂保留 `alert-board/`，避免历史链接失效；当前模块名为 `AlertWall`。

- **[V2 边界、配置与重构实施合同](./v2.md)**：已实施的 ReviewBot / AlertWall、`review_mode`、`ban_words`、`sus_notes`、`review_bot_configs`、CMS review requests、事务与无兼容替换合同。生产切换前，目标环境仍须通过限制、待审及隐藏投影预检。

以下 V1 文档和退役记录仅作历史参考；当前运行合同以 V2 文档和代码为准。目标环境维护切换需单独取得真实数据库、worker 和浏览器证据。

- [设计合同](./design.md)：管理员事务公告板、自动检测、发布模式、UGC 与 Doc 边界。
- [实施合同](./implementation.md)：数据模型、状态流转、权限、事务、provider 与 GraphQL。
- [批次与验收](./delivery.md)：D1–D5 删除、N1–N8 实施及 T01–T25 行为验收（T01a 为独立记录的子用例）。
- [旧 Audit 全链路退役](../../migrations/legacy-content-audit-removal.md)：实际代码扫描、删除与替代、切换条件。
- [逐文件扫描清单](../../migrations/legacy-content-audit-inventory.md)：扫描命中位置、分类及处理方向。
