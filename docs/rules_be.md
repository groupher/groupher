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
