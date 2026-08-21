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

## Const

- `GroupherServer.Const` 只封装项目使用的常量机制，不承载跨 Context 的业务枚举。
- 封闭业务词汇由实际 owner 的 `Const` 声明；业务实现依赖所属领域的 Const，不能把领域枚举提升到全局 Helper。
- 同一 Context 下存在明确子领域时，Const 继续遵守子领域所有权；例如 Gate、Communities、Docs、DocTree 分别拥有自己的授权、生命周期、Branch 和 Tree 词汇，不集中堆入 `CMS.Const`。
- 只有真正被多个子领域共同拥有的词汇才放在 Context 根 Const；创建空模块或纯转发 facade 不能改善边界。
- 消费方只是读取上游公开数据契约时可以直接引用 owner Const；只有组合出本模块自己的策略、子集或完整协议时，才建立本地 Const facade。
- Migration 保存创建当时冻结的 DDL 常量，不运行时调用业务 Const；通过测试保证 Ecto Enum、领域校验与数据库 CHECK 没有漂移。
- 数据库 schema prefix 等纯基础设施常量可以保留在共享 Helper，但其中不得混入审核状态、生命周期状态等业务语义。

## ErrorCat

- ErrorCat catalog 函数是错误值构造器，返回 `%GroupherServer.ErrorCat.Error{}`；不在 catalog 内部包装 `{:error, ...}`。
- Domain / Context / 内部公共 API 的失败结果统一为 `{:error, %GroupherServer.ErrorCat.Error{}}`，不返回 `{:error, :atom_reason}`、裸 `%ErrorCat.Error{}` 或自定义 keyword 错误。
- `Repo.rollback/1`、Gate decision 等专用边界可以接收裸 ErrorCat 错误值；边界离开该调用后仍要恢复为标准 result tuple。
- GraphQL 只在 resolver / middleware 协议边界调用 `ErrorCat.gq_format/1`；领域层不返回 GraphQL keyword 格式。
- 错误 reason 优先在所属 context 的 ErrorCat catalog 声明，并分配唯一 code；`GroupherServer.ErrorCat.custom/1` 只用于尚未建立领域 catalog 的过渡边界，不得作为新领域的默认做法。
- 进行 ErrorCat 改造时，同步收紧 `Helper.T.domain_res/1` 等类型契约和相关测试，不保留 atom error 的隐性兼容面。

## 建议补充方向

- 模块边界与目录约定
- 状态与依赖传递方式
- 数据访问与副作用约束
- 接口变更的兼容性要求
- 默认的测试与验证要求
