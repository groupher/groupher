# Tailwind class 组合与 `cnMerge` 移除方案

## 结论

Groupher 不通过替换另一个 Tailwind merge 库来移除 `cnMerge`，而是取消“同一个元素允许由多个来源竞争同一个 CSS 属性”的组件 API。

推荐采用混合方案：

| 场景 | 方案 |
| --- | --- |
| 单根节点 variant（包括 Appearance preview） | 项目内置 `tr` |
| 多部件但未达到共享标准 | 独立 Salon 样式或 `@layer components` |
| 同时满足三项标准的共享多 slot recipe | 按需使用 `tailwind-variants/lite` |
| Button、Input、Select 等公共组件 | `@layer components` + `data-*` 状态，默认采用 strict 覆盖 |
| 简单且不冲突的条件组合 | `cn` |
| 宽度、透明度、位置等连续动态值 | CSS variable 或 inline style |
| 任意 class 覆盖内部 variant | 不再作为公共 API 承诺 |

目标是最终删除 `cnMerge` 以及 `cnfast` 的共享入口；frontend 无 `tailwind-merge` 直接依赖，`dev-hub` 保持现状，而不是把 `cnMerge` 换成另一个名字。

## 当前落地状态（2026-09-03）

本轮已完成 frontend 范围的移除：

- `frontend/core/lib/css/index.ts` 只保留轻量 `cn`，并从 `~/css` 导出 `tr`；frontend 全目录不再引用 `cnMerge` 或 `cnfast`。
- root 与 `frontend/core` 的 `cnfast` workspace 依赖已删除，pnpm lockfile 已同步；`local/dev-hub` 的 `tailwind-merge` / `twMerge` 明确保留，不属于本次迁移。
- Appearance 已完成两种机制的独立对照：`TagLayout` 使用 `tr`，`FullCardPreview` 使用 `data-state` + `@layer components`。
- Appearance 中原先的 `block + blockActive` 状态组合已统一收敛到 `tr` recipe；涉及背景色的 FloatBackground 条不再把主题色和 `bg-white` / `bg-black` 放在同一个 `cn` 组合中。
- 骨架条已逐项恢复旧 `bar` 提供的几何契约：凡是直接与 `barBase` 组合的 overlay 都显式声明必要的高度、宽度和透明度；Kanban item 与 Global preview 有几何契约测试，Community preview、Stack cards 等路径已完成逐项审计。Button 保留 `metrics/button.ts` 作为尺寸、圆角和字号的唯一 TS 来源，并将 loading、soft、tone、round 等原先依赖 merge 仲裁的组合改为互斥输出；没有把 Button 的尺寸数值复制到 CSS。

本轮验证结果：Core 测试通过 185 个测试文件、740 个测试；Core、Dash、Landing、Community、Apply 类型检查通过，Core lint 和格式检查通过；Dash、Landing、Community、Apply 的 client/SSR 生产构建通过。构建产物中的大 chunk、动态导入和 Wrangler 配置提示均为既有项目提示，不是本次迁移错误。

本轮构建得到的 CSS after 快照为：Dash 191.40 kB、Landing 194.50 kB、Community 191.32 kB、Apply 193.53 kB（均为未压缩体积）。这些数值只作为当前 after 记录，不能单独推导相对 cnfast 的收益；如需量化收益，应按阶段零口径使用同一构建环境补录 baseline 与 gzip 对比。

## 为什么不能直接把 `cnMerge` 改成 `cn`

`cn` 只负责条件拼接，不负责理解 Tailwind class 之间的冲突关系：

```tsx
cn('h-8', active && 'h-10')
// 可能得到："h-8 h-10"
```

当同一元素同时出现两个 `h-*`、`w-*`、`p-*`、`bg-*` 或 `text-*` class 时，最终效果依赖生成 CSS 的顺序，而不是简单依赖字符串中谁写在后面。

因此下面这种 API 本身就需要 merge 运行时：

```tsx
<Button className="h-12 bg-red-500" />
```

