# Frontend Rules

前端协作约束。

## 通用原则

- 默认先讨论方案，除非明确收到“开始改”或等价指令，否则不要直接修改代码
- 修改时优先遵守项目现有目录结构、命名方式和封装习惯
- 如果发现规则与当前实现明显冲突，先指出冲突点，再讨论处理方式

## class 书写

- 尽量不要使用 `[]` 这类自定义 Tailwind 写法
- 这类写法容易增大 class 体积，只有在确实没有合适现成方案时再使用
- 优先复用项目已有的全局 class，参考 `frontend/core/tailwind/common/utils.css`
- 注意区分 cn/cnMerge, 前者不会 merge class, 根据场合酌情使用
- class names 不要放在 `constant.ts`，也不要在组件 JSX 里裸写；样式归对应 `salon`
- `constant.ts` 只放语义常量、枚举、非样式配置；不要把 `wrapper/item/content` 这类 class map 塞进去
- 简单尺寸/状态 class 优先在 `useSalon()` 返回值里直接表达，不要为了几项 class 再引入局部 const map

## 组件拆分

- 一个文件不要定义多个组件，需要拆分成独立的文件和 salon
- 拆分组件时，禁止把 `const s = useSalon()` 中的 `s` 作为 props 向下传递
- 下层组件如果需要 salon 相关能力，应自行引用 `useSalon()`
- 同目录下组件与对应 salon 的语义名要对齐：组件文件名与其 salon 的用途保持一致，页面组件改名时同步调整引用（例如 `Gradients.tsx` 对应 `salon/gradients.ts`）
- `salon` 默认 hook 命名统一为 `useSalon()`，不允许在路径内用 `useXxxSalon` 这种组件语义化命名
- 如果有跨页面可复用的最小控件，按“字段级”抽离：封装为独立组件并拆到 `widgets` 目录，包含自身 `salon`
- 可复用组件内部可引用自己模块内的 `salon/index.ts`，并按需 `import` 上层公共 salon；不得跨组件直接引用其它页面的私有 salon
- 复用策略要求“各组件 own its salon”：子组件只在自己的 salon 中管理样式/语义能力，公共能力仅通过公共 salon 间接复用
- 布局（group/section/row）按页面组合，不应作为公共字段组件的一部分抽走
- 如果一个组件有多种 layout / mode，优先拆成独立子组件，各自使用自己的 salon；顶层 `index.tsx` 只负责公共外壳和分发
- 简单子组件不要过度目录化；优先使用 `Foo.tsx` + `salon/foo.ts`，不要为几行组件创建 `Foo/index.tsx` + `Foo/salon/index.ts`
- 不要有散落在组件里的 class names, 都收紧到对应的 salon 里去
- 不要出现裸露的字符串，封装到 ./constant.ts
- 工具函数封装到 ./helper.ts, 多模块复用的加在 utils 下

## 测试

- 如果使用 playwright, 用 /home/xx 社区测试，其他社区没有数据
- 不要把截图放在项目根目录，一定要截图的话放 .playwright/

## 协作方式

- 除非明确收到 go 指令，否则不要直接改动代码
- 默认先把方案、影响范围和实现路径聊清楚
- 如果存在多种实现方式，先给出取舍，再进入改动阶段
