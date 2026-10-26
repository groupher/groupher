# AccountRef 链路移除

> 状态：implemented；OAuth 重名时让用户选择站内 login 的 UI 留待后续。
>
> 更新：2026-10-25

## 问题

Groupher 的 `login` 创建后不可修改且唯一，已经可以稳定定位账户。`nickname` 可以修改，只负责展示。服务端使用数据库 `user.id` 建立关系并执行授权。

旧实现增加了 `accountRef`：GraphQL 从 `user.id` 派生 `acct_...` 值，前端将它复制进 AccountStore，再作为查询缓存、Receipt、本地草稿和交互队列的账户范围。它没有参与 Session 认证或服务端授权，也没有提供 `login` 不具备的稳定性，因此形成了重复的账户身份和一条需要跨 GraphQL、类型、Store、缓存及本地存储维护的传递链。

```text
旧链路：user.id -> GraphQL accountRef -> TUser -> getAccountRef -> AccountStore
                                                 |
                                                 +--> Query keys / Receipt / local storage

目标：Session user.login -> user:encodeURIComponent(login) -> Query keys / Receipt / local storage
       Session user.id ---------------------------> 服务端关系和授权
       Session user.nickname ---------------------> 界面展示
```

`accountRef` 是待移除的旧设计，不是账户身份架构中的推荐概念。客户端从 `login` 编码出的 `accountScope` 只用于避免用户间缓存串用，不构成授权；所有敏感操作仍由服务端 Session、Passport 和 Gate 判定。

## 修复范围

一次收敛客户端账户范围，避免只在 AccountStore 改字段名、底层仍保留重复抽象：

1. 从 GraphQL `User` 和共享 User fragment 移除 `accountRef`，更新生成的 GraphQL 类型。
2. 从 `TUser`、AccountContext 和 Provider 移除 `accountRef` 与 `getAccountRef`。
3. 将 viewer Query key、AlertWall 私有查询、Account Sessions 查询和分页位置改为使用从当前用户 `login` 编码出的 `accountScope`。
4. 将 optimistic action 上下文、交互 Receipt 的字段和本地存储 key 改为使用 `accountScope`；用户切换或退出时，按旧范围清理临时状态及私有 Query 缓存。
5. 移除依赖 `accountRef` 缺失回退的测试数据和分支，确保匿名状态使用单独的匿名缓存范围。
6. 覆盖 Apply review、DsbThread admins/trash、PassportEditor、local draft history、Comments queryState/usePages、useArticleStates、moderation/reconcile 和 invalidation target 类型。

不迁移旧 Receipt 或 IndexedDB 草稿数据；新客户端直接使用新范围。OAuth 平台同名时重新输入站内 login 的 UI 本轮暂不实现。
数据库迁移将 `account.users.login` 设为非空并拒绝更新；若存量用户缺 login，迁移会停止，需先查明数据异常，不在本轮自动补名。

后端数据库关系继续使用 `user.id`，不将登录名改成外键。昵称更新只改变展示结果，不改变用户主页定位、Receipt 所属账户、缓存隔离或数据库关系。

## 验收

- 生产 GraphQL User contract 不再返回 `accountRef`，生成物与 schema 一致。
- AccountStore 只以 Session 返回的 `user` 表达当前用户身份，不再维护第二个账户引用。
- Query key、Receipt、本地账户数据和清理逻辑都使用稳定 login 的编码范围；不同用户的数据互相隔离，退出和切换账户会清理旧账户的临时状态及私有 Query 缓存。
- 改 `nickname` 不会改变用户定位或任何账户范围；服务端关系与授权仍基于 `user.id` 和当前 Session。
- Anonymous 请求不使用伪造的 login，且不会读取登录用户的私有缓存。
- AccountStore、Receipt、互动缓存、AlertWall/账户私有查询、GraphQL contract 与类型检查的相关测试通过。
