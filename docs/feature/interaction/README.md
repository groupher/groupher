# Artiment Interaction

> 状态：current

## 版本状态

- 当前运行时：reaction command 在同一事务内完成权威 fact 与 Projection；View 由独立
  [ViewTracker](../view-tracker/README.md) 拥有；Audit repair 已退役。
- [V5](./v5.md)：当前阶段实施记录；ReportFact/Moderation 仍按独立设计推进。
- [V4](./v4.md)：统一 Facade、reaction 事务与 Projection 的已实施历史记录。
- [V1–V3](./v3.md)：早期 bitmap、ShadowSync、Gate context 与 correctness 演进记录。

新代码不再使用 V1–V4 的 ViewEvents、异步 view worker 或 Audit repair 合同。Article view 当前写协议见
[Article View 计数写链路](../view-tracker/article-view-counting.md)。

## 共享评论与快照

- [Comments、Replies 与 Reaction 快照和计数](../../migrations/comment-reaction-snapshot-counts.md)：
  共享 Doc 评论、持久化/原子 count、有界快照/资料刷新、folded 同页访问、版本 guard 和 replies UI 已在工作区实现；
  独立新库与真实本地页面证据见 [实施记录](../../migrations/comment-reaction-snapshot-counts-implementation.md)。
  生产切换仍受 fresh-generation、旧 writer drain 与缓存失效等 B5 条件阻断，不支持旧数据转换或旧逻辑 fallback。
