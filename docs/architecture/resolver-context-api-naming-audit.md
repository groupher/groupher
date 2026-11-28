# Resolver 调用的 Context 接口命名盘点

2026-11-26 命名审计时的工作树静态快照（包含当时未提交的 OAuth 改动）。除下文已标明切换的首批接口外，新名字仍是提案；清单中的旧名称保留作为迁移前基线。

下表 CMS 和 Accounts 根接口已切换为候选名称，并同步 resolver 和本地 fixture；原 Elixir 名称不保留别名。GraphQL 字段、持久化命令类型和 Receipt 身份保持原合同。下方完整清单中未提出候选的名称，以及优先处理的内部边界，仍需另行评审。

用 Elixir AST 读取 resolver 目录全部 34 个文件，按别名展开直接调用、管道和显式 batch 回调。9 个业务根模块（含项目级 FrontDesk）共 368 个不同的模块、函数、元数组合。另列 schema 目录中可静态识别的项目调用，包含字段 helper 和编译期定义。未展开宏或运行时 Dataloader，数量不代表 GraphQL 字段总数。

## 约定与建议

首批用例与拟议命令见[本地 seed 工具箱](local-seed-toolkit.md)。

现行[后端 Context 约定](backend-context-convention-over-configuration.md)要求 Web 等外部调用方使用 Context 根 facade，并明确用能力前缀避免冲突。[多入口架构](cms-multi-entry-boundary.md)规定不同适配器共用同一个领域用例。seed、API 和 MCP 也应遵守根边界。根 FrontDesk 用来解析稳定引用。分页、错误匹配和协议转换各自保有独立职责。

建议修订命名约定后，业务用例采用动词开头、对象反映实际基数的名称。分页、请求状态、资源范围和其他会改变语义的限定词必须保留。同名候选要在整个 Context（含已有重载、默认参数）查冲突。命名可读性和调用权限分别审查，根函数的存在本身不构成对外授权。

## 候选名称与覆盖范围

重新对照 34 个 resolver 的静态调用与下方清单，368 个根接口签名一致。下表为 80 个函数名（82 个 resolver 调用签名）提出候选，覆盖 seed 首批映射中的全部 9 个 CMS 接口，以及 resolver 用到的社区管理员和文章协作者两组接口。元数列举当前 resolver 调用；同名根函数的其他重载随实施一起检查。候选名称已核对同一根模块源码中的显式函数定义与本表其他候选，未发现同名占用。

