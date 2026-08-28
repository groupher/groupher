# Yarn 到 pnpm 迁移方案

> 状态：pnpm 12 升级已实施；本地验收通过，待 CI 与 Press Docker 验收
> 制定日期：2026-08-28
> 当前基线：Node.js 24、Yarn 4.17.1
> 目标版本：pnpm 12.0.0

## 1. 背景

Groupher 当前使用 Yarn 4 管理一个 Node.js monorepo。根目录通过五组 glob 管理 19 个子 workspace：

```text
backend/*
infra/*
frontend/*
local/*
packages/*
```

当前 Yarn 已经深入以下执行路径：

- 根目录 `package.json` 中的开发、构建、检查和清理脚本；
- 6 个子 workspace 的 `package.json` 脚本；
- `Makefile` 和 `lefthook.yml`；
- 18 个 GitHub Actions workflow；
- `backend/press/Dockerfile`；
- 少量脚本、忽略配置和维护文档；
- `yarn.lock`、`.yarnrc.yml` 和仓库内置的 Yarn release。

迁移后的配置使用 pnpm 原生的 `nodeLinker: isolated`，依赖通过根目录 `node_modules/.pnpm` 虚拟仓库和各 workspace 的符号链接提供。workspace 本地依赖会按 manifest 建立链接，未声明的传递依赖不再稳定地因为提升而可见；本次验证已经暴露并修复了这类问题。因此，本次迁移不能只替换 lockfile 和命令名称，还必须验证 workspace 链接、依赖声明、生命周期脚本、CI 缓存和 Docker 安装结果。

迁移前根 `package.json` 曾保留 `packageManagerConfig.hoistingLimits`，其中记录了 `@radix-ui/*`、`shadcn` 和 `@groupher/editor` 的 workspace 隔离意图。该字段来自旧 Yarn 1 `workspaces.nohoist` 配置，但当前 Yarn 4 不识别它；当时实际生效的 `nmHoistingLimits` 是 `none`。该历史字段已删除，不能被视为当前安装布局已经满足的约束。

Groupher 源码和 workspace manifest 当前没有直接引用 `@radix-ui/*`。Radix 由外部依赖 `@groupher/rich-editor@0.0.35` 引入，编辑器直接依赖 6 个 Radix package；旧配置中的 `@groupher/editor` 也不是当前 package 名称。因此，迁移需要验证的是 Rich Editor 依赖链和编辑器功能，而不是给 Groupher workspace 建立新的 Radix 直接依赖或长期布局约束。

### 本次实施记录（2026-08-28）

- 已完成根配置、workspace manifest、内部依赖、脚本、本地入口、CI workflow、Press Dockerfile 和当前运维文档的 pnpm 改造。
- 基础迁移阶段已生成 `pnpm-lock.yaml`，并用 pnpm 11.24.0 连续两次执行冻结安装；`check:router-runtime`、type-check、lint、format、test 和 `build:ci` 已通过，保留原有 warning 作为非阻断项。该结果是 pnpm 12 升级前的基线，不代表当前升级已完成。
- 已在干净副本使用 `nodeLinker: isolated` 执行冻结安装；补齐根同步脚本的 `sharp`、`frontend/core` 的 Tooltip/Share/GraphQL/表格/日期依赖，以及各应用缺失的 GraphQL 和 Node 类型直接依赖后，type-check、lint、format、test、资源同步和 `build:ci` 均通过。
- 已完成 `frontend/core` 的直接依赖审计：源码和测试/配置实际使用的外部 package 已分别声明在该 workspace 的 `dependencies` 或 `devDependencies`，不再依赖根目录对这些 package 的兜底可见性。
- 8 个 Worker dry-run 入口（Apply、Community、Dash、Landing、Inspire Me、Assets Hub、Auth、Edge Router）均完成 bundle、配置读取和 `--dry-run: exiting now.` 验证。
- 基础迁移阶段实测发现 pnpm 11 的构建脚本审批是必需项；现已只允许 `lefthook` 执行，并将 `@swc/core`、`cbor-extract`、`esbuild`、`tsparticles-engine` 和 `workerd` 明确设为不执行。pnpm 12 升级沿用这份最小审批清单，并重新验证安装结果。
- Assets Hub 已补齐自身的 `wrangler` devDependency，避免依赖 root hoisting。
- 对比迁移前 Yarn 基线后，已审查关键解析差异并决定以当前 pnpm lockfile 作为新基线：`@radix-ui/react-slot` 为 `1.2.4 → 1.3.3`，`vite` 为 `8.0.10/8.2.0 → 8.2.2`，`wrangler` 为 `4.118.0 → 4.126.0`；这些差异均满足当前 manifest 的 semver 范围，且完整检查和 CI 已通过。后续依赖升级仍以 `pnpm-lock.yaml` 的显式变更为准，不再把 Yarn 的旧 resolved version 当作隐式约束。
- 基础迁移阶段的 `pnpm peers check` 曾报告 `tsconfck@3.1.6` 与仓库 TypeScript `7.0.2` 的过时 peer 范围差异；本次已移除 `vite-tsconfig-paths` 及其传递依赖，shared Vitest config 改用 Vite 原生 `resolve.tsconfigPaths`。随后补齐 Apply、Landing、Inspire Me 对 `@tanstack/react-query` 的直接依赖，并在锁文件中固定 React peer variant；当前 `pnpm peers check` 已无未满足 peer。
- 已启用 `injectWorkspacePackages`；Press 使用不带 `--legacy` 的 `pnpm deploy` 生成生产目录，实测产物中的 workspace 依赖和相对链接均留在 deploy 目录内。
- 当前机器没有 Docker CLI，因此 Press 镜像构建和 runtime health smoke 尚未在本地完成；CI 的 Press 构建已通过。`isPlatformHost` 的相邻 JSDoc 已补齐，`docs:check` 已通过。
- pnpm 12 升级已实施：根 `packageManager` 固定为 `pnpm@12.0.0`，GitHub Actions 改用官方原生 `pnpm/setup@v1`，并移除 CI、Makefile 与 Press Dockerfile 对 Corepack 的依赖；本地 pnpm 12 冻结安装、全仓 type-check、测试、构建、Worker dry-run 和 `docs:check` 均通过，Press Docker 和远端 CI 验收仍待完成。
- pnpm 12 的 `packageManager` 自举信息默认会形成 lockfile 的额外 YAML 文档；为避免 GitHub dependency graph、Dependabot 或 SBOM 单文档读取器误判依赖为空，已设置 `pmOnFail: ignore`，并由 CI、Docker 和本地安装说明显式提供精确的 pnpm 12.0.0。
- `infra/dev-gateway` 与 `infra/edge-router` 已移除直接的 `typescript@5.9.3`，统一使用仓库的 `typescript@7.0.2`；全仓 type-check、两个 workspace 测试、dev-gateway 构建和 edge-router Worker dry-run 均通过。锁文件中仍保留 `5.9.3` 的传递实例，来源是旧版 Commitlint/React Doctor 工具链，不是任何 workspace 的直接 TypeScript 版本要求。

