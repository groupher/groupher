# Passport P0 Action 映射草案

依据改造前 gate.contract.json 生成；本文仅为逐键盘点，不是运行时合同或实施完成声明。旧 grantByThread 保留原 thread 范围作为转换输入；新 action 的范围变化必须在真实数据转换时核对，不能默默扩大授权。Comment 按自身作者由 Gate 判断，不能以 Article owner 代替。

| 旧 Action                              | 旧 scope / grant                               | 目标 Action / scope                                                             | 归属                |
| -------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- | ------------------- |
| `analysis.web.read`                    | community: `community.update`                  | analysis.web.read / community                                                   | P1/P2               |
| `article.insights.read`                | community: `article.insights.read`             | article.insights.read / community                                               | P1 + 对应消费批次   |
| `article.mirror`                       | global: `thread.community.mirror`              | article.mirror / community                                                      | P1 + 对应消费批次   |
| `article.move`                         | global: `thread.community.move`                | article.move / community                                                        | P1 + 对应消费批次   |
| `article.permanent_delete`             | community: `thread.permanent_delete`           | article.permanent_delete / article                                              | P1 + 对应消费批次   |
| `article.restore`                      | community: `thread.restore`                    | article.restore / article                                                       | P1 + 对应消费批次   |
| `article.trash`                        | community: `thread.trash`                      | article.trash / article                                                         | P1 + 对应消费批次   |
| `article.trash.read`                   | community: `thread.trash`                      | article.trash.read / article                                                    | P1 + 对应消费批次   |
| `article.unmirror`                     | global: `thread.community.unmirror`            | article.unmirror / community                                                    | P1 + 对应消费批次   |
| `asset.upload`                         | community: `asset.upload`                      | asset.upload / community                                                        | P1/P2               |
| `audit.read`                           | community: `community.update`                  | audit.read / community                                                          | P1/P2               |
| `blog.draft.publish`                   | owner-only: `author identity`                  | article.update / article.publish / article.read_draft                           | C3                  |
| `blog.draft.update`                    | owner-only: `author identity`                  | article.update / article.publish / article.read_draft                           | C3                  |
| `blog.lock_comment`                    | community: `blog.lock_comment`                 | blog.lock_comment / community                                                   | P1/P2               |
| `blog.permanent_delete`                | community: `blog.permanent_delete`             | article.permanent_delete / article                                              | H / P2B             |
| `blog.pin`                             | community: `blog.pin`                          | blog.pin / community                                                            | P1/P2               |
| `blog.restore`                         | community: `blog.restore`                      | community.article.restore；owner 全局 article.restore                           | P2B                 |
| `blog.sink`                            | community: `blog.sink`                         | blog.sink / community                                                           | P1/P2               |
| `blog.trash`                           | community: `blog.trash`                        | community.article.hide / community.article.trash.read；owner 全局 article.trash | P2B                 |
| `blog.undo_lock_comment`               | community: `blog.undo_lock_comment`            | blog.undo_lock_comment / community                                              | P1/P2               |
| `blog.undo_pin`                        | community: `blog.undo_pin`                     | blog.undo_pin / community                                                       | P1/P2               |
| `blog.undo_sink`                       | community: `blog.undo_sink`                    | blog.undo_sink / community                                                      | P1/P2               |
| `blog.update`                          | community: `blog.edit`                         | article.update / article.publish / article.read_draft                           | C3                  |
| `category.create`                      | global: `category.create`                      | category.create / global                                                        | P1/P2               |
| `category.delete`                      | global: `category.delete`                      | category.delete / global                                                        | P1/P2               |
| `category.set`                         | global: `category.set`                         | category.set / global                                                           | P1/P2               |
| `category.unset`                       | global: `category.unset`                       | category.unset / global                                                         | P1/P2               |
| `category.update`                      | global: `category.update`                      | category.update / global                                                        | P1/P2               |
| `changelog.draft.publish`              | owner-only: `author identity`                  | article.update / article.publish / article.read_draft                           | C3                  |
| `changelog.draft.update`               | owner-only: `author identity`                  | article.update / article.publish / article.read_draft                           | C3                  |
| `changelog.lock_comment`               | community: `changelog.lock_comment`            | changelog.lock_comment / community                                              | P1/P2               |
| `changelog.permanent_delete`           | community: `changelog.permanent_delete`        | article.permanent_delete / article                                              | H / P2B             |
| `changelog.pin`                        | community: `changelog.pin`                     | changelog.pin / community                                                       | P1/P2               |
| `changelog.restore`                    | community: `changelog.restore`                 | community.article.restore；owner 全局 article.restore                           | P2B                 |
| `changelog.sink`                       | community: `changelog.sink`                    | changelog.sink / community                                                      | P1/P2               |
| `changelog.trash`                      | community: `changelog.trash`                   | community.article.hide / community.article.trash.read；owner 全局 article.trash | P2B                 |
| `changelog.undo_lock_comment`          | community: `changelog.undo_lock_comment`       | changelog.undo_lock_comment / community                                         | P1/P2               |
| `changelog.undo_pin`                   | community: `changelog.undo_pin`                | changelog.undo_pin / community                                                  | P1/P2               |
| `changelog.undo_sink`                  | community: `changelog.undo_sink`               | changelog.undo_sink / community                                                 | P1/P2               |
| `changelog.update`                     | community: `changelog.edit`                    | article.update / article.publish / article.read_draft                           | C3                  |
| `comment.delete`                       | owner-only: `author identity`                  | Gate Comment 作者身份                                                           | 对应 Comment 消费者 |
| `comment.pin`                          | owner-only: `author identity`                  | Gate Comment 作者身份                                                           | 对应 Comment 消费者 |
| `comment.undo_pin`                     | owner-only: `author identity`                  | Gate Comment 作者身份                                                           | 对应 Comment 消费者 |
| `comment.update`                       | owner-only: `author identity`                  | Gate Comment 作者身份                                                           | 对应 Comment 消费者 |
| `community.application.approve`        | global: `community.application.approve`        | community.application.approve / global                                          | P1/P2               |
| `community.application.reject`         | global: `community.application.reject`         | community.application.reject / global                                           | P1/P2               |
| `community.application.retry_creation` | global: `community.application.retry_creation` | community.application.retry_creation / global                                   | P1/P2               |
| `community.application.retry_setup`    | global: `community.application.retry_setup`    | community.application.retry_setup / global                                      | P1/P2               |
| `community.application.review`         | global: `community.application.review`         | community.application.review / global                                           | P1/P2               |
| `community.create`                     | global: `community.create`                     | community.create / global                                                       | P1/P2               |
| `community.request_destroy`            | global: `community.request_destroy`            | community.request_destroy / global                                              | P1/P2               |
| `community.update`                     | global: `community.update`                     | community.update / global                                                       | P1/P2               |
| `community_tag.create`                 | community: `thread.community_tag.create`       | community_tag.create / community                                                | P1/P2               |
| `community_tag.delete`                 | community: `thread.community_tag.delete`       | community_tag.delete / community                                                | P1/P2               |
| `community_tag.reindex`                | community: `thread.community_tag.update`       | community_tag.reindex / community                                               | P1/P2               |
| `community_tag.set`                    | community: `thread.community_tag.set`          | community_tag.set / community                                                   | P1/P2               |
| `community_tag.unset`                  | community: `thread.community_tag.unset`        | community_tag.unset / community                                                 | P1/P2               |
| `community_tag.update`                 | community: `thread.community_tag.update`       | community_tag.update / community                                                | P1/P2               |
| `dashboard.rss.update`                 | community: `community.update`                  | dashboard.rss.update / community                                                | P1/P2               |
| `dashboard.theme.update`               | community: `community.update`                  | dashboard.theme.update / community                                              | P1/P2               |
| `doc.history.read`                     | community: `doc.history.read`                  | doc.history.read / community                                                    | P1/P2               |
| `doc.import`                           | community: `doc.import`                        | doc.import / community                                                          | P1/P2               |
| `doc.lock_comment`                     | community: `doc.lock_comment`                  | doc.lock_comment / community                                                    | P1/P2               |
| `doc.permanent_delete`                 | community: `doc.permanent_delete`              | article.permanent_delete                                                        | D2 / H              |
| `doc.pin`                              | community: `doc.pin`                           | doc.pin / community                                                             | P1/P2               |
| `doc.queue.approve`                    | community: `doc.queue.approve`                 | doc.queue.approve / community                                                   | P1/P2               |
| `doc.queue.configure`                  | community: `doc.queue.configure`               | doc.queue.configure / community                                                 | P1/P2               |
| `doc.queue.preview`                    | community: `doc.queue.preview`                 | doc.queue.preview / community                                                   | P1/P2               |
| `doc.queue.publish`                    | community: `doc.queue.publish`                 | doc.queue.publish / community                                                   | P1/P2               |
| `doc.queue.write`                      | community: `doc.queue.write`                   | doc.queue.write / community                                                     | P1/P2               |
| `doc.restore`                          | community: `doc.restore`                       | community.article.restore                                                       | D2 / H              |
| `doc.sink`                             | community: `doc.sink`                          | doc.sink / community                                                            | P1/P2               |
| `doc.trash`                            | community: `doc.trash`                         | community.article.hide / community.article.trash.read                           | D2 / H              |
| `doc.undo_lock_comment`                | community: `doc.undo_lock_comment`             | doc.undo_lock_comment / community                                               | P1/P2               |
| `doc.undo_pin`                         | community: `doc.undo_pin`                      | doc.undo_pin / community                                                        | P1/P2               |
| `doc.undo_sink`                        | community: `doc.undo_sink`                     | doc.undo_sink / community                                                       | P1/P2               |
| `doc.update`                           | community: `doc.edit`                          | article.update / article.publish / article.read_draft                           | D1                  |
| `moderator.set`                        | community: `moderator.set`                     | admin.invite / community                                                        | P2                  |
| `moderator.unset`                      | community: `moderator.unset`                   | admin.remove / community                                                        | P2                  |
| `moderator.update`                     | community: `moderator.update`                  | admin.permissions.update / community                                            | P2                  |
| `post.draft.publish`                   | owner-only: `author identity`                  | article.update / article.publish / article.read_draft                           | C3                  |
| `post.draft.update`                    | owner-only: `author identity`                  | article.update / article.publish / article.read_draft                           | C3                  |
| `post.lock_comment`                    | community: `post.lock_comment`                 | post.lock_comment / community                                                   | P1/P2               |
| `post.permanent_delete`                | community: `post.permanent_delete`             | article.permanent_delete / article                                              | H / P2B             |
| `post.pin`                             | community: `post.pin`                          | post.pin / community                                                            | P1/P2               |
| `post.restore`                         | community: `post.restore`                      | community.article.restore；owner 全局 article.restore                           | P2B                 |
| `post.set_category`                    | community: `post.edit`                         | post.set_category / community                                                   | P1/P2               |
| `post.sink`                            | community: `post.sink`                         | post.sink / community                                                           | P1/P2               |
| `post.trash`                           | community: `post.trash`                        | community.article.hide / community.article.trash.read；owner 全局 article.trash | P2B                 |
| `post.undo_lock_comment`               | community: `post.undo_lock_comment`            | post.undo_lock_comment / community                                              | P1/P2               |
| `post.undo_pin`                        | community: `post.undo_pin`                     | post.undo_pin / community                                                       | P1/P2               |
| `post.undo_sink`                       | community: `post.undo_sink`                    | post.undo_sink / community                                                      | P1/P2               |
| `post.update`                          | community: `post.edit`                         | article.update / article.publish / article.read_draft                           | C3                  |
| `ticket.assign`                        | community: `ticket.assign`                     | ticket.assign / community                                                       | P1/P2               |
| `ticket.create`                        | community: `ticket.create`                     | ticket.create / community                                                       | P1/P2               |
| `ticket.link_source`                   | community: `ticket.link_source`                | ticket.link_source / community                                                  | P1/P2               |
| `ticket.manage_case`                   | community: `ticket.manage_case`                | ticket.manage_case / community                                                  | P1/P2               |
| `ticket.manage_visibility`             | community: `ticket.manage_visibility`          | ticket.manage_visibility / community                                            | P1/P2               |
| `ticket.read_internal`                 | community: `ticket.read_internal`              | ticket.read_internal / community                                                | P1/P2               |
| `ticket.transition`                    | community: `ticket.transition`                 | ticket.transition / community                                                   | P1/P2               |
| `ticket.update`                        | community: `ticket.update`                     | ticket.update / community                                                       | P1/P2               |
| `review.configure`                     | community: `review.configure`                  | review.configure / community                                                    | P1/P2               |
| `review.decide`                        | community: `review.decide`                     | review.decide / community                                                       | P1/P2               |
| `review.platform.configure`            | global: `review.platform.configure`            | review.platform.configure / global                                              | P1/P2               |
| `review.platform.decide`               | global: `review.platform.decide`               | review.platform.decide / global                                                 | P1/P2               |
| `review.platform.read`                 | global: `review.platform.read`                 | review.platform.read / global                                                   | P1/P2               |
| `review.read`                          | community: `review.read`                       | review.read / community                                                         | P1/P2               |
| `thread.create`                        | community: `thread.create`                     | thread.create / community                                                       | P1/P2               |
| `thread.set`                           | community: `thread.set`                        | thread.set / community                                                          | P1/P2               |
| `thread.unset`                         | community: `thread.unset`                      | thread.unset / community                                                        | P1/P2               |

