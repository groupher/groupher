# Tickets

> 状态：current

Ticket V2 已实现；2026-11-02 的 R11 Activity 补齐与迁移拒绝路径已通过 54 项定向回归。当前**完整后端复验尚未通过**：最近一次全量在默认并发、seed=162132 下为 2,454/2,455 passed、1 excluded，既有 Assets/Press 批量用例超时；补充迁移测试后未重跑全量，不能声明 V2 全部验收。上轮 2,449 项通过、前端 296 files/1,245 tests 等记录保留为历史证据；本轮新 migration 已在本地测试库完成空库重建验证。最新结果见 [实施追踪](./inventory.md#v2-实施追踪)。本轮只做本地/测试库演练；生产/共享环境与真实 CDN/URL smoke 不在范围内。

本文索引 Ticket 领域合同、第一版历史记录和 V2 实施追踪。当前代码合同以 [Ticket V2](./v2.md) 为准；第一版记录用于说明被替换的设计。

[V2 合同](./v2.md)已落实到当前运行时代码：发布状态由 ArticleLifecycle 拥有，工作状态由 Ticket Lifecycle 拥有；TicketSource 完整替换 TicketPost；ReviewBlock、Community、Post 可见性、缓存与通知进入事务内编排。R01/R12 的本地测试库重建与 migration 演练已完成；生产/共享环境清理、外部派生存储、快照恢复和真实 CDN/URL smoke 不在本轮范围内。其他本地实现证据见 [V2 实施追踪](./inventory.md#v2-实施追踪)。

V2 的[来源关联合同](./v2.md#4-ticketsource-与首批-post-规则)明确由 **TicketSource / cms.ticket_sources 完整替换 TicketPost / cms.ticket_posts**，来源字段统一使用 **type**，首批仅支持 POST；Post 发布/降级规则保持已确认范围。[首批异步联动](./v2.md#53-首批异步联动相关-post-的处理进度)负责关联 Post 的处理进度刷新、缓存和通知，进度仍从 Ticket 事实读时计算。Comment、Survey、Email/IM/Agent 对话、客户通话和 issue tracker/Bot 集成只记录扩展方向，具体规则随接入确定；协议交互沿用统一接入层。

- [Ticket 与 Kanban 改造实施合同](./implementation.md)
- [文件级起始改造清单](./inventory.md)
- [T0 出口合同](./t0-contract.md)
- [Ticket V2 当前合同与实施记录](./v2.md)
- [Goal 与 Ticket 组织关系讨论稿](./goal-design.md)：后续产品方向，尚未实现。