## 2. 为什么选择 pnpm

本项目继续以 Node.js 24 作为本地、CI 和服务端构建环境；Cloudflare Workers 的生产运行时仍然是 `workerd`。迁移到 pnpm 只改变依赖安装和 workspace 命令，不改变应用运行时。

选择 pnpm 的主要原因：

- 原生支持 monorepo、workspace 过滤和递归任务；
- 内容寻址存储可以减少多 workspace 的重复依赖和磁盘占用；
- `workspace:` 协议可以保证内部依赖始终链接到本仓库 package；
- 依赖布局比传统提升模式更容易暴露未声明依赖；
- Node.js、Vite、Wrangler、Vitest 和现有 Cloudflare Workers 工具链均可继续使用；
- 相比 Bun，不引入新的生产运行时语义和兼容性变量。

## 3. 目标与非目标

### 3.1 本次迁移目标

- 使用 pnpm 作为仓库唯一的 JavaScript 包管理器；
- 使用单一的 `pnpm-lock.yaml` 保证本地、CI 和 Docker 可复现安装；
- 保持现有 19 个子 workspace 的边界和 package 名称不变；
- 所有内部 workspace 依赖明确使用 `workspace:` 协议；
- 所有开发、检查、构建、测试和部署命令保持原有行为；
- GitHub Actions、Cloudflare Workers dry-run 和 Press Docker 构建全部通过；
- 不保留可被误用的 Yarn 执行入口或双 lockfile 状态。

### 3.2 本次迁移不包含

- 不迁移到 Bun 或 Deno 运行时；
- 不同时引入 Nx、Turborepo、Rush 或 Lerna；
- 不调整 workspace 目录结构和 package 命名；
- 不借机升级全部业务依赖；
- 不改变应用功能、部署拓扑或 Cloudflare Workers compatibility 配置；
- 本次在同一个迁移 PR 内完成 `isolated` 依赖布局切换，并以完整 CI 作为合并门槛。

## 4. 当前影响范围