## 旧 grant-only / 写入口

- `god`：转换为 Global 行的 `is_root`，不生成普通 grant；现有 Registry、middleware、Gate Load、rate limit、insights、seed 和测试均须切换。
- `stamp_passport`：旧写入口退役；Moderators Setup / Persist、seed、support 的调用归 P2 / P4 转入领域 Command / Passport Store；不能生成普通可授予权限。
- `system_notification.publish`：全仓 literal 扫描仅发现 PermissionConfig 的 Global grant 与前端 i18n，尚未定位真实 runtime producer 或 Action；列为未定位，不自动创建 Action，也不能声称无动态消费者。
- 各 thread 的 `edit` 转为 Article 正文授权，不自动授予旧 holder；`community.mirror / move / unmirror` 转为社区 Action，须保留原 thread 范围差异证据；各 thread 的 trash / restore / permanent_delete 按表拆分本站与全局，不能自动扩权。
- 各 thread 的 `community_tag.create / update / delete / set / unset` 目前作为 `community_tag.*` 的 grantByThread 使用；新目录是否保留逐 thread 授权能力须在转换及对应消费实现中验证，不能直接合并为全部 thread 的授权。

本清单覆盖旧静态 action 和 grant 模式，不等于完成宏、middleware、seed、job、动态消费者或目标环境数据盘点。各新条目的 grantable / requires / requires_thread 以最终唯一合同为准。