| 所属根模块与当前函数                                   | 候选名（同一模块）                          |
| ------------------------------------------------------ | ------------------------------------------- |
| **社区、分类和标签**                                   |                                             |
| `CMS.communities_create/3`                             | `create_community`                          |
| `CMS.communities_update/4`                             | `update_community`                          |
| `CMS.communities_request_destroy/3`                    | `request_community_destruction`             |
| `CMS.communities_fetch/2, /3`                          | `fetch_community`                           |
| `CMS.communities_paged/3`                              | `page_communities`                          |
| `CMS.communities_categories/0`                         | `list_community_categories`                 |
| `CMS.communities_check_name/1`                         | `check_community_slug_availability`         |
| `CMS.communities_create_category/3`                    | `create_community_category`                 |
| `CMS.communities_update_category/4`                    | `update_community_category`                 |
| `CMS.communities_delete_category/4`                    | `delete_community_category`                 |
| `CMS.communities_set_category/4`                       | `assign_community_category`                 |
| `CMS.communities_unset_category/4`                     | `unassign_community_category`               |
| `CMS.communities_create_tag/5`                         | `create_community_tag`                      |
| `CMS.communities_update_tag/4`                         | `update_community_tag`                      |
| `CMS.communities_delete_tag/3`                         | `delete_community_tag`                      |
| `CMS.communities_set_tag/4`                            | `tag_article`                               |
| `CMS.communities_unset_tag/4`                          | `untag_article`                             |
| `CMS.communities_create_tag_group/5`                   | `create_community_tag_group`                |
| `CMS.communities_update_tag_group/6`                   | `update_community_tag_group`                |
| `CMS.communities_delete_tag_group/5`                   | `delete_community_tag_group`                |
| `CMS.communities_tag_groups/1`                         | `list_community_tag_groups`                 |
| `CMS.communities_tag_stats/1, /3`                      | `get_community_tag_stats`                   |
| `CMS.communities_reindex_tag_groups/5`                 | `reindex_community_tag_groups`              |
| `CMS.communities_reindex_tags_in_group/6`              | `reindex_tags_in_group`                     |
| `CMS.communities_reindex_tags_across_groups/5`         | `reindex_tags_across_groups`                |
| `CMS.communities_subscribe/3`                          | `subscribe_to_community`                    |
| `CMS.communities_unsubscribe/3`                        | `unsubscribe_from_community`                |
| **社区管理员**                                         |                                             |
| `CMS.communities_admins_candidates/3`                  | `search_community_admin_candidates`         |
| `CMS.communities_admins_page/3`                        | `page_community_admins`                     |
| `CMS.communities_admins_members/4`                     | `page_community_admin_memberships`          |
| `CMS.communities_admins_requests/3`                    | `page_community_admin_requests`             |
| `CMS.communities_admins_create/6`                      | `create_community_admin_request`            |
| `CMS.communities_admins_decide/6`                      | `decide_community_admin_request`            |
| `CMS.communities_admins_cancel/4`                      | `cancel_community_admin_request`            |
| `CMS.communities_admins_update_permissions/6`          | `update_community_admin_permissions`        |
| `CMS.communities_admins_remove/5`                      | `remove_community_admin`                    |
| `CMS.communities_admins_leave/4`                       | `leave_community_admin_role`                |
| `CMS.communities_admins_current/2`                     | `get_current_community_admin_membership`    |
| `CMS.communities_admins_management_allowed/2`          | `check_community_admin_management_access`   |
| **文章协作者**                                         |                                             |
| `CMS.articles_co_authors_candidates/3`                 | `search_article_co_author_candidates`       |
| `CMS.articles_co_authors_members/3`                    | `page_article_co_authors`                   |
| `CMS.articles_co_authors_requests/3`                   | `page_article_co_author_requests`           |
| `CMS.articles_co_authors_permissions/2`                | `get_current_article_co_author_permissions` |
| `CMS.articles_co_authors_create_request/6`             | `create_article_co_author_request`          |
| `CMS.articles_co_authors_decide_request/6`             | `decide_article_co_author_request`          |
| `CMS.articles_co_authors_cancel_request/4`             | `cancel_article_co_author_request`          |
| `CMS.articles_co_authors_update_permissions/6`         | `update_article_co_author_permissions`      |
| `CMS.articles_co_authors_remove_member/5`              | `remove_article_co_author`                  |
| `CMS.articles_co_authors_leave_member/4`               | `leave_article_co_author_role`              |
| `CMS.articles_co_authors_reject_working_copy_access/2` | `reject_co_author_working_copy_access`      |
| **文章、主题、资产**                                   |                                             |
| `CMS.articles_create_article/5`                        | `create_article`                            |
| `CMS.articles_create_and_publish_article/5`            | `create_and_publish_article`                |
| `CMS.articles_publish_article/7`                       | `publish_article`                           |
| `CMS.articles_save_working_copy/8`                     | `save_article_working_copy`                 |
| `CMS.articles_delete_working_copy/5`                   | `delete_article_working_copy`               |
| `CMS.articles_fork_snapshot/7`                         | `fork_article_snapshot`                     |
| `CMS.dashboard_save_custom_theme_preset/4`             | `save_custom_theme_preset`                  |
| `CMS.dashboard_select_theme_preset/4`                  | `select_theme_preset`                       |
| `CMS.assets_page/3`                                    | `page_community_assets`                     |
| `CMS.assets_refs/4`                                    | `page_asset_references`                     |
| `CMS.assets_register_to_community/4`                   | `register_community_asset`                  |
| `CMS.assets_create_upload_intent/3`                    | `create_community_asset_upload_intent`      |
| `CMS.assets_complete_upload/1`                         | `complete_asset_upload`                     |
| `CMS.assets_delete/4`                                  | `delete_community_asset`                    |
| `CMS.wallpaper_prepare_upload/3`                       | `prepare_wallpaper_upload`                  |
| `CMS.wallpaper_publish/3`                              | `publish_wallpaper`                         |
| `CMS.wallpaper_restore_snapshot/3`                     | `restore_wallpaper_snapshot`                |
| **账号、会话、关注和收藏**                             |                                             |
| `Accounts.profiles_paged_users/3`                      | `page_users`                                |
| `Accounts.profiles_update_profile/2`                   | `update_profile`                            |
| `Accounts.profiles_revoke_browser_session/1`           | `revoke_browser_session`                    |
| `Accounts.profiles_unlink_oauth_identity/2`            | `unlink_oauth_identity`                     |
| `Accounts.profiles_complete_oauth_registration/3`      | `complete_oauth_registration`               |
| `Accounts.fans_follow/2`                               | `follow_user`                               |
| `Accounts.fans_undo_follow/2`                          | `unfollow_user`                             |
| `Accounts.fans_paged_followers/4`                      | `page_followers`                            |
| `Accounts.fans_paged_followings/4`                     | `page_followed_users`                       |
| `Accounts.collect_folders_create/2`                    | `create_collect_folder`                     |
| `Accounts.collect_folders_update/2`                    | `update_collect_folder`                     |
| `Accounts.collect_folders_delete/1`                    | `delete_collect_folder`                     |
| `Accounts.upvotes_paged_articles/3`                    | `page_upvoted_articles`                     |