| 范围            | 当前情况                                                   | 迁移动作                                                |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| 根配置          | `packageManager: pnpm@12.0.0`（升级进行中）                | 固定 pnpm 12.0.0 并完成全环境验证                       |
| workspace 定义  | 根 `package.json` 的 5 组 glob                             | 迁移到 `pnpm-workspace.yaml`                            |
| 内部依赖        | 24 条内部依赖使用普通 `1.0.0`                              | 改为 `workspace:*`                                      |
| lockfile        | `yarn.lock`                                                | 生成并提交 `pnpm-lock.yaml`                             |
| Yarn 配置       | `.yarnrc.yml`、`.yarn/releases/*`                          | 最终删除                                                |
| 历史提升配置    | `packageManagerConfig.hoistingLimits` 当前不被 Yarn 4 识别 | 记录实际解析基线后删除，不直接翻译为全局 workspace 隔离 |
| 根脚本          | 大量 `yarn workspace` 和 `workspaces foreach`              | 改为 `pnpm --filter` 和 `pnpm --recursive`              |
| 子 package 脚本 | 6 个子 workspace 显式调用 Yarn                             | 改为 `pnpm run`、`pnpm exec` 或 `pnpm --dir`            |
| 二进制调用      | 多个脚本访问 `../../node_modules/.bin/*`                   | 改为 package 内的 `pnpm exec`                           |
| 本地入口        | `Makefile`、`lefthook.yml`                                 | 改为 pnpm 命令                                          |
| CI              | workflow 使用 pnpm 安装，当前升级到 pnpm 12                | 使用 `pnpm/setup@v1` 提供 pnpm 12，并保留冻结安装       |
| Docker          | Press 镜像复制 Yarn 文件并执行 Yarn                        | 改为 pnpm 的过滤安装、构建和 portable deploy            |
| 构建脚本审批    | `lefthook` 需要构建脚本，其他观察到的包明确拒绝            | `pnpm-workspace.yaml` 提交显式 `allowBuilds`            |

已知会执行安装脚本的依赖包括 `esbuild`、`@swc/core`、`cbor-extract`、`lefthook`、`tsparticles-engine` 和 `workerd`。当前 `allowBuilds` 只批准 `lefthook`；其余包明确拒绝执行脚本。后续若 pnpm 报告新的待审批脚本，必须逐项审查后再提交配置。

## 5. 目标配置

### 5.1 根 packageManager

当前根 `package.json` 已调整为：

```json
{
  "packageManager": "pnpm@12.0.0"
}
```

版本必须固定，不使用 `latest` 或宽松范围。pnpm 12 已稳定发布，但 npm 的 `latest` 标签可能仍指向 pnpm 11，因此项目必须继续使用精确版本 `12.0.0`。

### 5.2 pnpm-workspace.yaml

当前使用以下基础结构：

```yaml
packages:
  - 'backend/*'
  - 'infra/*'
  - 'frontend/*'
  - 'local/*'
  - 'packages/*'

# 使用 pnpm 原生的符号链接和虚拟仓库布局，减少 workspace 间的隐式依赖可见性。
nodeLinker: isolated

# 让 workspace 依赖以 injected 方式进入 deploy 产物，避免 Docker 搬迁相对链接。
injectWorkspacePackages: true

strictDepBuilds: true

# 由 CI、Docker 和本地环境显式安装 pnpm 12，避免将 pnpm 自身的 bootstrap
# package 写入项目 lockfile，保持 lockfile 对下游工具的单文档兼容性。
pmOnFail: ignore

allowBuilds:
  '@swc/core': false
  cbor-extract: false
  esbuild: false
  lefthook: true
  tsparticles-engine: false
  workerd: false
```

pnpm 12 的项目设置应放在 `pnpm-workspace.yaml`；`.npmrc` 仅用于 registry 和认证相关配置。当前已显式设置 `nodeLinker: isolated`、`strictDepBuilds: true`，并提交最小执行面：`lefthook: true`；`@swc/core`、`cbor-extract`、`esbuild`、`tsparticles-engine` 和 `workerd` 均为 `false`。其中 `esbuild: false` 覆盖当前 lockfile 中的多个版本实例。

pnpm 没有 Yarn `workspaces.nohoist` 那种针对 package pattern 的直接等价物。`isolated` 通过符号链接和虚拟仓库实现 workspace 级依赖边界；如果未来有明确的工具需要提升，再使用最小范围的 `hoistPattern` 或 `publicHoistPattern`，并记录原因。不能通过全局 `shamefullyHoist` 绕过依赖声明。`injectWorkspacePackages` 用于让 workspace 依赖在部署目录中保持可搬运，不代替 workspace 自身的直接依赖声明。

`pmOnFail: ignore` 的代价是 pnpm 不会因为根 `packageManager` 字段自动下载或切换 pnpm 版本。开发者、CI 和 Docker 必须先显式提供 `pnpm@12.0.0`，再运行项目命令；如果本地版本不匹配，应先修正安装环境，而不是重新生成 lockfile。

### 5.3 内部依赖

所有本仓库 package 之间的依赖从普通版本改为 `workspace:*`：

```json
{
  "dependencies": {
    "@groupher/contracts": "workspace:*",
    "@groupher/service": "workspace:*"
  }
}
```

这可以避免 pnpm 在 workspace 版本匹配或链接设置变化时从 npm registry 获取同名包。当前内部 package 大多是 private；`@groupher/frontend-core` 若执行 pack/publish，必须额外验证 `workspace:*` 在产物 manifest 中被替换为预期版本。

## 6. 命令迁移规则