## 目标目录草案

以下按现有行为与已确认合同整理，最终以生成合同及各调用方复核为准。`requires_thread` 为依赖，不是旧逐 thread grant 范围的自动转换。

| Action                                 | Scope     | 可授予 | requires                                                 | requires_thread      |
| -------------------------------------- | --------- | ------ | -------------------------------------------------------- | -------------------- |
| `admin.invite`                         | community | false  | —                                                        | —                    |
| `admin.permissions.update`             | community | false  | —                                                        | —                    |
| `admin.remove`                         | community | false  | —                                                        | —                    |
| `analysis.web.read`                    | community | true   | —                                                        | —                    |
| `article.author.manage`                | article   | false  | —                                                        | —                    |
| `article.history.read`                 | article   | true   | —                                                        | —                    |
| `article.history.restore`              | article   | true   | article.history.read, article.update, article.read_draft | —                    |
| `article.insights.read`                | community | true   | —                                                        | —                    |
| `article.mirror`                       | community | true   | —                                                        | doc: doc.queue.write |
| `article.move`                         | community | true   | article.unmirror                                         | doc: doc.queue.write |
| `article.permanent_delete`             | article   | false  | article.trash.read                                       | —                    |
| `article.publish`                      | article   | true   | article.read_draft                                       | —                    |
| `article.read_draft`                   | article   | true   | —                                                        | —                    |
| `article.restore`                      | article   | false  | article.trash.read                                       | —                    |
| `article.trash`                        | article   | false  | article.trash.read                                       | —                    |
| `article.trash.read`                   | article   | false  | —                                                        | —                    |
| `article.unmirror`                     | community | true   | —                                                        | doc: doc.queue.write |
| `article.update`                       | article   | true   | article.read_draft                                       | —                    |
| `asset.upload`                         | community | true   | —                                                        | —                    |
| `audit.read`                           | community | true   | —                                                        | —                    |
| `blog.lock_comment`                    | community | true   | —                                                        | —                    |
| `blog.pin`                             | community | true   | —                                                        | —                    |
| `blog.sink`                            | community | true   | —                                                        | —                    |
| `blog.undo_lock_comment`               | community | true   | —                                                        | —                    |
| `blog.undo_pin`                        | community | true   | —                                                        | —                    |
| `blog.undo_sink`                       | community | true   | —                                                        | —                    |
| `category.create`                      | global    | true   | —                                                        | —                    |
| `category.delete`                      | global    | true   | —                                                        | —                    |
| `category.set`                         | global    | true   | —                                                        | —                    |
| `category.unset`                       | global    | true   | —                                                        | —                    |
| `category.update`                      | global    | true   | —                                                        | —                    |
| `changelog.lock_comment`               | community | true   | —                                                        | —                    |
| `changelog.pin`                        | community | true   | —                                                        | —                    |
| `changelog.sink`                       | community | true   | —                                                        | —                    |
| `changelog.undo_lock_comment`          | community | true   | —                                                        | —                    |
| `changelog.undo_pin`                   | community | true   | —                                                        | —                    |
| `changelog.undo_sink`                  | community | true   | —                                                        | —                    |
| `community.application.approve`        | global    | true   | —                                                        | —                    |
| `community.application.reject`         | global    | true   | —                                                        | —                    |
| `community.application.retry_creation` | global    | true   | —                                                        | —                    |
| `community.application.retry_setup`    | global    | true   | —                                                        | —                    |
| `community.application.review`         | global    | true   | —                                                        | —                    |
| `community.article.hide`               | community | true   | community.article.trash.read                             | doc: doc.queue.write |
| `community.article.restore`            | community | true   | community.article.trash.read                             | doc: doc.queue.write |
| `community.article.trash.read`         | community | true   | —                                                        | —                    |
| `community.create`                     | global    | true   | —                                                        | —                    |
| `community.request_destroy`            | global    | true   | —                                                        | —                    |
| `community.update`                     | global    | true   | —                                                        | —                    |
| `community_tag.create`                 | community | true   | —                                                        | —                    |
| `community_tag.delete`                 | community | true   | —                                                        | —                    |
| `community_tag.reindex`                | community | true   | —                                                        | —                    |
| `community_tag.set`                    | community | true   | —                                                        | —                    |
| `community_tag.unset`                  | community | true   | —                                                        | —                    |
| `community_tag.update`                 | community | true   | —                                                        | —                    |
| `dashboard.rss.update`                 | community | true   | —                                                        | —                    |
| `dashboard.theme.update`               | community | true   | —                                                        | —                    |
| `doc.history.read`                     | community | true   | —                                                        | —                    |
| `doc.import`                           | community | true   | —                                                        | —                    |
| `doc.lock_comment`                     | community | true   | —                                                        | —                    |
| `doc.pin`                              | community | true   | —                                                        | —                    |
| `doc.queue.approve`                    | community | true   | —                                                        | —                    |
| `doc.queue.configure`                  | community | true   | —                                                        | —                    |
| `doc.queue.preview`                    | community | true   | —                                                        | —                    |
| `doc.queue.publish`                    | community | true   | —                                                        | —                    |
| `doc.queue.write`                      | community | true   | —                                                        | —                    |
| `doc.sink`                             | community | true   | —                                                        | —                    |
| `doc.undo_lock_comment`                | community | true   | —                                                        | —                    |
| `doc.undo_pin`                         | community | true   | —                                                        | —                    |
| `doc.undo_sink`                        | community | true   | —                                                        | —                    |
| `post.lock_comment`                    | community | true   | —                                                        | —                    |
| `post.pin`                             | community | true   | —                                                        | —                    |
| `post.set_category`                    | community | true   | —                                                        | —                    |
| `post.sink`                            | community | true   | —                                                        | —                    |
| `post.undo_lock_comment`               | community | true   | —                                                        | —                    |
| `post.undo_pin`                        | community | true   | —                                                        | —                    |
| `post.undo_sink`                       | community | true   | —                                                        | —                    |
| `review.configure`                     | community | true   | —                                                        | —                    |
| `review.decide`                        | community | true   | —                                                        | —                    |
| `review.platform.configure`            | global    | true   | —                                                        | —                    |
| `review.platform.decide`               | global    | true   | —                                                        | —                    |
| `review.platform.read`                 | global    | true   | —                                                        | —                    |
| `review.read`                          | community | true   | —                                                        | —                    |
| `thread.create`                        | community | true   | —                                                        | —                    |
| `thread.set`                           | community | true   | —                                                        | —                    |
| `thread.unset`                         | community | true   | —                                                        | —                    |
| `ticket.assign`                        | community | true   | —                                                        | —                    |
| `ticket.create`                        | community | true   | —                                                        | —                    |
| `ticket.link_source`                   | community | true   | —                                                        | —                    |
| `ticket.manage_case`                   | community | true   | —                                                        | —                    |
| `ticket.manage_visibility`             | community | true   | —                                                        | —                    |
| `ticket.read_internal`                 | community | true   | —                                                        | —                    |
| `ticket.transition`                    | community | true   | —                                                        | —                    |
| `ticket.update`                        | community | true   | —                                                        | —                    |

## thread 基线

`backend/api/config/config.exs` 的 Article 运行时线程和 GraphQL `ArticleThread` 均为 post / blog / changelog / doc。GraphQL `Thread` 另含 kanban / account / about / dashboard / user，Ticket 有独立领域入口；不能将两个枚举混为一个“已注册 Article thread”。生成器的 Doc 条件须校验来源同源且 coverage / parity 自动检查，不能用人手维护的第二份 thread 清单。
