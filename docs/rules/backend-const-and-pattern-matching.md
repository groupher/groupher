# Backend Const 与 Pattern Matching

后端整理 action、type、state 等分支时，先判断它们是领域协议词汇，还是某个函数的局部分类；再决定放入 `Const`、模块 attribute，或改成函数子句。

## Const 的归属

只有同时满足以下条件时，才适合进入现有 `Const` 体系：

- 值是封闭且稳定的业务 vocabulary；
- 多个模块共享同一份语义，而不是恰好使用了相同的 atom；
- 需要被 schema、校验、migration、API 或多个 domain 作为同一协议理解；
- 存在明确 owner。

例如 Activity 的 `source` 由 `Activity.Const` 所有。CMS Trash 只消费这个协议，因此 source 的合法值和 atom/string 规范化应复用 `Activity.Const`，不能在每个 Trash 模块复制一份。

```elixir
Activity.Const.normalize_source(value)
```

反例是把 `[Post, Blog, Changelog, Doc]` 放入 `CMS.Const`。这只是 Gate Access 用于 schema dispatch 的实现集合，并非跨 CMS domain 的业务枚举；应保留在使用它的模块内。

## 模块 attribute 与局部分类

同一模块内重复出现、且表达该模块策略子集的列表，优先使用有语义名称的 module attribute：

```elixir
@interaction_actions [:upvote, :emotion, :collect, :report]
@solution_actions [:accept_solution, :revoke_solution]
```

不要为了消除一两处重复，把所有局部子集提升成公共 `Const` API。完整 vocabulary 可以由 owner Const 声明，函数专用的子集仍归实现模块。

## 何时使用 pattern matching

当分支由输入的离散值决定，并且每个分支有独立的业务行为时，优先用多函数子句：

```elixir
defp create_node_by_type(:tab, community, args, _user), do: ...
defp create_node_by_type(:page, community, args, user), do: ...
```

这比在一个函数中嵌套 `case type do` 更容易看出每个分支的输入约束和 owner。

保留 `case` 的情况包括：

- 分支只是当前函数中的很短的局部表达式；
- 分支共享大量前后处理，拆函数会增加跳转成本；
- 需要在同一处组合多个值后再决定结果；
- 当前代码已经是结果结构的直接 pattern match，例如 `nil` 与 `%Schema{}`。

## Guard 的边界

普通函数不能在 guard 中调用。需要在 guard 中复用集合时，使用编译期 module attribute，或确实有多个调用点时定义 `defguardp`：

```elixir
@article_models [Post, Blog, Changelog, Doc]

def access_check(actor, action, %model{} = resource)
    when model in @article_models do
  ...
end
```

`defguardp` 不应只是为了隐藏一段很短的列表；当 module attribute 已经能表达领域分组时，优先使用 attribute。

## 评审清单

1. 这组值是否有唯一的业务 owner？
2. 它是完整协议 vocabulary，还是某个策略的子集？
3. 是否已有 owner Const 可以直接复用？
4. 是否在多个模块重复，并且语义确实相同？
5. 分支是否可以通过函数头的值匹配表达？
6. 重构后是否保持 unknown value 的 fail-closed 行为和原有错误协议？