脚本中优先使用完整、无歧义的 pnpm 命令，不依赖简写。

| Yarn                                    | pnpm                                                               |
| --------------------------------------- | ------------------------------------------------------------------ |
| `yarn install --immutable`              | `pnpm install --frozen-lockfile`                                   |
| `yarn run <script>`                     | `pnpm run <script>`                                                |
| `yarn <script>`                         | `pnpm run <script>`                                                |
| `yarn <binary>`                         | `pnpm exec <binary>`                                               |
| `yarn workspace <name> <script>`        | `pnpm --filter <name> run <script>`                                |
| `yarn workspace <name> exec <binary>`   | `pnpm --filter <name> exec <binary>`                               |
| `yarn --cwd <dir> <command>`            | `pnpm --dir <dir> <command>`                                       |
| `yarn workspaces foreach -pt --all ...` | `pnpm --recursive --filter '!@groupher/root' --if-present run ...` |

额外规则：

- 将 `../../node_modules/.bin/tsc`、`oxlint`、`oxfmt`、`vitest` 等改为 workspace 自身的 `pnpm exec <binary>`；
- 如果 workspace 没有声明所调用的 CLI，先在该 workspace 增加对应 `devDependency`；
- 将 `npm exec --yes wrangler -- ...` 统一为 workspace 内的 `pnpm exec wrangler ...`，并确认 `wrangler` 已声明；
- package 脚本内部调用同 package 的脚本时使用 `pnpm run <script>`；
- 从子目录调用根脚本时使用 `pnpm --dir ../.. run <script>`；
- 不在业务脚本中写死 pnpm store 或 `.pnpm` 内部路径。

## 7. 具体迁移步骤

### 阶段 0：记录 Yarn 基线

迁移前必须在干净工作区记录当前 Yarn 基线，避免将已有失败误判为 pnpm 回归。

```bash
corepack enable
yarn install --immutable
yarn type-check
yarn lint
yarn format:check
yarn test
yarn build:ci
```

同时记录以下定向结果：

- `yarn workspace @groupher/press test`；
- `yarn workspace @groupher/edge-router test`；
- Worker package 的 deploy dry-run；
- `docker build -f backend/press/Dockerfile .`；
- 当前已知的 peer dependency warning 和非阻断 warning。

在删除 Yarn 安装结果前，还要生成一份依赖解析基线。基线至少包含：

- 所有 workspace 直接依赖的 package name、range 和实际 resolved version；
- 所有存在多个 resolved version 的外部 package；
- `react`、`react-dom`、`vite`、`wrangler`、`typescript` 和带安装脚本的依赖；
- `@groupher/rich-editor` 及其 `@radix-ui/*` 依赖的实际版本集合；
- 关键 package 的 peer context 和从消费方入口得到的实际 resolve 结果。

这份基线应由可重复执行的脚本生成，并分别保存 Yarn 和 pnpm 的机器可读结果用于 diff。文件系统路径会因包管理器布局不同而变化，不应直接比较绝对路径；比较对象是 package identity、version、peer context 和消费方最终解析到的 package。

如果基线本身失败，应先记录失败命令、错误和是否与本次迁移无关。迁移验收要求“不新增失败”，不应通过忽略错误来制造绿色结果。

### 阶段 1：建立 pnpm workspace 和 lockfile

1. 新增 `pnpm-workspace.yaml`，完整复制当前五组 workspace glob。
2. 将根 `packageManager` 改为固定的 pnpm 版本。
3. 将 `packageManagerConfig.hoistingLimits` 作为无效 Yarn 历史配置删除；迁移记录中保留它的来源和实际验证结果。
4. 将 24 条内部 workspace 依赖改为 `workspace:*`。
5. 在 `pnpm-workspace.yaml` 中显式设置 `nodeLinker: isolated`，不把 Yarn 的历史提升配置翻译成 pnpm 全局配置。
6. 在保留 `yarn.lock` 的临时迁移状态下执行：

   ```bash
   pnpm import
   ```

7. 检查生成的 `pnpm-lock.yaml` 是否包含根 package 和全部 19 个子 workspace importer。
8. 执行首次安装并审查安装脚本。启用 `strictDepBuilds` 时，如果尚未提交 `allowBuilds`，首次安装可能以 `ERR_PNPM_IGNORED_BUILDS` 结束；此时只针对输出的 package 审批，不要用关闭脚本检查来绕过问题：

   ```bash
   pnpm install
   pnpm approve-builds
   pnpm install --frozen-lockfile
   ```

9. 将审批结果作为 `allowBuilds` 提交到 `pnpm-workspace.yaml`；当前仅允许 `lefthook`，其余已观察到的构建脚本包明确设为 `false`。
10. 确认第二次 `pnpm install --frozen-lockfile` 不修改 lockfile 或配置。
11. 生成 pnpm 依赖解析快照，并和阶段 0 的 Yarn 快照比较；所有版本变化必须在进入脚本迁移前完成审查。

