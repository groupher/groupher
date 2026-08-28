# Yarn 到 pnpm 迁移方案

> 状态：第一阶段已实施，待合并前复核
> 制定日期：2026-08-28
> 当前基线：Node.js 24、Yarn 4.17.1
> 目标版本：pnpm 11.24.0

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

当前配置使用 `nodeLinker: node-modules`。大量 workspace 脚本还直接访问根目录的 `../../node_modules/.bin/*`，部分 workspace 也依赖根目录提升后可见、但没有在自身 manifest 中声明的依赖。因此，本次迁移不能只替换 lockfile 和命令名称，还必须验证 workspace 链接、依赖声明、生命周期脚本、CI 缓存和 Docker 安装结果。

根 `package.json` 还保留了 `packageManagerConfig.hoistingLimits`，其中记录了 `@radix-ui/*`、`shadcn` 和 `@groupher/editor` 的 workspace 隔离意图。该字段来自旧 Yarn 1 `workspaces.nohoist` 配置，但当前 Yarn 4 不识别它；当前实际生效的 `nmHoistingLimits` 是 `none`。它应被视为需要调查和清理的历史配置，不能被视为当前安装布局已经满足的约束。

Groupher 源码和 workspace manifest 当前没有直接引用 `@radix-ui/*`。Radix 由外部依赖 `@groupher/rich-editor@0.0.35` 引入，编辑器直接依赖 6 个 Radix package；旧配置中的 `@groupher/editor` 也不是当前 package 名称。因此，迁移需要验证的是 Rich Editor 依赖链和编辑器功能，而不是给 Groupher workspace 建立新的 Radix 直接依赖或长期布局约束。

### 本次实施记录（2026-08-28）

- 已完成根配置、workspace manifest、内部依赖、脚本、本地入口、CI workflow、Press Dockerfile 和当前运维文档的 pnpm 改造。
- 已生成 `pnpm-lock.yaml`，并用 pnpm 11.24.0 连续两次执行冻结安装；`check:router-runtime`、type-check、lint、format、test 和 `build:ci` 已通过，保留原有 warning 作为非阻断项。
- 8 个 Worker dry-run 入口（Apply、Community、Dash、Landing、Inspire Me、Assets Hub、Auth、Edge Router）均完成 bundle、配置读取和 `--dry-run: exiting now.` 验证。
- 干净安装实测发现 pnpm 11 的构建脚本审批是必需项；现已只允许 `lefthook` 执行，并将 `@swc/core`、`cbor-extract`、`esbuild`、`tsparticles-engine` 和 `workerd` 明确设为不执行。
- Assets Hub 已补齐自身的 `wrangler` devDependency，避免未来切换 `isolated` 布局后依赖 root hoisting。
- 当前机器没有 Docker CLI，因此 Press 镜像构建和 runtime smoke 尚未完成；文档检查仍有迁移前已存在的 `frontend/community/src/server/public-path.ts:isPlatformHost` 缺少相邻 JSDoc 问题。
- pnpm 11 对 Yarn Berry v4 lockfile 的导入没有保持所有原始 resolved version；当前 lockfile 存在已识别但尚未逐项 pin/批准的版本漂移（例如部分 Radix、Vite、Wrangler）。因此“无依赖版本漂移”仍是合并前的独立复核门槛，不能仅因冻结安装通过就视为完成。

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
- 不要求第一阶段立即切换到 pnpm 的 `isolated` 依赖布局。

## 4. 当前影响范围

