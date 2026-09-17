# 命名规则

本文记录适用于整个 Groupher 仓库的命名约束。新代码、数据库字段、GraphQL schema、类型定义和文档都应
使用同一术语；不为未发布设计保留旧字段或 alias。

## 使用 `type`，禁止 `_kind`

项目统一使用 `type` 表示封闭分类，不新增以 `_kind` 结尾的命名：

```text
正确                          禁止
actor_type                    actor_kind
viewer_type                   viewer_kind
resource_type                 resource_kind
actor_types                   actor_kinds
```

该规则覆盖变量、函数参数、结构字段、数据库列、GraphQL 字段/enum、TypeScript 类型和文档术语。仓库中
已有的 `snapshot_kind`、`body_kind` 等存量命名不要求发起独立的全仓迁移；当功能改动实际触及其所属
模型、协议或字段时，在同一改动中收敛为 `type`。仅修改同模块的无关代码不应被迫扩大成命名迁移。
实施尚未发布的设计时直接替换旧命名，不保留 alias、双写或兼容读取。

`type` 表示分类，boolean 表示相互独立的二元事实。不要为了把多个维度塞进一个 enum 而制造组合类型。
例如访问者协议使用：

```text
actor_type
  human / agent / crawler / unknown

is_authenticated
  true / false
```

来源或验证方式使用独立字段表达，例如 `classified_by = account_session | signed_anonymous_id |
agent_credential | delegation_credential | verified_crawler | self_reported | fallback`。
