# Passport P0 盘点（进行中）

本文件记录切换前的盘点基线，不表示 P0 完成，也不是当前运行时授权目录。逐项映射见 [Action 映射](./passport-p0-action-mapping.md)，消费者及批次见 [消费者盘点](./passport-p0-consumers.md)。实施以 Passport 改造文档为准；未核对的调用方继续补充。

- 切换前 `packages/contracts/gate.contract.json` 有 110 个 action、19 个 global action、16 个 owner fallback、10 个 owner only、9 个 alias、13 个 thread grant suffix。当时生成器输出 `GATE_REQUIREMENT` 和 `GateAction.requirement/1` 的旧协议；当前生成合同已切换，旧消费方仍需按批次迁移。
- `Helper.PermissionConfig.global_grants/0` 还列出 `god`、`stamp_passport`、`system_notification.publish` 与各 thread 的 `community.mirror / unmirror / move`；不能把仅存在于 grant 清单的键遗漏或机械生成同名 Action。`cms_grants/0` 展开各 thread 的 edit、trash、restore、permanent_delete、pin、sink、comment lock 和 community_tag grants，另含 doc queue、review、ticket 等键。
- 切换前 `Helper.PermissionRegistry`、`CMS.Passport.Registry`、GraphQL Passport middleware、Gate Access policy、前端 `useGate` 和 PassportEditor 消费旧 requirement 或 passport JSON；Admin setup / persist、production seed 和测试也写入旧授权。当前各入口状态见消费者盘点，未全部切换前不可发布。
- 旧社区正文 `post / blog / changelog / doc.edit` 不自动转换为 Article 正文权限；普通 Article 切换归 C3，Doc 归 D1。`post.set_category` 是独立 Community action。`doc.trash` 全部消费者及旧查询入口由 D2 同批切换。普通 Article 本站 Trash 归 P2B。
- `Moderators.Persist`、`Moderators.Setup`、production seed 与支持代码调用 `stamp_passport`；这些写入口和其数据迁移必须随对应批次迁移，不以删除 action 映射代替。

待补：逐键调用方和目标 action / scope / 批次、旧 grant-only 键去向、宏 / middleware / seed / job 覆盖、旧通知实际值与 producer、Trash 数据关系及锁序。目标环境数据是否保留及转换范围需以实际数据为准。