`pnpm import` 只是生成初始 lockfile 的手段，且本项目的初始导入已经完成。pnpm 12 升级不应重新从 Yarn 导入或重建 lockfile；应直接使用现有 `pnpm-lock.yaml` 执行冻结安装。最终 lockfile 必须通过完整安装、测试和构建验证，不能因为导入命令成功就视为等价。

### 阶段 2：迁移 package 脚本和本地入口

按以下顺序修改并验证：

1. 根 `package.json`：
   - 替换所有 `yarn workspace`；
   - 替换所有 `yarn workspaces foreach`；
   - 替换 package 脚本之间的 `yarn <script>` 调用。
2. 子 workspace 的 `package.json`：
   - `backend/assets-hub`；
   - `frontend/apply`；
   - `frontend/community`；
   - `frontend/dash`；
   - `frontend/inspire-me`；
   - `frontend/landing`。
3. 全部 workspace：
   - 清理 `../../node_modules/.bin/*`；
   - 将 CLI 补充到实际使用它的 workspace 的 `devDependencies`；
   - 验证脚本从仓库根目录和 package 目录执行时行为一致。
4. 修改 `Makefile`、`lefthook.yml` 和 `scripts/check-router-runtime.mjs`。
5. 更新 `.agignore` 和其他包含 Yarn 专属路径的忽略规则。

每完成一类改动，至少执行对应的 `type-check`、`lint` 或 `build`，不要等全部替换后再集中定位问题。

### 阶段 3：修复依赖边界

当前使用 `nodeLinker: isolated`，因此 pnpm 安装和运行时会直接暴露缺失依赖：

1. 从每个失败命令定位实际 import 所属 workspace；
2. 将运行时 import 加入该 workspace 的 `dependencies`；
3. 将只在构建、测试和检查中使用的工具加入 `devDependencies`；
4. peer dependency 仅用于表达宿主必须提供的契约，不能用来掩盖普通运行时依赖；
5. 不通过把缺失依赖全部放回根 package 来绕过 workspace 边界；
6. 每次增加依赖后更新 lockfile，并运行受影响 workspace 的检查。

迁移 PR 中不要顺便升级依赖主版本。缺失声明与版本升级应分开处理。

`@radix-ui/*` 在这里属于 `@groupher/rich-editor` 的传递依赖边界。Groupher 不应为了固定 Radix 布局而增加并未直接使用的依赖。迁移时应比较 Rich Editor 依赖链中的 Radix package identity 和版本集合，并运行编辑器相关构建与交互测试。如果 pnpm 的解析结果发生变化，先确认是否是 lockfile 导入或 peer context 差异；只有实际行为受到影响时，才引入最小范围的 pnpm 提升配置或版本约束。

### 阶段 4：迁移 GitHub Actions

逐一更新 18 个 workflow：

- 路径触发条件中的 `yarn.lock` 改为 `pnpm-lock.yaml`；
- 删除 `.yarn/**` 相关触发条件；
- `actions/setup-node` 的缓存类型改为 `pnpm`；
- `cache-dependency-path` 改为 `pnpm-lock.yaml`；
- 保留 Node.js 24；
- 使用官方 `pnpm/setup@v1` 安装根 `packageManager` 固定的 pnpm 版本，并设置 `install: false`，因为 workflow 后面已有显式冻结安装；
- 删除 `corepack enable`；没有 `pnpm/action-setup` 的 E2E 和 Landing workflow 也必须增加 `pnpm/setup@v1`；
- `yarn install --immutable` 改为 `pnpm install --frozen-lockfile`；
- workspace 命令按第 6 节规则转换；
- 自定义缓存 key 中的 `hashFiles('yarn.lock', ...)` 改为 `hashFiles('pnpm-lock.yaml', ...)`。

CI 中不能使用非冻结安装，也不能在 job 内自动修改 lockfile。所有矩阵中的 workspace filter 必须在无匹配时失败，避免 package 改名后 job 静默跳过。

### 阶段 5：迁移 Press Docker 构建

Press Dockerfile 当前只复制 Press、Service 和 Contracts 的 manifest，并安装缩减后的 workspace 图。迁移时保持这一边界：

1. 复制 `package.json`、`pnpm-workspace.yaml` 和 `pnpm-lock.yaml`；
2. 不再复制 `.yarnrc.yml`、`.yarn` 或 `yarn.lock`；
3. 继续提前复制以下 manifest 以利用 Docker layer cache：
   - `backend/press/package.json`；
   - `packages/service/package.json`；
   - `packages/contracts/package.json`；
4. 在 Node.js 24 镜像内安装精确版本 `pnpm@12.0.0`，并用 `pnpm --version` 断言版本；不要使用 `corepack enable` 或 `corepack pnpm`；
5. 使用 `pnpm --filter @groupher/press... install --frozen-lockfile` 安装 Press 及其 workspace 依赖；
6. 使用 `pnpm --filter @groupher/press run build` 构建；
7. 启用 `injectWorkspacePackages`，使用 `pnpm --filter @groupher/press --prod deploy /app/deploy` 生成可搬运的生产目录；
8. runtime image 只复制 `/app/deploy`，不复制 build 阶段的 root `node_modules` 或原始 workspace 目录，避免相对 symlink 因目录搬迁失效。