**命名依据。** 创建管理员或协作者请求均可表示邀请或申请；决定请求可接受或拒绝，所以公开名保留 `request` 和 `decide`。授予成员资格、移除指定成员、当前成员主动退出是三个不同动作。社区销毁请求可能进入待处理状态，因此候选名保留 `request`。

**其余接口的评审状态。** 下方全量清单中未列候选的接口仍可按 resolver 定位。Activity 已有的 `list_community_logs`、`export_community_logs` 等动词式名称，以及 AlertWall 的 `submit_report`、`withdraw_report` 建议保留。其余按用例评审，尤其注意：

- `CMS.communities_members` 支持按类型读取订阅者或管理员，`CMS.communities_count` 按类型取计数。直接命名为 `page_subscribers` 或 `count_communities` 会改变读者对对象的理解。
- Docs 的 `*_preview` 与执行操作、Tickets 的 `*_internal` 与 `*_public`、Article 的 `*_receipt` 与结果投影需要成对审核。ErrorCat 错误构造、Auth 错误合同单独保留其协议语义。
- FrontDesk 的稳定引用读取、Messaging 的单条或批量已读、ReviewBot 的授权与配置选择，需要先确认读取范围或业务入口；Analysis 的趋势和统计名称要保留过滤与汇总维度。未提候选的接口尚未定名。

## 优先处理的边界

- 社区回收站的 resolver 直接调用 CommunityHide、CommunityRestore 和 CommunityTrashQuery，并在 resolver 内检查权限和 thread。先把完整的隐藏、恢复和读取用例收进 CMS；保留 actor、revision、command ID、授权与失败语义。仅给 execute 加一层委托仍会遗漏前置条件。见[回收站 resolver](../../backend/api/lib/groupher_server_web/resolvers/cms/community_trash.ex)。
- Import resolver 直接使用 Jobs 和 Staging，另有经 CMS 的 apply/preview。逐项确认作业的用户或服务身份与归属，再把准备、查询、暂存、失败与取消接到 CMS 的具体用例。见[Import resolver](../../backend/api/lib/groupher_server_web/resolvers/import_resolver.ex)。
- 标签组标题使用 Absinthe batch 指向 CMS.Communities；保留批量读取，为 batch 提供根入口。ReviewBot 配置读取虽只调用根模块，授权、读取和按 scope 选择结果却由 resolver 串联，应作为一个可供其他入口使用的用例评审。外部 OpenGraph 查询直调 Helper.OgInfo，也需确定负责该能力的公共入口。
- schema 内联字段也属于调用面。Comment 的 body 和 version 在未预加载时直接 Repo.get_by；主题和第三方分析字段使用 Dashboard 内部模块。把业务读行为收回其所属 Context，保留已有预加载、返回空值及错误语义。见[Comment 字段](../../backend/api/lib/groupher_server_web/schema/helper/fields.ex)与[CMS schema](../../backend/api/lib/groupher_server_web/schema/cms/spec.ex)。
- 现有[resolver 检查](../../scripts/check-resolver-boundary.mjs)按行匹配部分禁用模式，扫描范围止于 resolvers/；后续规则应覆盖 alias 展开、batch 回调和 schema 内联业务调用，并保留 ErrorCat pattern、struct 与 transport helper 的合法使用。