如果 Button 内部同时输出 `h-9 bg-blue-600`，组件就必须选择一种策略：

1. 运行时解析并合并 class；
2. 禁止任意覆盖，改用明确的 `size`、`variant`、`state` props；
3. 将内部样式放到 component layer，让 utility layer 按 CSS 层级覆盖。

本方案选择后两种。

## 推荐的组件边界

### 公共组件：component layer + data attributes

Button、Input、Select、Badge 等公共组件适合拥有稳定的 CSS class，并通过属性表达状态：

```tsx
<button
  className="g-button w-full"
  data-variant="primary"
  data-size="md"
  data-state={loading ? 'loading' : 'idle'}
>
  Submit
</button>
```

```css
@layer components {
  .g-button {
    @apply inline-flex items-center rounded-md;
  }

  .g-button[data-variant='primary'] {
    @apply bg-blue-600 text-white;
  }

  .g-button[data-size='sm'] {
    @apply h-8 px-3 text-sm;
  }

  .g-button[data-size='md'] {
    @apply h-10 px-4;
  }

  .g-button[data-state='loading'] {
    @apply cursor-wait opacity-70;
  }
}
```

这种方式的优点：

- 基础样式不进入 React 的 class 拼接逻辑；
- 状态由 DOM 属性表达，浏览器和 CSS 负责应用状态样式；
- `w-full` 这类布局 utility 可以覆盖 component layer 的默认样式；
- 不需要 `cnMerge`。

Tailwind 官方建议将 `.btn`、`.card` 等复杂默认样式放在 `components` layer，并允许 utility layer 覆盖它们：https:。

### 样式文件与 host 加载边界

公共 component layer 不能只新增一个 CSS 文件就算完成。当前共享 Tailwind 入口是 `frontend/core/tailwind/global.css`，其中显式声明了 `base`、`components`、`utilities` 的顺序，并导入 tokens、safelist 和 common styles。新的公共样式应放在独立的 `frontend/core/tailwind/components/` 目录，并由 `global.css` 显式导入：

```css
@import './components';
@layer base, components, utilities;
```

组件文件必须显式写入 `@layer components`，不能使用未分层的 CSS，否则会改变现有 layer 的覆盖关系。

需要逐个确认入口：

- Apply、Community、Dash、Landing 当前直接使用 Core 的 `global.css`；
- Inspire Me 有自己的 global CSS 入口；
- Widget 使用 Shadow DOM 的独立 `styles.css?inline`，不会自动继承 Core 的 global CSS；
- `local/dev-hub` 也有自己的 client CSS 入口和依赖边界。

如果 Widget 需要渲染同一套公共组件，必须明确决定是把 component layer 纳入 Widget 独立 build，还是继续维护 Widget 专属样式。不能假设 Core 的 `.g-*` class 会自动存在。

### `@apply` 与动态 token

`@apply` 只能引用构建时已经存在的静态 utility/token。静态 `@theme` 中的彩虹色可以用于 component CSS，但运行时社区自定义色不能简单写成：

```css
@apply bg-custom;
```

`safelist.css` 保活 class 也不等于让运行时值可以被 `@apply`。动态颜色应改为 CSS variable 或 inline style，例如使用预定义的变量消费 class：

```css
.g-button[data-tone='custom'] {
  background-color: var(--button-custom-bg);
}
```

迁移任何颜色、尺寸或位置前，先盘点该 token 是静态生成的 utility、safelist class，还是运行时变量。

### 内部组件：`tr` typed recipe

对于 Appearance 等内部组件，使用项目内置的 `tr` helper。它借鉴 CVA 的 `variants` 思路，但不引入第三方 recipe runtime，也不做 Tailwind 冲突解析：

```ts
import { tr } from '~/css'

const card = tr({
  base: 'rounded-lg border p-4',
  variants: {
    state: {
      idle: 'opacity-60',
      active: 'opacity-100 ring-2',
    },
  },
  defaultVariants: {
    state: 'idle',
  },
})
```

调用方选择一个完整状态，而不是拼接互相覆盖的增量 class：

