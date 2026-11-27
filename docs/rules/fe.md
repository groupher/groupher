# 前端规则

前端协作约束。

## 通用原则

- 默认先讨论方案，除非明确收到“开始改”或等价指令，否则不要直接修改代码
- 修改时优先遵守项目现有目录结构、命名方式和封装习惯
- 如果发现规则与当前实现明显冲突，先指出冲突点，再讨论处理方式

## 目录归属

从用户进入的产品页开始找实现。确定哪些宿主消费这次修改，再决定是否提取共享能力。[Core 目录说明](../../frontend/core/README.md)

| 要改的行为                                        | 优先查看                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 某个产品的 URL、loader、SSR、服务端请求或部署配置 | 对应宿主。以 Community 和 Dash 为例，路由在 `src/routes/`，服务端代码在 `src/server/`，宿主组件在 `src/components/`。路由定义变更后由工具生成 `routeTree.gen.ts`。                                                                                                                  |
| 跨宿主使用的控件或业务界面                        | `frontend/core/ui/` 放通用控件，`unit/` 放按产品功能组织的组合组件，`shell/` 放共享外壳，`render/` 放内容渲染器。单一页面的私有组合留在所属模块。                                                                                                                                   |
| 服务端数据、组件交互和 URL 状态                   | 共享查询、mutation 和失效规则查 `core/query/`，宿主预加载查对应的 `src/query/`（如 Dash、Community）。可分享的筛选条件交给路由，局部交互留在组件或 hook。共享客户端状态看 `core/stores/`，避免再保存一份 Query 结果。[Query 与 Store 边界](../architecture/query-store-boundary.md) |
| GraphQL 字段、操作、fragment 或生成类型           | 先改源操作，常见位置是 `core/schemas/`。核对 [codegen 输入清单](../../codegen.ts)，运行 `pnpm graphql:codegen`，检查 `core/lib/graphql/generated/` 的变化以及真实消费者。                                                                                                           |
| 导航和跨应用跳转                                  | 共享导航查看 `core/platform/`，宿主拥有自己的路由树。应用内导航保留客户端路由，跨应用链接按整页导航处理。[链接约定](../architecture/platform/links.md)                                                                                                                              |
| Widget、测试和模拟服务                            | 嵌入式 Widget 的 loader、Lit 运行时和 Shadow DOM 样式归 `frontend/widget/`。单元测试就近放置，跨应用浏览器流程看 `frontend/e2e/`，模拟 API 看 `frontend/mock-server/`。[Widget 边界](../../frontend/widget/README.md)                                                               |

## GraphQL 与 Query 命名

- GraphQL operation、fragment、取数函数和 TanStack Query key 的命名遵守 [`naming.md`](./naming.md)
- 单资源查询使用资源名（`Community`、`Doc`、`CommunityTagGroups`），分页集合使用 `PagedXxx`
- 不使用 `Page*`、`Bootstrap`、`Shell` 等页面或加载实现前缀；Query key 不是网络请求

## class 书写

- 写样式前查同类组件的公共 salon、现有 Tailwind utility、主题 token 和[全局 CSS](../../frontend/core/tailwind/common/index.css)，常用语义 class 见 [utils.css](../../frontend/core/tailwind/common/utils.css)。现有能力无法表达时才用 `[xxx]` 任意值
- 静态样式和有限个状态变体由 salon 返回 class，避免 JSX 内联 `style`。拖拽坐标、实时缩放等只能在运行时确定的连续值，可以传给 CSS 变量或相应的 style 属性，其余样式仍归 salon
- 注意区分 cn/cnMerge, 前者不会 merge class, 根据场合酌情使用
- class names 不要放在 `constant.ts`，也不要在组件 JSX 里裸写；样式归对应 `salon`
- `constant.ts` 只放语义常量、枚举、非样式配置；不要把 `wrapper/item/content` 这类 class map 塞进去
- 简单尺寸/状态 class 优先在 `useSalon()` 返回值里直接表达，不要为了几项 class 再引入局部 const map

## 组件拆分