当前已启用 `injectWorkspacePackages`，因此不再需要 `--legacy`。必须确认 deploy 目录内的 workspace package、生产依赖和相对链接都能在 runtime 镜像中解析；不能直接复制 build 阶段原始 workspace 的 `node_modules`。

### 阶段 6：删除 Yarn 并完成仓库清理

只有在本地核心检查、Worker dry-run 和 Press Docker 构建通过后，才删除：

```text
yarn.lock
.yarnrc.yml
.yarn/releases/yarn-4.17.1.cjs
```

随后更新 `.gitignore`，移除 Yarn Berry 专属规则，并检查仓库中的残留：

```bash
rg -n '\byarn\b|yarn\.lock|\.yarn/' \
  --glob '!docs/yarn_to_pnpm.md' \
  --glob '!CHANGELOG*'
```

所有具有执行意义的 Yarn 引用都必须清除。历史说明如果需要保留，必须明确标注为历史上下文，不能继续给出可复制执行的 Yarn 命令。

### 阶段 7：isolated 布局验收

本阶段已作为当前 pnpm 迁移 PR 的后续 commit 执行，不另开 PR。验收重点是确认 pnpm 原生布局不依赖传递包的根目录提升：

1. 将 `nodeLinker` 设置为 `isolated`；
2. 在干净安装环境运行完整验收矩阵；
3. 修复所有未声明依赖、写死根 `node_modules` 路径和不兼容工具；本次复核已补齐 `sharp`、Tooltip/Share/GraphQL 等实际直接依赖，并修正 GraphQL 泛型和 TanStack Table 模块增强的类型边界；
4. 验证根 package 直接声明的 `commitizen` 和 `cz-conventional-changelog` 仍可通过现有 `config.commitizen.path` 正确加载；
5. Worker dry-run、Press Docker 和所有 CI 通过后，才将本次 isolated 切换视为完成；
6. 如果某个工具确实要求提升，使用最小范围的 pnpm `hoistPattern` 或 `publicHoistPattern` 并记录原因，不启用全局 `shamefullyHoist`。

isolated 使用独立 commit，便于出现回归时单独回滚；它与本次迁移共用同一个 PR。

### 阶段 8：升级到 pnpm 12

pnpm 12 是 Rust 重写版本，除少数行为变化外，保留 pnpm 11 的命令、参数、设置和 lockfile 格式。升级重点是让所有安装入口使用 pnpm 12 的原生二进制，避免 Corepack 与 pnpm 12 的兼容性差异。

1. 将根 `package.json` 的 `packageManager` 固定为 `pnpm@12.0.0`；不使用 `pnpm@latest`、`pnpm@next-12` 或宽松范围。
   本地 Node.js 24 环境先执行：

   ```bash
   npm install --global pnpm@12.0.0
   pnpm --version
   ```

2. 在 `pnpm-workspace.yaml` 设置 `pmOnFail: ignore`。pnpm 版本由 CI、Docker 和本地环境显式安装，项目 lockfile 不记录 pnpm 自身的 bootstrap packages。
3. 将全部 `pnpm/action-setup@v4` 替换为 `pnpm/setup@v1`，设置 `install: false`，保留后续的 `pnpm install --frozen-lockfile`；该 action 会读取根 `packageManager` 并安装精确版本。
4. 为原先只执行 `corepack enable` 的 E2E、Landing 等 workflow 增加 `pnpm/setup@v1`，并删除 Corepack 步骤。
5. 将 Makefile 和 Press Dockerfile 中的 `corepack pnpm` 改为普通 `pnpm`；Docker build 阶段安装精确的 `pnpm@12.0.0` 并断言版本。
6. 在 Node.js 24 下使用 pnpm 12 执行冻结安装。不要为了升级重新执行 `pnpm import`；如发生 lockfile 差异，只接受可解释的 pnpm 12 peer/cycle 解析重键变化。
7. 检查仓库是否使用 pnpm 12 移除的 `--resolution-only` 参数；本项目当前没有该用法，应使用 `pnpm peers check`。
8. 运行完整的本地检查、Worker dry-run、Press Docker build/health 和 CI 矩阵，确认 pnpm 版本、构建脚本审批、workspace 链接和产物布局没有回归。

pnpm 12 官方说明现有 lockfile 可以直接用于 `--frozen-lockfile`；只有真正重新解析依赖时，循环依赖的 peer variant 才可能产生一次性 lockfile 差异。pnpm 12 还可能将自身 bootstrap 依赖写入 lockfile 的额外 YAML 文档，因此本项目明确使用 `pmOnFail: ignore`，并要求验收 lockfile 仍为单一业务依赖文档。升级前后必须审查差异，不能用重新导入 Yarn lockfile 的方式掩盖它。

