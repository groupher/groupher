# 本地开发环境 `dev` 合并修复

> 状态：已完成；代码、启动入口和本地数据库已切换到 `dev`，旧 mock 进程和数据库已清理。

## 1. 问题

当前仓库存在两套本地 Phoenix 环境：

```text
MIX_ENV=dev
  -> 读取 DB_* 环境变量
  -> 默认端口 3433
  -> 原意是连接开发数据库 / RDS

MIX_ENV=mock
  -> localhost:5432
  -> groupher_server_mock
  -> 当前 Dev Hub、Makefile 和本地 Phoenix 实际使用
```

这会造成几个问题：

1. `mix phx.server` 默认使用 `dev`，但本地 PostgreSQL 实际在 `5432`，因此默认启动失败。
2. `Makefile` 的 `be.start`、`be.start.managed` 和 `be.mock.start` 使用 `mock`，而
   `be.migrate`、README 示例使用 `dev`。
3. Dev Hub、Press 和 Phoenix 对本地数据库的命名不一致，开发者无法从 `MIX_ENV` 判断
   当前连接的是哪套数据。
4. `mock` 已经承担完整本地开发环境职责，不再是一个只用于测试替身的环境。

## 2. 目标

本地开发只保留 `dev`：

```text
MIX_ENV=dev
  -> Phoenix 本地开发服务
  -> PostgreSQL localhost:5432
  -> groupher_server_dev
```

测试环境继续独立：

```text
MIX_ENV=test
  -> groupher_server_test
  -> SQL Sandbox
```

生产和生产数据维护环境 `prod`、`seed_prod` 保持不变。`mock.exs` 删除，不再作为
Phoenix 运行环境或数据库迁移环境。

## 3. 目标配置

`config/dev.exs` 应成为唯一的本地 Phoenix 配置：

| 配置项        | 目标值                     |
| ------------- | -------------------------- |
| `MIX_ENV`     | `dev`                      |
| `DB_HOST`     | 默认 `localhost`           |
| `DB_PORT`     | 默认 `5432`                |
| `DB_USERNAME` | 本地 PostgreSQL 用户       |
| `DB_PASSWORD` | 本地 PostgreSQL 密码       |
| `DB_NAME`     | 默认 `groupher_server_dev` |
| Phoenix HTTP  | `4001`                     |
| `server`      | `true`                     |

允许 `.env.local` 覆盖连接参数，但没有 `.env.local` 时也必须能连接标准本地
PostgreSQL。不能把 `3433` 作为本地默认端口，也不能要求开发者预先配置生产/RDS 地址。

`mock.exs` 中的本地 secret、server 和 endpoint 行为应迁移到 `dev.exs`；不应通过复制
两份配置继续维持两套合同。

## 4. 迁移范围

### Phoenix / Mix

- 将 `Makefile` 中的 `MIX_ENV=mock` 改为 `MIX_ENV=dev`。
- 将 `be.migrate.mock`、`be.rollback.mock` 删除或改名为对应的 `dev` 命令。
- 让 `be.start`、`be.start.managed`、`be.migrate`、README 示例统一使用 `dev`。
- 删除 `backend/api/config/mock.exs`。
- 检查 `mix.exs`、启动脚本和 CI，确保没有隐式依赖 `mock` 环境。

### 数据库

- 将本地数据库从 `groupher_server_mock` 迁移为 `groupher_server_dev`（新库已创建并迁移）。
- 更新 Dev Hub 的 Phoenix 和 Press 环境变量。
- 更新本地 seed、reset、repair 脚本中的数据库名称。
- `groupher_server_test` 保持不变，不与开发数据库共享。

本迁移只涉及本地数据库命名，不触碰生产数据库。旧 mock 数据库已在确认无连接后删除。

### 文档和工具

- 更新 `backend/api/README.md` 的启动与迁移命令。
- 更新 `docs/infra/local-development.md`，明确 Phoenix 使用 `MIX_ENV=dev`。
- 更新 Dev Hub service definition 和相关测试。
- 全仓搜索并移除当前运行路径中的 `MIX_ENV=mock`、`be.migrate.mock` 和
  `groupher_server_mock`。

## 5. 迁移顺序

```text
更新 dev.exs 本地连接合同
  -> 将 mock 的本地运行能力合并到 dev
  -> 更新 Makefile / Dev Hub / Press / scripts
  -> 创建 groupher_server_dev
  -> 在 dev 环境执行 ecto.setup / seed
  -> 删除 mock.exs 与 mock 命令
  -> 删除旧 groupher_server_mock（已完成）
```

删除旧数据库前必须先确认：

- Phoenix、Press、Dev Hub 均已切换到 `groupher_server_dev`；
- 本地需要保留的数据已迁移或明确不需要；
- `groupher_server_test` 不受影响；
- 没有运行中的服务仍持有旧数据库连接。

## 6. 验收

在没有额外 `MIX_ENV` 或数据库环境变量时：

```bash
cd backend/api
MIX_ENV=dev mix ecto.setup
MIX_ENV=dev mix phx.server
```

应连接本地 `groupher_server_dev` 并监听 `4001`。

额外验证：

```bash
MIX_ENV=dev mix ecto.migrate
MIX_ENV=dev mix ecto.rollback
MIX_ENV=test mix ecto.migrate
mix compile --warnings-as-errors
mix test
```

并确认以下命令不再存在或不再被调用：

```text
MIX_ENV=dev mix phx.server
MIX_ENV=dev mix ecto.migrate
be.migrate
```

## 7. 非目标

- 不把 `test` 合并进 `dev`。
- 不让本地开发连接生产 RDS 或生产 Neon。
- 不保留一个只改数据库名、但仍拥有独立 Phoenix 配置的 `mock` 环境。
- 不通过环境变量把 `dev` 再次默认为远程开发数据库；远程环境应使用显式的部署配置。