```tsx
<div className={card({ state: active ? 'active' : 'idle' })} />
```

`tr` 的第一版只提供 `base`、`variants`、`defaultVariants` 和类型推导。它本身仍会在运行时根据 props 选择 class string，但只包含对象查找和轻量拼接，不包含 class parser、冲突规则表或 merge cache。TypeScript 层面限制合法 variant key；运行时遇到未知 key 时忽略该 key，并回退到对应的 `defaultVariants`。没有默认值的 variant 轴不输出该轴 class，也不抛异常。

`tr` 是 shared Core 的唯一 recipe helper：只能从 `~/css` 导出和导入，禁止各个 app 或 feature 自行实现同名 helper。它必须有独立的单元测试，至少覆盖默认 variant、boolean variant、未知 key 回退默认值、缺省 props 和 class 输出顺序。

recipe 的约束：

- 每个 variant 轴负责不同的 CSS 属性集合；
- 同一轴的每个分支不能重复声明相互冲突的属性；
- 不通过 `className` 重新打开任意覆盖通道；
- 真实动态值使用 CSS variable 或 inline style。

这些约束不能由第一版 `tr` 静态保证，必须依靠 code review、recipe 单元测试和阶段零确定的状态矩阵验收。`tr` 不应给调用方“已经自动解决 class 冲突”的错觉。

如果遇到 `active && size`、`ghost && soft` 等跨轴组合：

1. 单个组件且组合很少时，优先改成明确的组合 variant 或独立的状态分支；
2. 如果组合开始在多个组件重复，先记录为升级候选；
3. 只有同时满足多 slot 引入标准时，才引入 `tailwind-variants/lite`；
4. 第一版不在 `tr` 中悄悄加入 `compoundVariants`，避免 helper 逐渐变成另一个 merge/variant 框架。

## `tailwind-variants/lite`（按需）

`Card`、`Tabs` 或 Appearance preview 不能因为有多个 DOM 子元素就自动使用 slots。只有以下三个条件全部满足时，才允许为一个 recipe 引入 `tailwind-variants/lite`：

1. 同一 recipe 跨至少两个组件或产品 host 复用；
2. recipe 至少管理两个有稳定名字的样式部件，例如 `root`、`title`、`body`；
3. variant 组合确实需要 `compoundVariants` 或 `compoundSlots`，用 `tr` 的独立函数已经明显重复或难以维护。

缺少任意一个条件时，使用 `tr`、独立 Salon 样式或 component layer。引入例外必须在变更说明中写出复用方、slot 列表和 compound 组合，不能只以“组件比较复杂”为理由。

```ts
import { tv } from 'tailwind-variants/lite'

const card = tv({
  slots: {
    root: 'rounded-lg border',
    title: 'font-medium',
    body: 'text-sm',
  },
  variants: {
    state: {
      idle: { root: 'opacity-60' },
      active: { root: 'opacity-100 ring-2' },
    },
    size: {
      sm: { root: 'p-3' },
      md: { root: 'p-4' },
    },
  },
})

const styles = card({ state: 'active', size: 'md' })

styles.root()
styles.title()
styles.body()
```

### 体积

以下是 `2026-09-03` 对发布版本的本地测量，使用 `tailwind-variants@3.3.1`、esbuild、minify，并以一个简单的 `tv()` recipe 作为入口：

| 入口 | minified | gzip |
| --- | ---: | ---: |
| `tailwind-variants` | 约 40.3 kB | 约 13.0 kB |
| `tailwind-variants/lite` | 约 10.8 kB | 约 3.8 kB |

实际应用的增量会受到 tree-shaking、是否已经共享该模块以及导入了哪些 API 的影响。官方文档也说明 lite 入口在不需要冲突合并时约小 80%：https:。

因此：

- `lite` 相比默认入口明显更轻；
- 它仍然是运行时 recipe，不是静态 CSS 编译器；
- 它比 `tr` 多约 3–4 kB gzip，但换来了 slots 和更舒服的多部件 API；
- 不应为了 Button、Input 或单一根节点的 Appearance preview 全局引入它。