## 8. 验收标准

### 8.1 配置和仓库状态

- [x] 根 `packageManager` 固定为 `pnpm@12.0.0`；
- [x] `pnpm-workspace.yaml` 包含全部五组 workspace glob；
- [x] `pnpm-workspace.yaml` 显式配置 `nodeLinker: isolated`；
- [x] `pnpm-workspace.yaml` 显式配置 `injectWorkspacePackages: true`；
- [x] `pnpm-lock.yaml` 已提交且覆盖根 package 与 19 个子 workspace；
- [x] 24 条内部 package 依赖全部使用 `workspace:*`；
- [x] `allowBuilds` 已提交：仅允许 `lefthook`，其余已观察到的构建脚本包均明确设为 `false`；后续出现新脚本时必须逐项审查；
- [x] `yarn.lock`、`.yarnrc.yml` 和仓库内置 Yarn release 已删除；
- [x] 无效的 `packageManagerConfig.hoistingLimits` 已从根 `package.json` 删除；
- [x] 除本文历史说明外，不存在具有执行意义的 Yarn 引用；
- [x] 仓库中不存在同时生效的 Yarn 和 pnpm lockfile；
- [x] 没有新增与迁移无关的依赖升级或业务改动。

### 8.2 安装可复现性

以下命令必须在全新 clone 或清空依赖目录后的环境中通过：

```bash
pnpm --version
pnpm install --frozen-lockfile
pnpm install --frozen-lockfile
git diff --exit-code
```

验收结果：

- [x] 首次安装成功；
- [x] 第二次安装不修改 lockfile 或配置；
- [x] 没有未审查的依赖构建脚本；
- [x] 本地和 CI 使用相同 Node.js 与 pnpm 主版本；
- [x] pnpm 安装后的关键直接依赖版本已与 Yarn 基线比较并记录接受的差异；
- [x] 关键多版本 package、传递依赖和 peer context 的变化均已审查并记录；
- [ ] pnpm 12.0.0 在本地、CI 和 Press Docker build 阶段均被实际打印并确认；
- [x] 本地验证 `pmOnFail: ignore` 生效，`pnpm-lock.yaml` 不包含 pnpm 自身 bootstrap dependencies 的额外文档；CI 和 Docker 仍需在对应环境复核；
- [x] `pnpm import` 造成的 package 版本差异已审查，不再把旧 Yarn resolved version 作为隐式约束；
- [x] 内部 workspace 依赖解析到本仓库，而不是 npm registry。

### 8.3 静态检查、测试和构建

至少执行：

```bash
pnpm run check:router-runtime
pnpm run docs:check
pnpm run type-check
pnpm run lint
pnpm run format:check
pnpm run test
pnpm run build:ci
```

并验证主要服务和内部协议 package：

```bash
pnpm --filter @groupher/contracts test
pnpm --filter @groupher/route-contract test
pnpm --filter @groupher/artiment-publisher test
pnpm --filter @groupher/backend-auth test
pnpm --filter @groupher/backend-content-import test
pnpm --filter @groupher/press test
pnpm --filter @groupher/dev-gateway test
pnpm --filter @groupher/edge-router test
pnpm --filter @groupher/widget test
pnpm --filter @groupher/local-dev-hub test
```

验收结果：

- [x] Yarn 基线中通过的检查在 pnpm 下仍然通过（`docs:check` 已在补齐 `isPlatformHost` JSDoc 后通过）；
- [x] 没有因为缺失依赖或 CLI 不可见导致的失败；
- [x] 在 `nodeLinker: isolated` 下，本次验证涉及的 workspace 直接运行时/构建依赖均已写入自身 manifest，不依赖传递包的根目录提升；
- [x] 生成资产和代码生成结果与基线一致；
- [x] 构建没有产生未预期的 tracked file 变更；
- [x] peer dependency warning 已逐项判断；`pnpm peers check` 已无未满足 peer。
- [x] `@groupher/rich-editor` 依赖链中的 `@radix-ui/*` package identity 和版本集合与 Yarn 基线一致，或差异已经审查；
- [x] Groupher workspace 没有为了迁移而新增未直接使用的 `@radix-ui/*` 依赖；
- [x] Rich Editor 的编辑、静态渲染、diff 和相关构建路径通过现有测试或定向 smoke test；
- [ ] Commitizen 能按根 `config.commitizen.path` 加载 `cz-conventional-changelog`。

### 8.4 Cloudflare Workers

至少验证以下 workspace 的 dry-run：

- [ ] `@groupher/frontend-apply`；
- [ ] `@groupher/frontend-community`；
- [ ] `@groupher/frontend-dash`；
- [ ] `@groupher/frontend-landing`；
- [ ] `@groupher/inspire-me`；
- [ ] `@groupher/edge-router`；
- [ ] `@groupher/assets-hub`；
- [ ] `@groupher/backend-auth`（若当前部署路径启用）。

