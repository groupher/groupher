# ErrorCat 架构

> 状态：current

ErrorCat 是 Groupher 的结构化业务错误边界。它把错误的归属、reason、code、重试策略、动作提示
和 message key 放在实际 producer 所属的领域 catalog 中，再由全局 registry 负责校验，由 Web
协议层负责输出。

## 边界和调用流

```text
领域 producer
    -> 本地域 ErrorCat 构造 ErrorCat.Error
    -> Context / Gate 控制流返回 {:error, error}
    -> Resolver / middleware 进入协议边界
    -> GroupherServer.ErrorCat.gq_format/1
    -> GraphQL / HTTP payload
```

领域代码只声明和使用自己的错误；全局模块不负责猜测业务归属，也不是业务错误的兜底 catalog。

## 所有权

- `GroupherServer.<Domain>...ErrorCat`：拥有领域 reason、code、actions、retryable 和
  `message_key`，并生成结构化错误值。
- `GroupherServer.ErrorCat.Domain`：提供 catalog DSL，并注入跨领域一致的辅助 API。
- `GroupherServer.ErrorCat`：维护全局 namespace/range/reserved registry，执行完整性校验和
  `gq_format/1`。
- `GroupherServer.ErrorCat.Error`：承载跨领域共享的错误值结构，不承载业务归属规则。
- `GroupherServerWeb.ErrorCat`：只拥有 Web / API 协议层错误；领域错误不能因为方便输出而迁移到这里。

## 领域依赖规则

别名是 Elixir 文件内的词法能力，不会从一个模块传播到调用方。因此业务模块必须显式 alias
所属领域的 catalog，例如：

```elixir
alias GroupherServer.CMS.Communities.ErrorCat

{:error, ErrorCat.not_exist()}
```

业务代码不得直接：

- `alias GroupherServer.ErrorCat.Error` 或在模式中暴露全局错误 struct；
- 调用 `GroupherServer.ErrorCat.custom/1` 作为领域错误；
- 根据 raw atom、整数 code 或 raw tuple 猜测错误身份。

`ErrorCat.Domain` 在每个领域 catalog 内部封装全局 struct，并提供：

- `error?/1`、`reason/1`：识别和读取结构化错误；
- `normalize_result/1`：把裸错误值恢复为标准 `{:error, error}` 结果；
- `error_pattern/0`、`error_pattern/1`：需要模式匹配时隐藏全局 struct；
- `error()`：领域 catalog 对外暴露的错误类型。

`custom/1` 和 `gate_unknown/1` 是保留错误的领域边界 wrapper。它们内部才可以转发到全局
reserved 定义；业务代码只能从所属领域 catalog 调用，且新出现的稳定业务语义必须声明正式
reason，不能长期使用 `custom/1`。

## 返回和协议边界

- Catalog 构造函数返回 `%GroupherServer.ErrorCat.Error{}`，不包装 result tuple。
- Domain、Context 和内部公共 API 的失败返回统一为 `{:error, error}`。
- `Repo.rollback/1` 和 Gate `Decision` 可以在专用边界暂时接收裸错误值，离开边界后恢复标准结果。
- GraphQL / HTTP formatter 只接受已声明且未被篡改的结构化错误；领域层不返回 GraphQL keyword。
- `Ecto.Changeset` 只作为 context 内部的持久化校验对象，协议边界由 formatter 转换。

## 变更和校验

新增错误时，先确定真实 producer 和 namespace，再在所属 catalog 声明 reason 与 code；全局
range、reserved code、重复定义和 message key 由编译期 validator 校验。当前仓库的源码约束由
`scripts/check-elixir-module-style.mjs` 检查，完整字段、迁移表和测试要求见
[`ErrorCat v2`](../infra/diagnostics/error-catalog-v2.md)，后端日常规则见
[`Backend Rules`](../rules/be.md)。