建议按社区和成员权限做首批，使用上表候选核对运行时导出和实际调用方。迁移前枚举 resolver 以外的调用方，特别是后台 job、Make/Mix 和已有 fixture。所选用例核对输入、鉴权、写后结果、拒绝和同 command ID 的恢复；改 Elixir 函数名不自动改 GraphQL 字段、持久化 command 类型或 Receipt 身份。

## 当前调用清单

业务根模块的不同签名数：Accounts 45、Activity 6、AlertWall 12、Analysis 11、Auth 3、CMS 277、FrontDesk 7、Messaging 3、ReviewBot 4。文件按目录排序；同一文件内的重复调用只列一次。

### [accounts/mailbox.ex](../../backend/api/lib/groupher_server_web/resolvers/accounts/mailbox.ex)

- `Accounts`　`mailbox_status/1`
- `Messaging`　`mark_read/3`、`mark_read_all/2`、`paged_messages/4`
- `Pagi`　`from_input/1`

### [accounts/profile_view_tracker.ex](../../backend/api/lib/groupher_server_web/resolvers/accounts/profile_view_tracker.ex)

- `Accounts`　`profile_view_tracker_track/4`

### [accounts/profiles.ex](../../backend/api/lib/groupher_server_web/resolvers/accounts/profiles.ex)

- `Accounts`　`achievements_paged_administered_communities/2`、`profiles_default_community_suggestions/0`、`profiles_error_cat_account_login/1`、`profiles_paged_users/3`、`profiles_subscribed_communities/3`、`profiles_update_profile/2`、`profiles_user/1`、`profiles_user/2`、`publish_paged_articles/5`、`publish_paged_comments/5`、`search_user/1`
- `Pagi`　`from_input/1`

### [accounts/relationships.ex](../../backend/api/lib/groupher_server_web/resolvers/accounts/relationships.ex)

- `Accounts`　`collect_folders_add_result/4`、`collect_folders_create/2`、`collect_folders_delete/1`、`collect_folders_paged/4`、`collect_folders_paged_articles/4`、`collect_folders_remove_result/4`、`collect_folders_update/2`、`fans_follow/2`、`fans_paged_followers/4`、`fans_paged_followings/4`、`fans_undo_follow/2`、`upvotes_paged_articles/3`
- `Pagi`　`from_input/1`

### [accounts/sessions.ex](../../backend/api/lib/groupher_server_web/resolvers/accounts/sessions.ex)

- `Accounts`　`oauth_link_cancel/3`、`oauth_link_claim/5`、`oauth_link_confirm/5`、`oauth_link_start/2`、`oauth_link_summary/3`、`oauth_link_verified/4`、`oauth_provider_list/0`、`oauth_registration_summary/1`、`profiles_complete_oauth_registration/3`、`profiles_error_cat_account_blocked/1`、`profiles_error_cat_current_session/1`、`profiles_error_cat_invalid_browser_access_claims/1`、`profiles_error_cat_session_expired/1`、`profiles_error_cat_session_revoked/1`、`profiles_error_cat_session_unavailable/1`、`profiles_linked_oauth_accounts/1`、`profiles_revoke_browser_session/1`、`profiles_session_state/1`、`profiles_signin_oauth/4`、`profiles_unlink_oauth_identity/2`
- `Accounts.Profiles.ErrorCat`　`error_pattern/1`
- `Auth`　`contract_service_token_invalid/0`、`contract_session_revoked/0`、`contract_token_invalid/0`
- `CMS`　`production_seed_redeem_login/2`
- `GroupherServerWeb.ErrorCat`　`invalid_service_token/1`、`service_auth/1`

### [alert_wall.ex](../../backend/api/lib/groupher_server_web/resolvers/alert_wall.ex)

- `AlertWall`　`active_report_count/1`、`invalid_report_error/0`、`item/2`、`item_not_found_error/0`、`item_reports/3`、`list_items/4`、`my_reports/3`、`reported_count/1`、`resolve_item/5`、`submit_report/5`、`total_report_count/1`、`withdraw_report/3`
- `CMS`　`passport_error_cat_permission_denied/0`
- `FrontDesk`　`article/2`、`comment/2`、`community/2`、`community/3`、`user/2`