- 一个文件定义一个组件，一个组件负责一件事。当表单、列表项、弹层或某个布局已有独立交互和渲染职责时，拆成具名组件。拆分依据是职责，不设固定行数
- 拆分组件时，禁止把 `const s = useSalon()` 中的 `s` 作为 props 向下传递
- 下层组件如果需要 salon 相关能力，应自行引用 `useSalon()`
- 平铺的组件文件使用 PascalCase，对应的 salon 文件使用同名 snake_case，例如 [HeaderTemplate.tsx](../../frontend/core/unit/HeaderLinks/HeaderTemplate.tsx) 和 [salon/header_template.ts](../../frontend/core/unit/HeaderLinks/salon/header_template.ts)。组件改名时同步更新 salon 和引用
- 目录组件使用成对的入口，例如 [HeaderLinks/index.tsx](../../frontend/core/unit/HeaderLinks/index.tsx) 和 [HeaderLinks/salon/index.ts](../../frontend/core/unit/HeaderLinks/salon/index.ts)
- `salon` 默认 hook 命名统一为 `useSalon()`，新建或重命名模块时优先使用该命名；历史遗留的 `useNavActiveLayoutSalon`、`useInlineTagSalon` 等可继续保留，后续迁移时再统一清理
- 如果有跨页面可复用的最小控件，按“字段级”抽离：封装为独立组件并拆到 `ui` 目录，包含自身 `salon`
- 可复用组件内部可引用自己模块内的 `salon/index.ts`，并按需 `import` 上层公共 salon；不得跨组件直接引用其它页面的私有 salon
- 复用策略要求“各组件 own its salon”：子组件只在自己的 salon 中管理样式/语义能力，公共能力仅通过公共 salon 间接复用
- 布局（group/section/row）按页面组合，不应作为公共字段组件的一部分抽走
- 如果一个组件有多种 layout / mode，优先拆成独立子组件，各自使用自己的 salon；顶层 `index.tsx` 只负责公共外壳和分发
- 简单子组件不要过度目录化；优先使用 `Foo.tsx` + `salon/foo.ts`，不要为几行组件创建 `Foo/index.tsx` + `Foo/salon/index.ts`
- 不要有散落在组件里的 class names, 都收紧到对应的 salon 里去
- 用户可见文案复用现有 i18n key，需要新增时放入对应产品的语言资源。模式、协议值等有业务含义的字符串归语义常量
- 工具函数封装到 ./helper.ts, 多模块复用的加在 utils 下

## constant 与 spec

- 先查现有全局常量、共享类型和生成的契约。含义与所有者一致时直接导入。模块专用的语义常量和跨文件类型分别放在同目录的 `constant.ts` 和 `spec.d.ts`，避免在组件函数内重建或复制。组件自身的运行时状态保留在组件或所属 hook

- `constant.ts` / `constants.ts` 只放运行时语义常量、枚举和非样式配置，不导出
  `type` / `interface`
- 跨文件消费的公开类型、数据结构和组件协议统一放在同目录 `spec.d.ts`；目录已有
  `spec.d.ts` 时直接补充，不再从 `constant.ts` 导出类型
- 即使类型由常量推导，也放在 `spec.d.ts`，通过 type-only import 引用常量，例如
  `type TMode = (typeof MODE)[keyof typeof MODE]`
- `constant.ts` 如果需要类型约束，可以 type-only import 同目录 `spec.d.ts`；禁止因此形成运行时
  循环依赖
- 只服务于本文件常量构造或回调签名、且不导出的私有辅助类型可以留在 `constant.ts`，不要为了
  几行局部类型机械创建 `spec.d.ts`
- 类型一旦被其他文件消费，就应迁入 `spec.d.ts`，并让消费者从 `spec` 导入；值继续从
  `constant` 导入，不要在同一 import 中混取值和公开类型
- 不同领域不要因为名称相同就合并类型；必要时使用更具体的领域命名，例如
  `TDocsPublishMode`，避免与全局 `TPublishMode` 混淆

## 测试

- 如果使用 playwright, 用 /home/xx 社区测试，其他社区没有数据
- 不要把截图放在项目根目录，一定要截图的话放 .playwright/

## 协作方式

- 除非明确收到 go 指令，否则不要直接改动代码
- 默认先把方案、影响范围和实现路径聊清楚
- 如果存在多种实现方式，先给出取舍，再进入改动阶段
