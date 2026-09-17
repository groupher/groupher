# Artiment Interaction

> 状态：current

## 版本状态

- [V1](./v1.md)：基础 bitmap projection、view event 与 ShadowSync，已实现。
- [V2](./v2.md)：核心 projection 和读写路径已落地，仍保留后续治理项。
- [V3](./v3.md)：correctness、Gate context 与 bounded decode 已落地。
- [V4](./v4.md)：当前主体实现；生产存量清理尚未完成。
- [V5](./v5.md)：ViewTracker 迁出与 Audit 退役已落地；ReportFact/Moderation 仍按独立设计推进。

V4 §6.2 中由 Interaction 承担的 View 查询预算，在 ViewEvents 迁出后由
[ViewTracker V1](../view-tracker/v1.md) 的批量读取与完整 Article assembly 预算取代；V4 正文保留原版本合同。