### [cms/activity.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/activity.ex)

- `Activity`　`export_community_logs/4`、`get_community_log_config/2`、`get_community_log_event/3`、`get_community_log_stats/4`、`list_article_logs/3`、`list_community_logs/5`
- `Pagi`　`from_input/1`

### [cms/analysis.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/analysis.ex)

- `Analysis`　`article_insights_trend_by_public_filter/3`、`web_active_for_dashboard/1`、`web_summary/2`、`web_tracking_website_id/1`、`web_trend_environment/3`、`web_trend_location/3`、`web_trend_pages/3`、`web_trend_sources/3`、`web_trend_traffic/2`、`web_trends_overview/2`、`web_visitor_location_map/1`

### [cms/article_co_authors.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/article_co_authors.ex)

- `CMS`　`articles_co_authors_cancel_request/4`、`articles_co_authors_candidates/3`、`articles_co_authors_create_request/6`、`articles_co_authors_decide_request/6`、`articles_co_authors_leave_member/4`、`articles_co_authors_members/3`、`articles_co_authors_permissions/2`、`articles_co_authors_remove_member/5`、`articles_co_authors_requests/3`、`articles_co_authors_update_permissions/6`

### [cms/article_stats.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/article_stats.ex)

- `CMS`　`article_stats_read_public/3`

### [cms/articles.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/articles.ex)

- `CMS`　`article_public_head_conflict/0`、`articles_co_authors_reject_working_copy_access/2`、`articles_cover_edit_info/2`、`articles_create_and_publish_article/5`、`articles_create_article/5`、`articles_delete_working_copy/5`、`articles_fork_snapshot/7`、`articles_get_trashed/4`、`articles_history_diff/4`、`articles_history_event/4`、`articles_history_events/3`、`articles_list_trashed/4`、`articles_mirror/6`、`articles_move/6`、`articles_page/4`、`articles_permanently_delete_trashed_receipt/3`、`articles_pin/4`、`articles_publish_article/7`、`articles_restore_trashed_receipt/3`、`articles_save_working_copy/8`、`articles_set_cat_result/4`、`articles_sink_result/3`、`articles_snapshots/2`、`articles_trash_receipt/3`、`articles_undo_pin/4`、`articles_undo_sink_result/3`、`articles_unmirror/4`、`articles_working_copies/2`、`articles_working_copy_access_check/4`、`front_desk_article/2`、`front_desk_article_snapshot/4`、`gate_error_cat_resource_not_found/0`、`parse_article_path/2`、`trash_permanently_delete_action_in_scope/5`
- `FrontDesk`　`article/2`、`community/1`
- `GroupherServerWeb.ErrorCat`　`service_scope_forbidden/1`
- `GroupherServerWeb.Resolvers.CMS.HistoryOrigin`　`from_context/1`
- `Pagi`　`from_input/1`

### [cms/artiment_mentions.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/artiment_mentions.ex)

- `CMS`　`mentioned_by/3`、`mentions/3`、`mentions_graph_article_comments/4`、`mentions_graph_page/4`、`mentions_graph_revision/2`
- `Pagi`　`from_input/2`

### [cms/artiment_status.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/artiment_status.ex)

- `CMS`　`artiment_status/2`

### [cms/assets.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/assets.ex)

- `CMS`　`assets_complete_upload/1`、`assets_create_upload_intent/3`、`assets_delete/4`、`assets_origin_info/1`、`assets_page/3`、`assets_refs/4`、`assets_register_to_community/4`、`assets_stats/2`、`assets_usage/1`、`wallpaper_batch_published?/1`
- `CMS.Assets.ErrorCat`　`error_pattern/1`
- `Pagi`　`from_input/1`

### [cms/command_payload.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/command_payload.ex)

未发现静态限定的项目模块调用。

### [cms/comments.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/comments.ex)