| 范围            | 当前情况                                                   | 迁移动作                                                |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| 根配置          | `packageManager: yarn@4.17.1`                              | 改为固定 pnpm 版本                                      |
| workspace 定义  | 根 `package.json` 的 5 组 glob                             | 迁移到 `pnpm-workspace.yaml`                            |
| 内部依赖        | 24 条内部依赖使用普通 `1.0.0`                              | 改为 `workspace:*`                                      |
| lockfile        | `yarn.lock`                                                | 生成并提交 `pnpm-lock.yaml`                             |
| Yarn 配置       | `.yarnrc.yml`、`.yarn/releases/*`                          | 最终删除                                                |
| 历史提升配置    | `packageManagerConfig.hoistingLimits` 当前不被 Yarn 4 识别 | 记录实际解析基线后删除，不直接翻译为全局 workspace 隔离 |
| 根脚本          | 大量 `yarn workspace` 和 `workspaces foreach`              | 改为 `pnpm --filter` 和 `pnpm --recursive`              |
| 子 package 脚本 | 6 个子 workspace 显式调用 Yarn                             | 改为 `pnpm run`、`pnpm exec` 或 `pnpm --dir`            |
| 二进制调用      | 多个脚本访问 `../../node_modules/.bin/*`                   | 改为 package 内的 `pnpm exec`                           |
| 本地入口        | `Makefile`、`lefthook.yml`                                 | 改为 pnpm 命令                                          |
| CI              | 18 个 workflow 使用 Yarn 安装或缓存                        | 改为 pnpm 安装、缓存和 lockfile 触发条件                |
| Docker          | Press 镜像复制 Yarn 文件并执行 Yarn                        | 改为 pnpm 的过滤安装、构建和 portable deploy            |
| 构建脚本审批    | `lefthook` 需要构建脚本，其他观察到的包明确拒绝            | `pnpm-workspace.yaml` 提交显式 `allowBuilds`            |

已知会执行安装脚本的依赖包括 `esbuild`、`@swc/core`、`cbor-extract`、`lefthook`、`tsparticles-engine` 和 `workerd`。当前 `allowBuilds` 只批准 `lefthook`；其余包明确拒绝执行脚本。后续若 pnpm 报告新的待审批脚本，必须逐项审查后再提交配置。

## 5. 目标配置

### 5.1 根 packageManager

当前根 `package.json` 已调整为：

```json
{
  "packageManager": "pnpm@11.24.0"
}
```

版本必须固定，不使用 `latest` 或宽松范围。若实施日期距离本文较远，应先确认 pnpm 11 的最新稳定补丁版本和 Node.js 24 兼容性，再更新本文和 `packageManager`。

### 5.2 pnpm-workspace.yaml

第一阶段使用以下基础结构：

```yaml
packages:
  - 'backend/*'
  - 'infra/*'
  - 'frontend/*'
  - 'local/*'
  - 'packages/*'

# 迁移期先保持接近现有 node_modules 的布局，降低一次性改动范围。
nodeLinker: hoisted

# 与当前 Yarn 4 实际生效的 nmHoistingLimits: none 对齐。
hoistingLimits: none

strictDepBuilds: true

allowBuilds:
  '@swc/core': false
  cbor-extract: false
  esbuild: false
  lefthook: true
  tsparticles-engine: false
  workerd: false
```

pnpm 11 的项目设置应放在 `pnpm-workspace.yaml`；`.npmrc` 仅用于 registry 和认证相关配置。当前已显式设置 `strictDepBuilds: true`，并提交最小执行面：`lefthook: true`；`@swc/core`、`cbor-extract`、`esbuild`、`tsparticles-engine` 和 `workerd` 均为 `false`。其中 `esbuild: false` 覆盖当前 lockfile 中的多个版本实例。

pnpm 11 支持 `hoistingLimits: none | workspaces | dependencies`，但这是全局设置，不能直接表达旧 Yarn 1 只针对若干 package pattern 的 `nohoist`。第一阶段使用 `none` 是为了匹配当前 Yarn 4 的实际行为；不能因为根 `package.json` 中存在无效的历史字段，就直接启用全局 `workspaces`。仓库曾短暂启用 Yarn 的 `nmHoistingLimits: workspaces`，随后因 CI workspace 依赖不可见而撤回，这说明全局隔离必须放在依赖清理之后评估。

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
5. 在 `pnpm-workspace.yaml` 中显式设置 `nodeLinker: hoisted` 和 `hoistingLimits: none`。
6. 在保留 `yarn.lock` 的临时迁移状态下执行：

   ```bash
   corepack enable
   pnpm import
   ```

7. 检查生成的 `pnpm-lock.yaml` 是否包含根 package 和全部 19 个子 workspace importer。
8. 执行首次安装并审查安装脚本：

   ```bash
   pnpm install
   pnpm approve-builds
   pnpm install --frozen-lockfile
   ```

9. 将审批结果作为 `allowBuilds` 提交到 `pnpm-workspace.yaml`；当前仅允许 `lefthook`，其余已观察到的构建脚本包明确设为 `false`。
10. 确认第二次 `pnpm install --frozen-lockfile` 不修改 lockfile 或配置。
11. 生成 pnpm 依赖解析快照，并和阶段 0 的 Yarn 快照比较；所有版本变化必须在进入脚本迁移前完成审查。

`pnpm import` 只是生成初始 lockfile 的手段。最终 lockfile 必须通过完整安装、测试和构建验证，不能因为导入命令成功就视为等价。

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

第一阶段使用 `nodeLinker: hoisted`，但仍需修复 pnpm 安装和运行时暴露出的明确缺失依赖：

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
- 保留 `corepack enable`，并由根 `packageManager` 固定 pnpm 版本；
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
4. 使用 `pnpm --filter @groupher/press... install --frozen-lockfile` 安装 Press 及其 workspace 依赖；
5. 使用 `pnpm --filter @groupher/press run build` 构建；
6. 使用 `pnpm --filter @groupher/press --prod deploy --legacy /app/deploy` 生成可搬运的生产目录；
7. runtime image 只复制 `/app/deploy`，不复制 build 阶段的 root `node_modules` 或原始 workspace 目录，避免相对 symlink 因目录搬迁失效。

`--legacy` 是因为当前迁移阶段没有启用 `inject-workspace-packages`；pnpm deploy 会把 workspace 依赖一起放进目标目录。若未来改为 injected workspace packages，应重新验证是否可以移除 `--legacy`。

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

### 阶段 7：isolated 布局加固

这一阶段不阻断首个 pnpm 迁移 PR，但属于后续依赖治理目标。

1. 将 `nodeLinker` 从 `hoisted` 改为 `isolated`；
2. 在干净安装环境运行完整验收矩阵；
3. 修复所有未声明依赖、写死根 `node_modules` 路径和不兼容工具；
4. 验证根 package 直接声明的 `commitizen` 和 `cz-conventional-changelog` 仍可通过现有 `config.commitizen.path` 正确加载；该路径不是当前的 phantom dependency，但需要 smoke test 覆盖；
5. Worker dry-run、Press Docker 和所有 CI 通过后，再将 `isolated` 作为默认配置；
6. 如果某个工具确实要求提升，使用最小范围的 pnpm hoisting 配置并记录原因，不启用全局 `shamefullyHoist`。

`isolated` 切换应作为独立 commit 或 PR，保证出现回归时可以与包管理器迁移本身分开定位和回滚。

## 8. 验收标准

### 8.1 配置和仓库状态

- [ ] 根 `packageManager` 固定为经过验证的 pnpm 版本；
- [ ] `pnpm-workspace.yaml` 包含全部五组 workspace glob；
- [ ] 第一阶段显式配置 `nodeLinker: hoisted` 和 `hoistingLimits: none`；
- [ ] `pnpm-lock.yaml` 已提交且覆盖根 package 与 19 个子 workspace；
- [ ] 24 条内部 package 依赖全部使用 `workspace:*`；
- [x] `allowBuilds` 已提交：仅允许 `lefthook`，其余已观察到的构建脚本包均明确设为 `false`；后续出现新脚本时必须逐项审查；
- [ ] `yarn.lock`、`.yarnrc.yml` 和仓库内置 Yarn release 已删除；
- [ ] 无效的 `packageManagerConfig.hoistingLimits` 已从根 `package.json` 删除；
- [ ] 除本文历史说明外，不存在具有执行意义的 Yarn 引用；
- [ ] 仓库中不存在同时生效的 Yarn 和 pnpm lockfile；
- [ ] 没有新增与迁移无关的依赖升级或业务改动。

### 8.2 安装可复现性

以下命令必须在全新 clone 或清空依赖目录后的环境中通过：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm install --frozen-lockfile
git diff --exit-code
```

验收结果：

- [ ] 首次安装成功；
- [ ] 第二次安装不修改 lockfile 或配置；
- [ ] 没有未审查的依赖构建脚本；
- [ ] 本地和 CI 使用相同 Node.js 与 pnpm 主版本；
- [ ] pnpm 安装后的全部直接依赖版本已与 Yarn 基线比较；
- [ ] 多版本 package、关键传递依赖和 peer context 的变化均已审查并记录；
- [ ] `pnpm import` 没有造成未记录的 package 版本新增、删除或漂移；
- [ ] 内部 workspace 依赖解析到本仓库，而不是 npm registry。

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

- [ ] Yarn 基线中通过的检查在 pnpm 下仍然通过；
- [ ] 没有因为缺失依赖或 CLI 不可见导致的失败；
- [ ] 生成资产和代码生成结果与基线一致；
- [ ] 构建没有产生未预期的 tracked file 变更；
- [ ] peer dependency warning 已逐项判断，新增 warning 必须修复或记录原因。
- [ ] `@groupher/rich-editor` 依赖链中的 `@radix-ui/*` package identity 和版本集合与 Yarn 基线一致，或差异已经审查；
- [ ] Groupher workspace 没有为了迁移而新增未直接使用的 `@radix-ui/*` 依赖；
- [ ] Rich Editor 的编辑、静态渲染、diff 和相关构建路径通过现有测试或定向 smoke test；
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
- [ ] runtime image 来自 `pnpm deploy` 的自包含目录，不依赖 build 阶段 workspace 的相对 symlink。

### 8.6 CI

- [ ] 18 个受影响 workflow 不再引用 Yarn；
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

每个 commit 都应能解释自身范围。最终 PR 不允许保留需要开发者猜测使用哪个包管理器的中间状态。

## 10. 回滚策略

- 合并前：保留迁移前 Yarn 基线结果；任何关键路径失败都停止删除 Yarn 文件的步骤；
- 合并后：如果出现无法快速修复的 CI、Docker 或生产构建回归，整体 revert 迁移 commits，恢复 `packageManager`、`yarn.lock`、`.yarnrc.yml` 和 Yarn release；
- 不通过同时维护 `yarn.lock` 与 `pnpm-lock.yaml` 作为长期回滚方案；
- pnpm store cache 不是源数据，回滚或故障排查时可以安全重建；
- `isolated` 布局加固独立实施，因此可以单独回滚到已验收的 `hoisted` pnpm 状态。

## 11. 完成定义

满足以下条件后，才能宣布“已迁移到 pnpm”：

1. pnpm 是仓库唯一包管理器和唯一 lockfile 来源；
2. 干净环境可执行冻结安装且不产生 diff；
3. 本地完整检查、Cloudflare Workers dry-run 和 Press Docker 构建通过；
4. 18 个 GitHub Actions workflow 全部完成迁移并通过；
5. 内部 workspace 均通过 `workspace:*` 链接；
6. 仓库不存在可执行的 Yarn 残留；
7. 迁移没有引入业务行为变化。

`nodeLinker: isolated` 是后续依赖治理完成标准，不阻断第一阶段 pnpm 迁移完成；但在 isolated 验收之前，不能宣称已经完全消除隐式依赖。

## 12. 参考资料

- [pnpm workspace](https://pnpm.io/workspaces)
- [pnpm settings](https://pnpm.io/settings)
- [pnpm node_modules and hoisting](https://pnpm.io/settings/node-modules)
- [pnpm import](https://pnpm.io/cli/import)
- [pnpm filtering](https://pnpm.io/filtering)
- [pnpm recursive commands](https://pnpm.io/cli/recursive)
- [pnpm approve-builds](https://pnpm.io/cli/approve-builds)
- [pnpm CI recipes](https://pnpm.io/continuous-integration)
