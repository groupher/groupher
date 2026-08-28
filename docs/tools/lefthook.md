# Lefthook 迁移方案

> 历史实施记录：下文列出的 `frontend/main`、`frontend/dashboard` 和 `infra/gateway`
> 是迁移当时的检查矩阵，不代表当前 workspace。当前配置以根 `lefthook.yml` 为准。

## 结论

项目可以采用 Lefthook，但目标应是替换 Husky + lint-staged 的 Git hooks 编排层，不应与现有两者并存。

当前主要问题不是 Husky 本身，而是 pre-commit 在 staged 检查后还执行全仓 pnpm run format:check，容易让无关脏文件阻塞小提交。迁移的真正价值是：

- 集中管理 pre-commit、commit-msg、pre-push 和手动任务；
- 按实际文件范围运行 workspace 检查；
- 先保持等价语义，再安全地并行无写入任务；
- 处理本地环境覆盖和 hooks 安装边界。

Lefthook 不替代 commitlint、oxfmt、oxlint、tsc-files 或测试，只负责编排已有检查。

## 当前实现

```text
git commit
  |
  +-- .husky/pre-commit
  |     +-- pnpm exec lint-staged
  |     \`-- pnpm run format:check       # 全 workspace
  |
  \`-- .husky/commit-msg
        \`-- pnpm exec commitlint --edit "$1"
```

根目录 package.json 的 lint-staged 实际有 9 条 workspace/type-check 规则：

| 范围                   | 当前检查                 |
| ---------------------- | ------------------------ |
| frontend/core          | oxfmt、oxlint、tsc-files |
| frontend/main          | tsc-files                |
| frontend/dashboard     | tsc-files                |
| frontend/landing       | tsc-files                |
| frontend/inspire-me    | tsc-files                |
| local/dev-hub          | workspace type-check     |
| backend/auth           | tsc-files                |
| infra/gateway          | tsc-files                |
| backend/content-import | tsc-files                |

多个 workspace 也有自己的 lint-staged 配置，但不能因为配置文件存在就认为它实际生效。迁移前必须用 pnpm exec lint-staged --debug 确认根目录调用到底加载了哪些配置。

## 关键语义边界

### glob 不会自动过滤 staged_files 参数

Lefthook 的 glob 首先决定 job 是否触发，不能把它等同于 lint-staged 的“按 glob 过滤后传参”。staged_files 表示待提交的 staged 文件集合。

因此下面这种写法不能作为等价迁移：

```yaml
type-check-core:
  glob: 'frontend/core/**/*.{ts,tsx}'
  run: pnpm exec tsc-files ... {staged_files}
```

如果同时 staged frontend/core/a.ts 和 infra/gateway/b.ts，不能假设 type-check-core 只收到 a.ts。

要复刻 lint-staged 语义，应使用 files: 命令生成经过目录和扩展名过滤的列表，再传给 files 模板：

```yaml
type-check-core:
  files: node scripts/lefthook-files.mjs frontend/core ts tsx
  run: pnpm exec tsc-files --noEmit --project frontend/core/tsconfig.app.json frontend/core/global.d.ts {files}
```