- `CMS`　`articles_lock_comments_result/3`、`articles_undo_lock_comments_result/3`、`comments_accept_solution/3`、`comments_comments_state/4`、`comments_create_comment_result/5`、`comments_delete_comment_result/4`、`comments_mentioned_comment/3`、`comments_one_comment/1`、`comments_one_comment/2`、`comments_page/7`、`comments_paged_comments_participants/4`、`comments_pin_comment/3`、`comments_reconcile_states/3`、`comments_reply_comment_result/5`、`comments_reply_page/5`、`comments_revoke_solution/3`、`comments_undo_pin_comment/3`、`comments_update_comment_result/6`、`comments_viewer_states/3`、`front_desk_community/1`、`interactions_emotion_result/4`、`interactions_undo_emotion_result/4`、`interactions_undo_upvote_result/3`、`interactions_upvote_result/3`
- `Pagi`　`from_input/1`

### [cms/communities.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/communities.ex)

- `CMS`　`communities_categories/0`、`communities_check_name/1`、`communities_count/2`、`communities_create/3`、`communities_create_category/3`、`communities_create_tag/5`、`communities_create_tag_group/5`、`communities_delete_category/4`、`communities_delete_tag/3`、`communities_delete_tag_group/5`、`communities_fetch/2`、`communities_fetch/3`、`communities_members/5`、`communities_paged/3`、`communities_reindex_tag_groups/5`、`communities_reindex_tags_across_groups/5`、`communities_reindex_tags_in_group/6`、`communities_request_destroy/3`、`communities_set_category/4`、`communities_set_tag/4`、`communities_subscribe/3`、`communities_tag_groups/1`、`communities_tag_stats/1`、`communities_tag_stats/3`、`communities_unset_category/4`、`communities_unset_tag/4`、`communities_unsubscribe/3`、`communities_update/4`、`communities_update_category/4`、`communities_update_tag/4`、`communities_update_tag_group/6`、`front_desk_community/2`
- `CMS.Communities`　`tag_group_titles/2`
- `Pagi`　`from_input/1`

### [cms/community_admins.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/community_admins.ex)

- `CMS`　`communities_admins_cancel/4`、`communities_admins_candidates/3`、`communities_admins_create/6`、`communities_admins_current/2`、`communities_admins_decide/6`、`communities_admins_leave/4`、`communities_admins_management_allowed/2`、`communities_admins_members/4`、`communities_admins_page/3`、`communities_admins_remove/5`、`communities_admins_requests/3`、`communities_admins_update_permissions/6`
- `Pagi`　`from_input/1`

### [cms/community_applications.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/community_applications.ex)

- `CMS`　`community_applications_applicant/1`、`community_applications_application_community/1`、`community_applications_approve/5`、`community_applications_cancel/4`、`community_applications_complete_logo_upload/1`、`community_applications_create_logo_upload_intent/2`、`community_applications_event_actor/1`、`community_applications_events/2`、`community_applications_get_owned/2`、`community_applications_logo/1`、`community_applications_logo_origin/1`、`community_applications_reject/5`、`community_applications_retry_creation/4`、`community_applications_retry_setup/4`、`community_applications_review_detail/2`、`community_applications_review_queue_by_public_filter/3`、`community_applications_reviewer/1`、`community_applications_start_review/4`、`community_applications_state/1`、`community_applications_submit/3`
- `CMS.ErrorCat`　`error_pattern/1`
- `ErrorCat`　`code/1`、`custom/0`

### [cms/community_trash.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/community_trash.ex)

- `CMS`　`articles_error_cat_unsupported_community_trash_thread/0`、`front_desk_community/3`、`gate_error_cat_resource_not_found/0`、`passport_allowed?/4`、`passport_community_scope/2`
- `CMS.Articles.Commands.CommunityHide`　`execute/4`
- `CMS.Articles.Commands.CommunityRestore`　`execute/6`
- `CMS.Articles.CommunityTrashQuery`　`article_thread_matches?/2`、`doc_members/5`、`get/4`、`page/4`
- `Pagi`　`from_input/1`

### [cms/dashboard.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/dashboard.ex)

- `CMS`　`dashboard_save_custom_theme_preset/4`、`dashboard_select_theme_preset/4`、`dashboard_update/4`、`dashboard_update/5`

### [cms/docs.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/docs.ex)