### 使用边界

```text
单根节点 variant（包括 Appearance preview）
  → tr

多部件但未达到三项共享标准
  → 独立 Salon 样式或 component layer

同时满足三条引入标准的共享多 slot 组件
  → tailwind-variants/lite

Button / Input / Select 等公共组件
  → component layer + data-* 状态，默认 strict 覆盖

简单 class 组合
  → cn
```

`Card`、`Tabs` 和 Appearance preview 不能按名字直接决定方案：如果只有一个承载样式的根节点，按单根节点 variant 使用 `tr`；如果存在 root/title/body 等多个稳定部件但未满足三项共享标准，使用独立 Salon 样式或 component layer；只有满足三项标准时才使用 `tailwind-variants/lite`。

必须使用 lite 入口：

```ts
import { tv } from 'tailwind-variants/lite'
```

不要使用默认入口：

```ts
import { tv } from 'tailwind-variants'
```

默认入口包含 Tailwind conflict resolution，会把原本要移除的 merge runtime 带回来。

## 当前 Groupher 的迁移映射

### `base + active`

当前 Appearance 中的：

```tsx
cnMerge(s.block, active && s.blockActive)
```

改为以下任一形式：

```tsx
className={card({ state: active ? 'active' : 'idle' })}
```

或：

```tsx
<div className="g-block" data-state={active ? 'active' : 'idle'} />
```

涉及 Tag、InlineTag、Post、Changelog、Community、Kanban、Float、FullCard、NavActive 等选中态。

### `base + tone/size`

例如：

```tsx
cnMerge(s.bar, toneClass)
cnMerge(s.popover, 'w-24 bg-white')
```

改为：

```tsx
bar({ tone })
popover({ size: 'sm', tone: 'light' })
```

不要再让一个默认 `bar` 同时拥有可被调用方随意覆盖的宽高、颜色和背景。

### `rowClassName` 等任意外部 class

对于 `TextureBalls` 这类组件，需要在以下方案中选择一个：

- 改成 `rowTone`、`rowLayout` 等明确 props；
- 使用 component layer，约定外部 utility 只能覆盖布局属性；
- 如果必须支持任意冲突覆盖，则这个边界仍然需要独立的 merge runtime。

如果目标是彻底移除 `cnMerge`，最终应优先采用前两种。

## 外部 `className` 的真实语义

“不承诺任意 class 覆盖”不是技术约束。只要组件仍把调用方的 `className` 放到同一个元素上，Tailwind utilities 就可能覆盖 component layer 中的视觉属性，并留下 hover、border 或 state 的部分组合，形成静默的混合视觉。

每个公共组件必须在迁移前选择一种明确策略：

### 宽松覆盖

继续允许任意 `className`，但把它定义为 CSS cascade 覆盖，而不是稳定的组件 API。需要：

- 文档明确允许覆盖哪些属性；
- 对 `bg-*`、`text-*`、`border-*`、`h-*`、`w-*` 等受保护属性做 review 或 lint 提示；
- 视觉测试覆盖状态和 hover 的组合。

### 严格覆盖

把公共 API 拆成明确的 `variant`、`size`、`state`、`layout` 或 slot props，`className` 只用于非冲突布局扩展。

需要特别注意，`data-*` 和高 specificity selector 只能帮助组件内部区分状态，不能阻止同一元素上的后置 utility 覆盖 component layer。Tailwind v4 中 utilities layer 的正常规则位于 components layer 之后，因此 selector specificity 不能跨 layer 取得优先权。https:

如果某个视觉属性确实必须由组件完全拥有，实际可用的控制手段是改变值的归属边界：使用 inline style 承载运行时值，或者将少量受保护 CSS 放到 unlayered CSS 中。前者仍可能被 `!important` 规则覆盖，后者会同时阻止外部 utility 覆盖布局；`!important` 不作为常规方案。CSS variable 本身也不是阻止外部 utility 覆盖的硬锁。因此本方案不承诺“通过 selector 锁死样式”，而是通过 strict API、节点拆分和属性白名单控制覆盖契约。https:

严格组件的验收重点是：外部布局 utility（如 `w-full`、`mt-4`）可用，受保护的视觉属性不依赖调用方 className；而不是声称所有外部 class 都能被组件 selector 阻挡。

公共组件默认采用严格覆盖策略；如果确实需要宽松覆盖，必须在组件文档中声明例外及其属性白名单。调用方都必须知道哪些属性是可覆盖的。不能只写“任意覆盖不承诺”，然后在验收中同时要求外部 class 继续可用。

## 状态仲裁与视觉矩阵

从 class 字符串迁移到 data attribute 或 component layer 后，仲裁点会从调用处的字符串组合变成 CSS selector 和 layer 顺序，不能依赖源码中 class 的先后顺序。

每个状态型 recipe 至少要明确以下矩阵：

| 状态 | 普通 | hover | dark | dark + hover |
| --- | --- | --- | --- | --- |
| idle | 必须定义 | 必须定义 | 必须定义 | 必须定义 |
| active | 必须定义 | 必须定义 | 必须定义 | 必须定义 |

这里的“必须定义”是指必须显式声明预期，包括“与普通态一致”；没有 hover 行为的 recipe 不需要为了填表而新增 hover CSS。

例如 `cardIdle` 带有 `hover:opacity-100 hover:saturate-100`，而 `cardActive` 只写普通态 `opacity-100 saturate-100` 时，迁移后必须明确 active + hover 的预期，而不能假定 CSS 会自动继承正确结果。

## 其他方案的定位

### CVA 与 `tr`

CVA 很小，`class-variance-authority@0.7.1` 的主 bundle 约为 `1.26 kB`、gzip 约 `655 B`，并带有一个 `clsx` 依赖：https:。

但 CVA 不是静态编译器，也不负责 Tailwind conflict resolution。`tr` 选择相同的轻量方向，同时避免为了简单 variants 增加第三方依赖。若重新支持任意 `className` 覆盖，CVA 通常也还需要额外接入 `tailwind-merge`。https:、https:

### 编译期 CSS 系统

Panda CSS、vanilla-extract 等方案可以进一步减少客户端样式 runtime，但属于整体 styling system 迁移。Panda 的 static CSS 也需要显式配置要生成的 recipe 变体：https:。

当前不建议为了移除 `cnMerge` 而迁移整个 CSS 系统。

## 迁移阶段

### 阶段零：baseline 与调用点审计

先建立可重复的 baseline，再决定迁移是否值得。Core 没有独立的生产 bundle，baseline 应按各 host 的 Core 共享 chunk，以及各 host 自身的 initial/shared/lazy chunk 分开记录；host 范围包括 Landing、Dash、Community、Apply、Inspire Me、Widget。`local/dev-hub` 不在本次 baseline 或迁移范围内。

- 生产 client bundle 的 raw、minified、gzip 大小；
- `cnfast` 在初始 chunk、共享 chunk、lazy chunk 中的实际贡献；
- `cnMerge` 调用数量、文件数量和每个 host 的分布；
- merge runtime 的 parse/execute 开销（如果当前 bundle 工具能提供）；
- `cnfast` 的依赖来源和入口链路，并确认 frontend 没有直接依赖 `tailwind-merge` / `twMerge`。

调用点先全部生成清单，再按以下类别抽样审计：

| 类别 | 特征 | 首选处理 |
| --- | --- | --- |
| A：组件内部组合 | 同一元素的静态 salon class 叠加，实际没有冲突 | 直接改 `cn` |
| B：caller 覆盖 | `className`、尺寸或布局 class 覆盖组件默认值 | component layer 或收窄 API |
| C：base + state | idle/active、enabled/disabled、tone/size 互相覆盖 | `tr`、data state 或明确 props |

调用数量不是收益指标。只有 baseline 证明初始 bundle 有可回收的 merge 成本，并且 C 类调用的迁移风险可控，才进入下一阶段。文档中的数量必须由 baseline 脚本生成，不能把某个工作树快照中的数字当成永久现状。

