# Press

> 状态：current

- [Phoenix 公开正文 R3 改接](../migrations/article-public-body-r3.md)：工作区的详情、feed、manifest 已使用 PublicBody；目标环境及真实外部投递尚未验收。
- [部署记录](./cloudflare-workers-deployment.md)：生产已硬切 Cloudflare Workers，旧 Fly app 已删除；验收证据与未完成项。
- [迁移实施方案](./cloudflare-workers-migration.md)：已执行的硬切方案与验收状态；窗口为 best-effort、接受中断。
- [独立任务与 Search 语义](./effect-delivery.md)：ASCII 说明、发布/可见性范围、旧队列不兼容边界与 fixture 隔离。
- [运维工具](../../ops/press/README.md)：发布、隔离 preview、Free 告警和 route 复核。
- [V1 历史设计](./v1.md)：保留产品合同与原 Node/Fly 设计；部署现状以部署记录为准。

保持 Workers Free，超限拒绝、不升级、不回退。