- `CMS`　`command_result_unavailable/0`、`communities_fetch/2`、`doc_cover_add_card/4`、`doc_cover_pin_doc/4`、`doc_cover_read/3`、`doc_cover_remove_card/4`、`doc_cover_reorder_cards/4`、`doc_cover_reorder_pinned_docs/4`、`doc_cover_unpin_doc/4`、`doc_cover_update_card_appearance/5`、`doc_cover_update_pinned_doc_appearance/5`、`doc_tree_read_public/1`、`docs_approval_diff/3`、`docs_approval_not_allowed/0`、`docs_approval_required/0`、`docs_approve_queue/4`、`docs_begin_edit/5`、`docs_configure_queue/6`、`docs_delete_diverged_tree/0`、`docs_delete_preview/5`、`docs_dequeue/6`、`docs_dequeue_preview/4`、`docs_discard_confirmation_required/0`、`docs_discard_confirmation_stale/0`、`docs_editor_read/3`、`docs_enqueue/5`、`docs_invalid_merge_choice/0`、`docs_post_publish_conflict/3`、`docs_publication_notices/2`、`docs_publication_read_unavailable/0`、`docs_publish_queue/2`、`docs_queue_copy_revision_conflict/0`、`docs_queue_member_read/3`、`docs_queue_merge/8`、`docs_queue_policy/2`、`docs_queue_preview/3`、`docs_queue_save/7`、`docs_queue_version_conflict/0`、`docs_release_detail/4`、`docs_release_history/3`、`docs_release_queue/4`、`docs_resolve_post_publish/8`、`docs_restore_node_conflict/0`、`docs_restore_snapshot/7`、`docs_self_approval_forbidden/0`、`docs_snapshot_history/4`、`docs_state_conflict/0`、`docs_trash_in_use/0`、`docs_trash_purge/5`、`docs_workspace_create/5`、`docs_workspace_delete/7`、`docs_workspace_duplicate/5`、`docs_workspace_move/7`、`docs_workspace_read/2`、`docs_workspace_restore/9`、`docs_workspace_update/6`

### [cms/history_origin.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/history_origin.ex)

未发现静态限定的项目模块调用。

### [cms/interactions.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/interactions.ex)

- `CMS`　`format_emotions/2`、`interactions_article_states_for_paths/2`、`interactions_collected_users/2`、`interactions_emotion_result/4`、`interactions_undo_emotion_result/4`、`interactions_undo_upvote_result/3`、`interactions_upvote_result/3`、`interactions_upvoted_users/2`
- `Pagi`　`from_input/1`

### [cms/open_graph.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/open_graph.ex)

- `Helper.OgInfo`　`get/1`

### [cms/passport.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/passport.ex)

- `CMS`　`passport_global_scope/1`

### [cms/press.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/press.ex)

- `CMS`　`parse_article_path/1`、`press_article/1`、`press_community_rss_feed/2`、`press_config/1`、`press_site_manifest/1`、`press_thread_rss_feed/3`、`press_update_config/4`

### [cms/review.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/review.ex)

- `CMS`　`articles_resolve_binding/2`、`current_review_for_scope/1`、`decide_review_target/5`、`invalid_review_block_error/0`、`passport_authorization_check/3`、`passport_error_cat_permission_denied/0`、`pending_artiment_reviews/3`、`recheck_review_target/4`、`review_decision_actions/0`、`review_history_for_scope/3`、`review_notice_for_author/2`
- `FrontDesk`　`article/2`、`comment/2`、`community/1`、`community/2`、`community/3`

### [cms/search.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/search.ex)

- `CMS`　`search_artiments_search/2`、`search_community/1`、`search_community/2`、`search_community/3`

### [cms/tickets.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/tickets.ex)

- `CMS`　`tickets_activity_internal/4`、`tickets_add_case_member/6`、`tickets_add_case_worker/6`、`tickets_add_update/9`、`tickets_create_case/4`、`tickets_create_from_post/5`、`tickets_create_worker/6`、`tickets_ensure_draft/5`、`tickets_get_internal/3`、`tickets_get_public/2`、`tickets_grouped_internal/4`、`tickets_grouped_public/2`、`tickets_link_source/7`、`tickets_linked_to_post_internal/3`、`tickets_move/7`、`tickets_move_to_draft/6`、`tickets_page_internal/4`、`tickets_page_public/3`、`tickets_post_progress/2`、`tickets_publish/9`、`tickets_remove_case_member/6`、`tickets_save_draft/7`、`tickets_search_internal/5`、`tickets_set_assignees/6`、`tickets_set_facets/6`、`tickets_set_tags/6`、`tickets_transition/6`、`tickets_unlink_source/6`、`tickets_update/6`