这里的脚本只是适配层示例，迁移时必须实际实现并测试。它需要正确处理空列表、空格、换行和特殊文件名。Lefthook 官方将 files 定义为生成 files 模板内容的自定义命令：[files 配置](https://lefthook.dev/configuration/files/)、[run 模板](https://lefthook.dev/configuration/run/)。

适配器不会自动收到 Lefthook 的 staged 文件列表，必须自行读取 Git，例如使用 git diff --cached --name-only --diff-filter=ACM，再按 workspace 和扩展名过滤。它的输出才会成为 {files} 的参数来源。

### --fix 与 type-check 第一阶段必须串行

oxfmt 和 oxlint --fix 会修改文件，tsc-files 会读取文件。第一阶段不应配置 pre-commit parallel: true，否则可能产生写读竞态。

推荐顺序：

```text
format/lint --fix
       |
       +-- stage_fixed（经过验证后启用）
       |
       \-- type-check
```

只有等价迁移和串行行为验证通过后，才评估无写入 job 的并行化。Lefthook 默认串行，parallel: true 是显式开启的。[parallel 配置](https://lefthook.dev/configuration/parallel/)

### 现有 Markdown glob 的范围问题

当前根规则 `*.{json,md}` 只覆盖仓库根目录文件，不会覆盖 docs/tools/lefthook.md 这种嵌套路径。这是现有 lint-staged 的既有行为。本次迁移已明确选择修复范围：适配器 scope `.` 会覆盖全仓 JSON/Markdown，并将其作为有意的行为变化接受。

## 配置设计

在完成逐条等价迁移前，不提供一份看似完整的 YAML。第一阶段至少需要建立以下适配层：

```yaml
pre-commit:
  # 第一阶段不启用 parallel: true
  jobs:
    - name: format frontend
      files: node scripts/lefthook-files.mjs frontend js jsx ts tsx
      run: pnpm exec oxfmt -c frontend/core/config/oxfmt.json {files}
      stage_fixed: true

    - name: lint frontend
      files: node scripts/lefthook-files.mjs frontend js jsx ts tsx
      run: pnpm exec oxlint -c frontend/core/config/oxlint.json --fix --threads=1 {files}
      stage_fixed: true

    - name: type-check core
      files: node scripts/lefthook-files.mjs frontend/core ts tsx
      run: pnpm exec tsc-files --noEmit --project frontend/core/tsconfig.app.json frontend/core/global.d.ts {files}

commit-msg:
  jobs:
    - name: commitlint
      run: pnpm exec commitlint --edit {1}
```

这不是最终可复制配置。以下 9 条 workspace/type-check 规则，以及 1 条根目录格式规则，必须逐条建立映射，不得遗漏：

- root `*.{json,md}` 格式规则：迁移后修复为全仓 JSON/Markdown 检查，等价于 `**/*.{json,md}`
- frontend/core
- frontend/main
- frontend/dashboard
- frontend/landing
- frontend/inspire-me
- local/dev-hub
- backend/auth
- infra/gateway
- backend/content-import

stage_fixed 可以减少 formatter 修复后的手动操作。配置 files: 时，Lefthook stage 的是 files 命令输出的整个匹配 staged 文件集合；它不会精确到 formatter 实际修改的文件，因此仍必须审计 staged diff。

## 迁移步骤

### 1. 盘点实际生效行为

- 记录根目录 lint-staged 的 9 条规则；
- 执行 pnpm exec lint-staged --debug，确认 workspace package.json 配置是否实际加载；
- 记录 .husky/pre-commit 和 .husky/commit-msg 的实际命令；
- 建立“实际生效 glob -> 检查命令 -> Lefthook files 适配器”的迁移表；
- 记录现有 `*.{json,md}` 的根目录限制，并确认迁移后有意修复为全仓范围；
- 保留 Husky，直到新旧行为等价验证完成。

### 2. 引入 Lefthook

官方当前 Node 安装文档推荐锁定无 scope 的 lefthook npm 包：

```sh
pnpm add -D lefthook
```

@evilmartians/lefthook 当前属于 legacy 包，不作为新迁移的默认选择。[官方安装文档](https://lefthook.dev/installation/node/)

增加根目录 lefthook.yml。迁移前的 .yarnrc.yml 曾启用 enableScripts: true；使用官方 lefthook npm 包时，其 postinstall 会自动执行 lefthook install。根目录可以整体移除现有 postinstall: husky，避免再维护一份重复的安装命令，且不能让 Husky 和 Lefthook 同时接管 hooks。

暂时不删除 Husky 或现有 lint-staged，先验证：

```sh
lefthook validate
lefthook run pre-commit
```

当前适配器方案没有可靠的单文件参数捷径。第 2 步应创建或选择一个临时文件，使用真实 git add，再显式运行 lefthook run pre-commit：

```sh
git add <temporary-file>
lefthook run pre-commit
```

此时 Lefthook 和 files 适配器都会从真实 Git index 读取 staged 文件；不要执行真实 git commit，因为 hooks 所有权仍在 Husky，core.hooksPath 还指向 .husky/_，真实 commit 触发的仍是旧 hook。完成第 3 步的 hooks 所有权切换后，再使用真实 git commit 做最终 hook 冒烟测试。验证仍需覆盖跨 workspace staged 和部分 staged 场景。full-check 只有在 lefthook.yml 明确定义后才能运行。

### 3. 切换 hooks 所有权

当前 Git 配置实际为：

```text
core.hooksPath=.husky/_
```

Lefthook 接管前必须处理它：

```sh
git config --unset core.hooksPath
```

确认新 hooks 已生效后，再删除 .husky/pre-commit、.husky/commit-msg、postinstall: husky、仅服务于旧 hooks 的依赖和脚本，以及已确认不再生效的 workspace lint-staged 配置。

## 本地 hooks 与 CI 的边界

完成迁移后，Husky 只应从本地 hooks 链路中移除，CI 不需要改成运行 Lefthook。

当前 CI 没有直接调用 Husky 或 lint-staged，workflow 已经直接运行 format:check、lint、type-check、test 和 build。这些检查应继续保留，因为 CI 需要执行完整、确定性的验证，不应依赖开发者是否安装了本地 hooks。

迁移后的职责边界如下：

```text
本地：git commit/push -> Lefthook -> staged/focused checks
CI：   workflow    -> pnpm run format:check / lint / type-check / test / build
```

CI 侧需要确认：

- 移除 Husky 后，依赖安装不再执行 postinstall: husky；
- Lefthook npm 包即使在 CI 安装 hooks，也不会影响 CI 结果；CI 不执行 commit，因此这类安装可以忽略；
- 不用 lefthook run pre-commit 替代现有的全仓 CI 检查；
- 可选增加 lefthook validate，验证 lefthook.yml 语法，但它不能替代 format、lint、type-check、test 或 build。

## 验证矩阵

| 场景                                  | 预期结果                                           |
| ------------------------------------- | -------------------------------------------------- |
| 只 staged frontend/core/a.ts          | 只触发 core 相关 job，并只传 core 文件             |
| 只 staged infra/gateway/b.ts          | 只触发 gateway 相关 job，并只传 gateway 文件       |
| 同时 staged core/a.ts 和 gateway/b.ts | 两个 job 都触发，但每个 job 只收到自己的文件       |
| 只 staged docs/tools/lefthook.md      | 触发全仓 JSON/Markdown job，并只传入该 staged 文件 |
| staged 文件之外存在格式错误           | pre-commit 不因该文件失败；CI/full-check 仍可发现  |
| formatter 产生修改                    | stage_fixed 行为可见，且不 stage 无关文件          |
| commit message 不符合规则             | commit-msg 失败，commit 不生成                     |
| 新 clone 后安装依赖                   | hooks 可被正确安装                                 |
| core.hooksPath 残留                   | 必须判定为迁移失败                                 |
| --fix 与 type-check 并存              | 第一阶段串行；后续并行前证明无写读竞争             |

每次验证后检查：

```sh
git diff --check
git diff --cached --check
git status --short
```

dirty worktree 中还要确认 hooks 没有修改、暂存或覆盖不属于当前任务的文件。

## 回滚方案

1. 恢复 .husky/pre-commit 和 .husky/commit-msg；
2. 恢复 Husky/lint-staged 的 package 与 lockfile 依赖；
3. 恢复 core.hooksPath=.husky/_；
4. 恢复 postinstall: husky，并执行 pnpm install 重新安装 Husky hooks；
5. 暂停 Lefthook 接管 Git hooks，但可以保留 lefthook.yml 作为迁移草案；
6. 用验证矩阵记录差异，再决定修正配置还是放弃迁移。

不要删除整个 .git/hooks 或 .git 目录，只处理项目明确管理的 hook 入口。

## 最终建议

分三步落地：

1. 按实际生效的 lint-staged 规则逐条等价迁移，先解决文件过滤、hooksPath 和 staged 修复问题；
2. 等价验证通过后，把全仓 pnpm run format:check 从默认 pre-commit 移出，改为 full-check 和 CI；
3. 最后再评估无写入 job 的并行化。

第二步才是这次迁移对项目最有价值的改进，但不能和第一步混在一起验证。

参考：

- [Lefthook 官方仓库与 README](https://github.com/evilmartians/lefthook)
- [Lefthook 文件列表配置](https://lefthook.dev/configuration/files/)
- [Lefthook 运行模板](https://lefthook.dev/configuration/run/)
- [Lefthook 并行配置](https://lefthook.dev/configuration/parallel/)
- [Lefthook Node 安装文档](https://lefthook.dev/installation/node/)