每个 dry-run 必须证明 Wrangler 可以完成依赖解析、bundle 和配置读取；不能只验证 Vite build。

### 8.5 Docker 和运行时

- [ ] `backend/press/Dockerfile` 可以从干净 Docker cache 构建；
- [ ] runtime image 不包含 Yarn release 和无关 workspace 源码；
- [ ] Press 进程可以启动；
- [ ] Press health endpoint 返回预期结果；
- [ ] runtime image 中 `@groupher/service` 和 `@groupher/contracts` 可正确解析；
- [ ] production dependencies 没有因为 pnpm symlink 或复制方式丢失。
- [x] runtime image 来自启用 `injectWorkspacePackages` 的 `pnpm deploy` 自包含目录，不依赖 build 阶段 workspace 的相对 symlink。

### 8.6 CI

- [ ] 18 个受影响 workflow 不再引用 Yarn；
- [ ] 所有 workflow 使用 `pnpm/setup@v1` 或等价的 pnpm 12 原生安装方式；
- [ ] workflow 和 Dockerfile 不再依赖 `corepack enable` 或 `corepack pnpm`；
- [ ] CI、Docker 和本地文档均提供显式的 pnpm 12.0.0 安装路径；
- [ ] pnpm store cache 可以命中；
- [ ] 所有 install 均使用 `--frozen-lockfile`；
- [ ] workflow path filter 和 cache key 使用 `pnpm-lock.yaml`；
- [ ] workspace matrix 中不存在静默跳过；
- [ ] build、lint、format、type-check、contract、E2E 和 deploy dry-run jobs 全部通过；
- [ ] 实际部署 job 在正式合并前至少通过一次受控环境验证。

## 9. 提交和实施顺序

建议在同一个迁移 PR 中按以下 commit 边界实施：

1. `chore(fe): add pnpm workspace and lockfile`
2. `chore(fe): migrate workspace scripts to pnpm`
3. `chore(fe): migrate CI and Docker to pnpm`
4. `chore(fe): remove Yarn artifacts`
5. `chore(fe/be): upgrade pnpm toolchain to 12`

每个 commit 都应能解释自身范围。最终 PR 不允许保留需要开发者猜测使用哪个包管理器的中间状态。

## 10. 回滚策略

- 合并前：保留迁移前 Yarn 基线结果；任何关键路径失败都停止删除 Yarn 文件的步骤；
- 合并后：如果出现无法快速修复的 CI、Docker 或生产构建回归，整体 revert 迁移 commits，恢复 `packageManager`、`yarn.lock`、`.yarnrc.yml` 和 Yarn release；
- 不通过同时维护 `yarn.lock` 与 `pnpm-lock.yaml` 作为长期回滚方案；
- pnpm store cache 不是源数据，回滚或故障排查时可以安全重建；
- isolated 切换使用独立 commit，因此可以单独回滚到已验收的 hoisted pnpm 状态。
- pnpm 12 升级应作为独立 commit 回滚；回滚时同时恢复 CI 原生安装 action、Docker pnpm 安装方式和根 `packageManager`。

## 11. 完成定义

满足以下条件后，才能宣布“已迁移到 pnpm”：

1. pnpm 是仓库唯一包管理器和唯一 lockfile 来源；
2. 所有环境使用经过固定的 pnpm 12.0.0，干净环境可执行冻结安装且不产生 diff；
3. 本地完整检查、Cloudflare Workers dry-run 和 Press Docker 构建通过；
4. 18 个 GitHub Actions workflow 全部完成迁移并通过；
5. 内部 workspace 均通过 `workspace:*` 链接；
6. 仓库不存在可执行的 Yarn 残留；
7. 迁移没有引入业务行为变化。

当前默认配置为 `nodeLinker: isolated`。只有在 isolated 安装、完整本地检查、Worker dry-run、Press Docker 和 PR CI 全部通过后，才能宣称 pnpm 迁移与依赖边界治理均已完成。

## 12. 参考资料

- [pnpm workspace](https://pnpm.io/workspaces)
- [pnpm settings](https://pnpm.io/settings)
- [pnpm node_modules and hoisting](https://pnpm.io/settings/node-modules)
- [pnpm import](https://pnpm.io/cli/import)
- [pnpm filtering](https://pnpm.io/filtering)
- [pnpm recursive commands](https://pnpm.io/cli/recursive)
- [pnpm approve-builds](https://pnpm.io/cli/approve-builds)
- [pnpm CI recipes](https://pnpm.io/continuous-integration)
- [pnpm 12 installation](https://pnpm.io/installation)
- [What's different in pnpm 12](https://pnpm.io/blog/whats-different-in-pnpm-12)
- [pnpm/setup GitHub Action](https://github.com/pnpm/setup)