### [cms/view_tracker.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/view_tracker.ex)

- `CMS`　`view_tracker_track/4`、`view_tracker_viewer_states_for_paths/2`
- `FrontDesk`　`article/1`

### [cms/wallpaper.ex](../../backend/api/lib/groupher_server_web/resolvers/cms/wallpaper.ex)

- `CMS`　`wallpaper_prepare_upload/3`、`wallpaper_publish/3`、`wallpaper_restore_snapshot/3`

### [import_resolver.ex](../../backend/api/lib/groupher_server_web/resolvers/import_resolver.ex)

- `CMS`　`doc_tree_workflows_import_apply/2`、`gate_access_check/3`、`import_doc_validator_preview/3`
- `CMS.Import.Jobs`　`cancel/2`、`create/3`、`fail/4`、`get/3`
- `CMS.Import.Staging`　`stage/3`

### [review_bot.ex](../../backend/api/lib/groupher_server_web/resolvers/review_bot.ex)

- `CMS`　`passport_error_cat_permission_denied/0`
- `FrontDesk`　`community/2`
- `ReviewBot`　`authorize/3`、`configs/2`、`invalid_config_error/0`、`update_config/6`

## Schema 补充

以下包含 schema 定义阶段的枚举、类型辅助和字段投影，改名时先确认用途。

### [cms/cms_metrics.ex](../../backend/api/lib/groupher_server_web/schema/cms/cms_metrics.ex)

- `CMS`　`articles_query_order_values_ast/0`、`articles_query_sort_values_ast/0`、`artiment_const_cat_values_ast/0`、`artiment_const_status_values_ast/0`、`artiment_threads_values/0`、`comments_query_sort_values_ast/0`、`communities_query_sort_values_ast/0`

### [cms/cms_queries.ex](../../backend/api/lib/groupher_server_web/schema/cms/cms_queries.ex)

- `CMS.Dashboard.ThemePreset`　`options/0`
- `CMS.Dashboard.ThirdPartyAnalytics`　`providers/0`

### [cms/dashboard/enums.ex](../../backend/api/lib/groupher_server_web/schema/cms/dashboard/enums.ex)

- `CMS`　`dashboard_kanban_boards_values/0`

### [cms/review_mutations.ex](../../backend/api/lib/groupher_server_web/schema/cms/review_mutations.ex)

- `CMS`　`review_result_action_values_ast/0`

### [cms/spec.ex](../../backend/api/lib/groupher_server_web/schema/cms/spec.ex)

- `CMS`　`articles_body_document/1`、`articles_snapshot_tag_ids/1`、`articles_snapshot_thread_fields/1`、`articles_working_copy_tag_ids/1`、`articles_working_copy_thread_fields/1`、`marker_field/2`、`snapshot_member_ref_encode/1`、`wallpaper_wallpaper/1`、`wallpaper_wallpaper_history/2`、`wallpaper_wallpaper_settings/1`
- `CMS.Dashboard.ThemePreset`　`custom_base_preset/1`、`options/1`、`resolve/2`
- `CMS.Dashboard.ThirdPartyAnalytics`　`enabled_valid_configs/1`
- `Helper.ORM.Pagi.Page`　`info/1`

### [helper/fields.ex](../../backend/api/lib/groupher_server_web/schema/helper/fields.ex)

- `CMS`　`artiment_config_comment_emotions/0`、`artiment_config_emotions/0`、`artiment_config_threads/0`、`dashboard_fields_enum_values/1`、`dashboard_fields_macro_schema/1`、`dashboard_fields_rainbow_colors/0`、`dashboard_kanban_boards_values_list/0`、`error_cat_invalid_body/1`、`passport_actions/0`
- `Helper.ORM.Pagi.Page`　`info/1`
- `Repo`　`get_by/2`

### [helper/imports.ex](../../backend/api/lib/groupher_server_web/schema/helper/imports.ex)

- `CMS`　`artiment_config_threads/0`

### [helper/objects.ex](../../backend/api/lib/groupher_server_web/schema/helper/objects.ex)

- `CMS`　`artiment_config_threads/0`

### [helper/queries.ex](../../backend/api/lib/groupher_server_web/schema/helper/queries.ex)

- `CMS`　`artiment_config_threads/0`