阶段零还要记录测试能力边界。当前 Vitest 组件测试主要验证 class、行为和语义属性，Playwright 现有截图属于 Dash、Landing、Auth 等端到端流程；仓库没有现成的 idle/hover/active/dark 组件级矩阵回归 harness。因此“视觉矩阵回归”不能被当作已有能力写入验收。

本方案的默认测试策略是：阶段一先使用 focused Vitest 加人工状态矩阵验收，不预先建设通用截图框架；如果试点涉及多个 host、复杂 hover/dark 组合，且人工验收不足以证明等价，再建设范围受限的 Playwright 组件 harness。新增截图必须放在 `.playwright/` 下。

### 阶段一：Appearance 机制试点

不要从 Button 开始。试点刻意比较 `tr` 和 `data-state` 两种机制，但每个组件内部只使用一种机制，并通过独立小提交和保留现状的 control 组件来比较结果：

- `TagLayout`：单独提交，用 `tr` 表达 `block` 的 idle/active；
- `FullCardPreview` 或 `NavActive`：单独提交，用 `data-state` 表达 active；
- 选择一个仍保留现状的同类 preview 作为视觉和测试对照。

对比以下指标：

- recipe 或 CSS 的代码量；
- hover、active、dark 组合是否容易表达；
- Salon 是否仍然清晰；
- 测试需要改动多少；
- 生产 bundle 是否发生可测量变化。
- `FullCardPreview` 的 `data-*` CSS 进入共享 component layer 后，对共享 CSS 体积及非 Dash host 的影响是否可接受。

试点完成后必须经过显式 go/no-go 决策，才能进入公共组件阶段：

- **go**：shared/initial bundle 有实际可回收的收益，试点状态与语义行为保持一致，测试和 CSS ownership 规则可执行，且没有新的 host 或样式边界问题；
- **no-go**：收益主要只存在于 lazy chunk 或接近测量误差，迁移引入明显 CSS 重复/覆盖歧义，或测试成本高于可回收收益。

决策依据使用阶段零与试点后的 raw、minified、gzip 数据及迁移成本，不预设脱离 baseline 的固定阈值。no-go 时保留现状，或只合并已经证明安全的 A 类调用点。

试点必须按小提交完成，每个提交都能独立回退。不要在同一个组件内混用 `data-*`、component layer 和 `tr`；不同组件可以分别采用不同机制，试点本身就是刻意的 `tr` vs `data-*` 对照实验。

### 阶段二：确定公共组件路线

只有 go 决策通过后，才处理 Button、Input、Select。Button 不是首个样板：它有 wrapper/inner 双层 DOM、ghost/soft/red/disabled/loading 等交叉状态，尺寸和圆角还由 `metrics/button.ts` 及 inline spacing 共同决定。Button 最可能的落点是 component layer + 收窄后的 `className`，而不是 `tr` 或 `tailwind-variants/lite`。

迁移 Button 前必须先确定：

- wrapper 和 inner 分别由哪个样式源负责；
- `metrics/button.ts` 继续作为尺寸、圆角和字号的唯一 TS 来源，CSS 不复制这些数值；
- wrapper/inner 的状态是通过共同的 `data-*` 属性表达，还是由 `.g-button[data-*] .g-button-inner` 这类 descendant selector 表达；
- runtime rainbow/custom color 如何进入 CSS；
- caller `className` 允许覆盖哪些属性；
- loading、hover、disabled、dark 的状态矩阵。

Button/Input 的 component layer 方案应作为经过试点验证后的公共 API 设计，而不是第一阶段的机制试验。

### 阶段三：迁移可归类调用点

- A 类优先直接改为 `cn`，保持 DOM 和视觉行为不变；
- B 类迁移到 component layer 或明确的布局/slot props；
- C 类使用 `tr` 或 data state；
- 测试与每个小批次同步更新，不把 snapshot 改动集中到最后；
- 每个批次覆盖 idle、hover、active、disabled、dark 等实际状态。

