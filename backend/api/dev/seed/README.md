# 本地 seed 命令

在目标 checkout 的仓库根目录运行。先准备并迁移该环境的开发库，启动本环境的 Dev Hub 和受管 Phoenix。服务端核对环境、实际数据库和调用者，通过业务入口创建资源。先用 `pnpm devhub doctor` 核对 checkout 和数据库归属。命令和可选参数以 `pnpm seed --help` 为准，查看帮助无需启动服务。

以下代码块可在同一个 Bash 或 Zsh 终端运行。「账号与社区」到「归档与清理」是一条连续的流程；「主题权限场景」和「常驻 home」可各自独立运行。每个新场景生成自己的 run 和 slug。重试未完成的操作时保留原变量、操作 key 和输入。run 记录资源归属，同一开发库中的 slug 仍须唯一。

加 `--json` 时，成功响应包含 `environment`（checkout 路径）、`run`、`command`、`status` 和 `result`。清理返回 `blocked` 或 `partial` 时以非零状态退出，错误以 JSON 输出到 stderr。

## 账号与社区

创建两个合成账号，让 owner 持有新社区的初始 lord 关系。最后列出本 run 的账号和当前成员关系。

```sh
seed_run="demo-$(node -p "require('node:crypto').randomBytes(5).toString('hex')")"
seed_slug="$seed_run"
pnpm seed actor create --run "$seed_run" --alias owner
pnpm seed actor create --run "$seed_run" --alias editor
pnpm seed community create --run "$seed_run" --owner owner --slug "$seed_slug" --title "Seed demo"
pnpm seed actor list --run "$seed_run" --json
```

## 管理员邀请与权限

接上节。owner 邀请 editor，editor 用邀请的 key 接受。要验证产品内的接受流程，可以在 invite 后停下，通过 UI 接受。修改权限时传入完整权限集合；下面给 editor 增加 RSS 权限，再移除该成员。再次运行 actor list 可以核对成员关系。

```sh
pnpm seed admin invite --run "$seed_run" --community "$seed_slug" --by owner --to editor --key invite-editor --permissions dashboard.theme.update
pnpm seed admin accept --run "$seed_run" --as editor --invite invite-editor
pnpm seed admin set-permissions --run "$seed_run" --community "$seed_slug" --by owner --member editor --key update-editor --permissions dashboard.theme.update,dashboard.rss.update
pnpm seed admin remove --run "$seed_run" --community "$seed_slug" --by owner --member editor --key remove-editor
pnpm seed actor list --run "$seed_run" --json
```

## 创建文章

使用「账号与社区」中的 owner 和仍处于 active 状态的社区。文章通过本环境的 Auth、Dash 和 Content Publisher 写入，需启动受管服务，并确保本机 Playwright 能启动 Chrome。第一条创建未发布的 Post，第二条使用另一 key 创建已发布的 Post，按需运行。后续文章授权使用返回的 `articleId`。同一 key 重试须保持标题、Markdown 和发布方式一致。

```sh
pnpm seed article create --run "$seed_run" --as owner --community "$seed_slug" --thread post --key draft --title "Seed draft" --markdown "Draft body" --json
pnpm seed article create --run "$seed_run" --as owner --community "$seed_slug" --thread post --key published --title "Seed published post" --markdown "Published body" --publish --json
```

## 归档与清理

由创建社区的 owner 请求归档，查看返回的 `lifecycle`。归档保留社区行、slug 和初始 lord。随后预览本 run 的清理范围，核对结果后执行最后一条。预览只读，apply 核对通过后封存 run，并逐项报告保留或受阻的资源。

```sh
pnpm seed community request-destroy --run "$seed_run" --by owner --slug "$seed_slug" --json
pnpm seed cleanup run --run "$seed_run" --json
pnpm seed cleanup run --run "$seed_run" --apply --json
```

## 典型测试 case

case 在 `dev/seed/cases/` 组合原子动作，准备可复现的初始状态；具体产品操作仍需在 UI 或真实入口验收。每个 case 使用新的 run 和社区 slug，重试同一 case 保持原参数。

### 主题编辑权限

该 case 创建 owner、editor、limited、一个新社区及已接受的管理员关系。用 editor 和 limited 在同一社区测试修改主题，前者具有 `dashboard.theme.update`，后者没有该权限。

```sh
theme_run="theme-$(node -p "require('node:crypto').randomBytes(5).toString('hex')")"
pnpm seed case theme-edit-permission --run "$theme_run" --community "$theme_run" --json
pnpm seed actor list --run "$theme_run" --json
```

场景验收结束后，核对预览，再清理这个独立的 run。

```sh
pnpm seed cleanup run --run "$theme_run" --json
pnpm seed cleanup run --run "$theme_run" --apply --json
```

### 管理员邀请

准备待接受的邀请，适合测试邀请的产品界面；使用 `invitee` 登录后，在 UI 中接受。若只需要一个已经接受的管理员，换用第二条 case 命令；两种状态使用不同的 run。邀请授予 `dashboard.theme.update`，记录的邀请 key 为 `case-invitation`。待接受 case 在邀请已被决定后重跑会报告状态冲突。

```sh
invite_run="invite-$(node -p "require('node:crypto').randomBytes(5).toString('hex')")"
pnpm seed case admin-invitation-pending --run "$invite_run" --community "$invite_run" --json

admin_run="admin-$(node -p "require('node:crypto').randomBytes(5).toString('hex')")"
pnpm seed case admin-invitation-accepted --run "$admin_run" --community "$admin_run" --json
pnpm seed cleanup run --run "$invite_run" --json
pnpm seed cleanup run --run "$invite_run" --apply --json
pnpm seed cleanup run --run "$admin_run" --json
pnpm seed cleanup run --run "$admin_run" --apply --json
```

## 常驻 home

独立运行。为当前开发库准备常驻的 home 内容。先确认本环境的 Phoenix、Auth、Assets 已就绪，Assets 的上传完成回调可以到达 Phoenix。此动作固定使用 `home` run，无需传入上面示例的 run 或 slug。

```sh
pnpm seed home prepare --json
```

## 文章恢复与隔离测试

文章操作已经取得发送权但仍为 `pending` 时，清理和兼容命令 `actors close` 都会拒绝封存，直到该操作可以安全核对。尚未发送的 `prepared` 操作可随 run 封存而取消，之后不能再取得发送权。
已发送的待确认文章找不到可验证的已提交结果时，不会自动重发；发送前浏览器准备失败可重试。预览保留操作引用、准备时间和发送状态供排查。下游终态核对尚未实现，因此尚无法自动区分未提交与仍在执行。

执行 `pnpm test:seed-isolated` 可在临时 PostgreSQL 和独立的后端副本中运行 seed 并发、文章恢复、授权与环境准入测试，并验证 Mix 拒绝删除或重置模拟的主开发库与测试库；需要本机安装 PostgreSQL 工具及已安装的 Mix 依赖。命令结束后会停止并回收临时实例。它不替代受管服务与双 worktree 的端到端验收。

完整契约、权限与待完成的跨进程恢复见[本地 seed 设计](../../../../docs/architecture/local-seed-toolkit.md)。数据库登记、回收和双 worktree 验收见[多 worktree 方案](../../../../docs/architecture/dev-hub-multi-worktree.md)。
