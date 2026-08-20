# Backend Rules

后端协作约束。

## 通用原则

- 默认先讨论方案，除非明确收到“开始改”或等价指令，否则不要直接修改代码
- 修改时优先遵守项目现有目录结构、命名方式和封装习惯
- 如果发现规则与当前实现明显冲突，先指出冲突点，再讨论处理方式

## 当前状态

- 配置归属遵循模块边界：模块内部优先使用自己的 `Config` facade。
- 本模块需要其他模块的配置时，由本模块的 `Config` facade 转发或组合，业务实现不要直接依赖其他模块的 `Config`。
- 同一 domain 内部可以直接使用 owner Config；跨 domain 且带有本模块业务语义时，必须经过本模块 Config facade。
- 纯粹的数据契约引用可以直接使用上游 canonical Config，不为了形式增加无意义的 facade。
- facade 只能表达本模块的语义边界；例如 Gate 的 `ordinary_article_threads` 可以在 Gate Config 中排除 `:doc`，而不能把这个排除规则塞回 Article Config。

## 建议补充方向

- 模块边界与目录约定
- 状态与依赖传递方式
- 数据访问与副作用约束
- 接口变更的兼容性要求
- 默认的测试与验证要求