### 阶段四：删除 frontend merge runtime

- 共享 CSS/入口改动的 after 测量覆盖所有直接 import `frontend/core/tailwind/global.css` 的 host：Apply、Community、Dash、Landing；
- Widget 只有在其独立入口被改动时才纳入本阶段验收；dev-hub 不在本次迁移范围内；
- 删除 `cnfast` 前确认各 host 的 alias 和依赖没有依赖 workspace hoist 提供的隐式 `cnfast`；
- 删除 root `package.json` 和 `frontend/core/package.json` 中的 `cnfast`；
- 删除 frontend 共享入口中的 `cnMerge` 与 `cnfast`，并确认 frontend 全目录不存在 `tailwind-merge` / `twMerge` 直接依赖；
- 清理所有 salon 或其他模块中的 `export { cn, cnMerge } from '~/css'` 透传点；
- 增加结构性 lint，禁止从非 `~/css` 位置实现或导出 `tr`；
- 保留明确的 class ownership 规则，不尝试静态推断所有 Tailwind 冲突。

### dev-hub 范围边界

`local/dev-hub` 是独立的应用和 CSS/build 边界，继续使用 `tailwind-merge` / `twMerge`，不参与本次 `cnMerge` / `cnfast` 移除，也不纳入本方案的 bundle、测试或依赖清理验收。

## 测试、lint 与回滚

Appearance 的 layout 测试可能会 mock `cnMerge` 或断言 `block-active` 等 class。每个迁移批次要同时完成：

- 删除或替换对应的 `cnMerge` mock；
- 保留 `aria-pressed`、`data-state` 等语义断言；
- 更新 class 断言，使其验证样式契约而非偶然的拼接实现；
- 按阶段零确定的测试策略覆盖 idle/hover/active/dark，使用人工矩阵或受限 Playwright harness；
- 通过 Core 类型检查和对应的 focused tests。

frontend lint 能可靠禁止重新导入 `cnMerge` 和 `cnfast`，但很难静态判断所有 utility 是否冲突。因此采用结构性规则；`dev-hub` 保持自己的 `twMerge` 使用边界：

- `tr` 只能从 `~/css` 导出和导入；
- 一个元素的主要视觉 class 只能有一个 owner：`tr` recipe、data-state/component CSS 或单一 Salon 样式；
- `cn` 可以追加已约定的布局/non-protected class；
- 禁止在 `tr` 结果后无约束地追加尺寸、颜色、状态 utility；
- 冲突属性的完整判断由 code review、recipe 单测和状态矩阵验收负责。

每个迁移批次必须保持可独立回退，不能依赖最后一次全量删除才能恢复原行为。

## 验收标准

- frontend 范围内的 baseline 与 after 数据均已记录；
- 可回收的 merge runtime 成本与迁移成本有明确对比；
- frontend 共享入口不存在 `cnMerge`、`twMerge` 和 `tailwind-merge` 的运行时引用；
- `tr` 只从 `~/css` 导出和导入，并有独立单元测试；
- `cn` 的调用点不存在已审计的同一元素冲突 utility；
- 公共组件的 variant、size、state 和 class ownership 都有明确契约；
- strict 公共组件允许外部布局覆盖（例如 `w-full`、`mt-4`），受保护视觉属性不依赖任意 caller className；
- relaxed 公共组件列出可覆盖属性白名单，并通过对应的 idle/hover/active/dark 状态矩阵验收；不要求宽松策略下所有任意 class 都不产生混合态；
- 每个迁移批次的 focused tests 通过；需要组件级视觉证明时，使用阶段零确定的人工矩阵或受限 Playwright harness；
- 直接 import `frontend/core/tailwind/global.css` 的 Apply、Community、Dash、Landing 均重新测量生产 bundle；Widget 仅在其独立入口被改动时验收，dev-hub 不纳入验收；
- `local/dev-hub` 保留 `tailwind-merge` / `twMerge`，明确标记为本次迁移范围外。

## 参考资料

- https:
- https:
- https:
- https:
- https:
- https:
- https:
