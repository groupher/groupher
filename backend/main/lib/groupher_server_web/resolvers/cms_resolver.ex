defmodule GroupherServerWeb.Resolvers.CMS do
  @moduledoc """
  Absinthe resolver boundary for CMS-facing queries and mutations.

  This module keeps GraphQL concerns at the edge: it unpacks typed arguments,
  reads authenticated viewer context when present, and delegates domain work to
  `GroupherServer.CMS` modules. It should not own persistence rules.

      GraphQL field
          |
          v
      Resolvers.CMS
          |
          +--> CMS.Communities / CMS.Articles / CMS.DocTree
          +--> CMS.DocCover / CMS.Dashboard / CMS.Comments

  The resolver layer is also where public API terms such as article/comment
  paths are translated into backend calls. Keep internal database ids and public
  path contracts separate here.
  """

  import ShortMaps
  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, FrontDesk}

  alias Accounts.Model.User
  alias CMS.Helper.{ArticlePath, EmotionFormatter}
  alias CMS.Model.{Author, Category, Community, CoverEditInfo}
  alias Helper.{OgInfo, ORM}

  require CMS.Const

  # #######################
  # community ..
  # #######################
  def community(_root, %{slug: slug, inc_views: inc_views}, %{context: %{cur_user: user}}) do
    CMS.Communities.read(slug, user, inc_views: inc_views)
  end

  def community(_root, %{slug: slug, inc_views: inc_views}, _info) do
    CMS.Communities.read(slug, inc_views: inc_views)
  end

  def paged_communities(_root, ~m(filter)a, %{context: %{cur_user: user}}) do
    CMS.Communities.paged(filter, user)
  end

  def paged_communities(_root, ~m(filter)a, _info) do
    CMS.Communities.paged(filter)
  end

  def paged_community_assets(_root, %{community: %Community{} = community} = args, _info) do
    CMS.Assets.page(community, Map.get(args, :filter))
  end

  def community_asset_refs(
        _root,
        %{community: %Community{} = community, asset_id: asset_id} = args,
        _info
      ) do
    CMS.Assets.refs(community, asset_id, Map.get(args, :filter))
  end

  def community_asset_usage(_root, %{community: %Community{} = community}, _info) do
    CMS.Assets.usage(community)
  end

  def register_community_asset(_root, %{community: %Community{} = community, asset: asset}, %{
        context: %{cur_user: user}
      }) do
    CMS.Assets.register(community, asset, user)
  end

  def delete_community_asset(_root, %{community: %Community{} = community, id: id}, _info) do
    CMS.Assets.delete(community, id)
  end

  def create_community(_root, args, %{context: %{cur_user: user}}) do
    CMS.Communities.create(args, user)
  end

  def update_community(_root, %{community: community} = args, _info) do
    CMS.Communities.update(community, args)
  end

  def update_dashboard(_root, %{community: community, dsb_section: _key} = args, _info) do
    CMS.Dashboard.update(community, args)
  end

  def update_dashboard_wallpaper(_root, %{community: community, wallpaper: wallpaper}, _info) do
    CMS.Dashboard.update(community, :wallpaper, wallpaper)
  end

  def save_custom_theme_preset(_root, %{community: community} = args, _info) do
    CMS.Dashboard.save_custom_theme_preset(community, args)
  end

  def select_theme_preset(_root, %{community: community} = args, _info) do
    CMS.Dashboard.select_theme_preset(community, args)
  end

  def doc_tree(_root, %{community: %Community{} = community}, _info) do
    CMS.DocTree.read(community)
  end

  def doc_tree(_root, %{community: community}, _info) do
    with {:ok, community} <- CMS.Communities.read(community, inc_views: false) do
      CMS.DocTree.read(community)
    end
  end

  def doc_public_tree(_root, %{community: %Community{} = community}, _info) do
    CMS.DocTree.read_public(community)
  end

  def doc_public_tree(_root, %{community: community}, _info) do
    with {:ok, community} <- CMS.Communities.read(community, inc_views: false) do
      CMS.DocTree.read_public(community)
    end
  end

  def doc_tree_trash_items(_root, %{community: %Community{} = community}, _info) do
    CMS.DocTree.trash_items(community)
  end

  def doc_tree_trash_items(_root, %{community: community}, _info) do
    with {:ok, community} <- CMS.Communities.read(community, inc_views: false) do
      CMS.DocTree.trash_items(community)
    end
  end

  def doc_cover(_root, %{community: %Community{} = community} = args, _info) do
    CMS.DocCover.read(community, doc_cover_view(args))
  end

  def doc_cover(_root, %{community: community} = args, _info) do
    with {:ok, community} <- CMS.Communities.read(community, inc_views: false) do
      CMS.DocCover.read(community, doc_cover_view(args))
    end
  end

  def doc_draft(_root, %{community: %Community{} = community, id: doc_id}, _info) do
    CMS.Articles.read_doc_editor(community, doc_id)
  end

  def doc_draft(_root, %{community: community, id: doc_id}, _info) do
    with {:ok, community} <- CMS.Communities.read(community, inc_views: false) do
      CMS.Articles.read_doc_editor(community, doc_id)
    end
  end

  def doc_draft_snapshots(_root, %{community: %Community{} = community, id: doc_id} = args, _info) do
    opts =
      args
      |> Map.take([:stage, :limit])
      |> Enum.to_list()

    CMS.Articles.list_doc_draft_snapshots(community, doc_id, opts)
  end

  def doc_draft_snapshots(_root, %{community: community} = args, _info) do
    with {:ok, community} <- CMS.Communities.read(community, inc_views: false) do
      doc_draft_snapshots(nil, Map.put(args, :community, community), nil)
    end
  end

  def doc_draft_snapshot(
        _root,
        %{community: %Community{} = community, id: doc_id, snapshot_id: snapshot_id},
        _info
      ) do
    CMS.Articles.get_doc_draft_snapshot(community, doc_id, snapshot_id)
  end

  def doc_draft_snapshot(_root, %{community: community} = args, _info) do
    with {:ok, community} <- CMS.Communities.read(community, inc_views: false) do
      doc_draft_snapshot(nil, Map.put(args, :community, community), nil)
    end
  end

  def create_doc_tree_tab(_root, %{community: community, input: input} = args, _info) do
    CMS.DocTree.create_tab(
      community,
      input |> Map.put(:base_revision, args[:base_revision]) |> with_doc_tree_actor(args)
    )
  end

  def create_doc_tree_group(_root, %{community: community, input: input} = args, _info) do
    CMS.DocTree.create_group(
      community,
      input |> Map.put(:base_revision, args[:base_revision]) |> with_doc_tree_actor(args)
    )
  end

  def create_doc_tree_page(
        _root,
        %{community: community, input: input} = args,
        %{context: %{cur_user: user}}
      ) do
    CMS.DocTree.create_page(
      community,
      input |> Map.put(:base_revision, args[:base_revision]) |> with_doc_tree_actor(args),
      user
    )
  end

  def create_doc_tree_link(_root, %{community: community, input: input} = args, _info) do
    CMS.DocTree.create_link(
      community,
      input |> Map.put(:base_revision, args[:base_revision]) |> with_doc_tree_actor(args)
    )
  end

  def create_doc_tree_pin(_root, %{community: community, input: input} = args, _info) do
    CMS.DocTree.create_pin(
      community,
      input |> Map.put(:base_revision, args[:base_revision]) |> with_doc_tree_actor(args)
    )
  end

  def update_doc_tree_node(
        _root,
        %{community: community, id: id, patch: patch} = args,
        _info
      ) do
    CMS.DocTree.update_node(
      community,
      id,
      patch |> Map.put(:base_revision, args[:base_revision]) |> with_doc_tree_actor(args)
    )
  end

  def update_doc_draft(
        _root,
        %{community: community, id: doc_id, cur_user: user} = args,
        _info
      ) do
    CMS.DocTree.update_draft(
      community,
      doc_id,
      Map.take(args, [:title, :subtitle, :slug, :body_bag]),
      user
    )
  end

  def checkpoint_doc_draft_snapshot(
        _root,
        %{community: community, id: doc_id, cur_user: user},
        _info
      ) do
    CMS.Articles.checkpoint_doc_draft_snapshot(community, doc_id, user)
  end

  def checkpoint_doc_draft_snapshot(_root, %{community: community, id: doc_id}, _info) do
    CMS.Articles.checkpoint_doc_draft_snapshot(community, doc_id)
  end

  def restore_doc_draft_snapshot(
        _root,
        %{community: community, id: doc_id, snapshot_id: snapshot_id, cur_user: user},
        _info
      ) do
    CMS.Articles.restore_doc_draft_snapshot(community, doc_id, snapshot_id, user)
  end

  def restore_doc_draft_snapshot(
        _root,
        %{community: community, id: doc_id, snapshot_id: snapshot_id},
        _info
      ) do
    CMS.Articles.restore_doc_draft_snapshot(community, doc_id, snapshot_id)
  end

  def doc_publish_checklist(_root, %{community: community}, _info) do
    {:ok, CMS.DocTree.publish_checklist(community)}
  end

  def publish_doc_changes(
        _root,
        %{community: community, cur_user: user} = args,
        _info
      ) do
    input = Map.get(args, :input) || %{}
    sync_cover? = publish_with_cover_sync?(args)

    CMS.DocTree.publish_changes(community, input, user, sync_cover: sync_cover?)
  end

  defp doc_cover_view(args), do: Map.get(args, :view) || :public

  defp publish_with_cover_sync?(args),
    do: (Map.get(args, :mode) || :with_cover_sync) == :with_cover_sync

  defp with_doc_tree_actor(attrs, %{cur_user: %{id: user_id}}),
    do: Map.put(attrs, :actor_id, user_id)

  defp with_doc_tree_actor(attrs, _args), do: attrs

  def move_doc_to_draft(_root, %{community: community, id: id, cur_user: user}, _info) do
    with {:ok, draft} <- CMS.DocTree.move_doc_to_draft(community, id, user) do
      {:ok,
       %{
         doc_id: draft.article_hash_id,
         stage: draft.stage,
         publish_state: %{
           status: CMS.Const.stage(:draft),
           published: true,
           published_before: true,
           has_draft: true,
           public_doc_id: draft.article_hash_id,
           has_unpublished_changes: false
         }
       }}
    end
  end

  def move_doc_tree_group_to_draft(_root, %{community: community, group_id: group_id}, _info) do
    CMS.DocTree.move_group_to_draft(community, group_id)
  end

  def add_doc_cover_group(_root, %{community: community, group_id: group_id}, _info) do
    CMS.DocCover.add_group(community, group_id)
  end

  def remove_doc_cover_group(_root, %{community: community, group_id: group_id}, _info) do
    CMS.DocCover.remove_group(community, group_id)
  end

  def set_doc_cover_item_hidden(
        _root,
        %{community: community, node_id: node_id, hidden: hidden},
        _info
      ) do
    CMS.DocCover.set_item_hidden(community, node_id, hidden)
  end

  def reorder_doc_cover_groups(_root, %{community: community, ids: ids}, _info) do
    CMS.DocCover.reorder_groups(community, ids)
  end

  def reorder_doc_cover_items(
        _root,
        %{community: community, cover_group_id: cover_group_id, ids: ids},
        _info
      ) do
    CMS.DocCover.reorder_items(community, cover_group_id, ids)
  end

  def update_doc_cover_group_ui_config(
        _root,
        %{community: community, id: id, ui_config: ui_config},
        _info
      ) do
    CMS.DocCover.update_group_ui_config(community, id, ui_config)
  end

  def update_doc_cover_item_ui_config(
        _root,
        %{community: community, id: id, ui_config: ui_config},
        _info
      ) do
    CMS.DocCover.update_item_ui_config(community, id, ui_config)
  end

  def pin_doc_cover_item(_root, %{community: community, node_id: node_id} = args, _info) do
    CMS.DocCover.pin_item(community, node_id, Map.get(args, :ui_config, %{}))
  end

  def unpin_doc_cover_item(_root, %{community: community, node_id: node_id}, _info) do
    CMS.DocCover.unpin_item(community, node_id)
  end

  def update_doc_cover_pinned_ui_config(
        _root,
        %{community: community, node_id: node_id, ui_config: ui_config},
        _info
      ) do
    CMS.DocCover.update_pinned_ui_config(community, node_id, ui_config)
  end

  def delete_doc_tree_node(_root, %{community: community, id: id} = args, _info) do
    CMS.DocTree.delete_node(
      community,
      id,
      %{base_revision: args[:base_revision]} |> with_doc_tree_actor(args)
    )
  end

  def restore_doc_tree_trash_item(_root, %{community: community, id: id} = args, _info) do
    CMS.DocTree.restore_trash_item(
      community,
      id,
      %{base_revision: args[:base_revision]} |> with_doc_tree_actor(args)
    )
  end

  def duplicate_doc_tree_node(_root, %{community: community, id: id} = args, _info) do
    CMS.DocTree.duplicate_node(
      community,
      id,
      %{base_revision: args[:base_revision]} |> with_doc_tree_actor(args)
    )
  end

  def move_doc_tree_node(_root, %{community: community, id: id} = args, _info) do
    CMS.DocTree.move_node(
      community,
      id,
      %{
        base_revision: args[:base_revision],
        target_tab_id: args[:target_tab_id],
        target_group_id: args[:target_group_id],
        target_index: args.target_index
      }
      |> with_doc_tree_actor(args)
    )
  end

  def open_graph_info(_root, %{url: url}, _info), do: OgInfo.get(url)

  def delete_community(_root, %{community: community}, _info) do
    Community |> ORM.find_delete!(community.id)
  end

  def apply_community(_root, args, %{context: %{cur_user: user}}) do
    CMS.Communities.apply(args, user)
  end

  def approve_community_apply(_root, %{community: community}, _) do
    CMS.Communities.approve_apply(community)
  end

  def deny_community_apply(_root, %{community: community}, _) do
    CMS.Communities.deny_apply(community.id)
  end

  def community_exist?(_root, %{slug: slug}, _) do
    CMS.Communities.exist?(slug)
  end

  def has_pending_community_apply?(_root, _, %{context: %{cur_user: user}}) do
    CMS.Communities.has_pending_apply?(user)
  end

  def cover_edit_info(%{cover_edit_info_id: nil}, _, _), do: {:ok, nil}

  def cover_edit_info(
        %{
          __struct__: article_schema,
          id: article_id,
          author_id: author_id,
          cover_edit_info_id: cover_edit_info_id
        },
        _,
        %{
          context: %{cur_user: %User{id: user_id}}
        }
      ) do
    with {:ok, %Author{user_id: ^user_id}} <- ORM.find(Author, author_id),
         {:ok, _article} <-
           ORM.find_by(article_schema,
             id: article_id,
             author_id: author_id,
             cover_edit_info_id: cover_edit_info_id
           ),
         {:ok, cover_edit_info} <- ORM.find(CoverEditInfo, cover_edit_info_id) do
      {:ok, cover_edit_info}
    else
      _ -> {:ok, nil}
    end
  end

  def cover_edit_info(_, _, _), do: {:ok, nil}

  # #######################
  # community thread (post, job), login user should be logged
  # #######################
  def read_article(root, args, info), do: read_article(root, args, info, [])

  def read_article(_root, %{article: article_path}, info, opts) do
    with {:ok, article_path} <- ArticlePath.parse(article_path, opts) do
      do_read_article(article_path, info)
    end
  end

  def read_article(
        _root,
        %{community: community, thread: thread, article_inner_id: inner_id},
        info,
        _opts
      ) do
    do_read_article(%{community: community, thread: thread, inner_id: inner_id}, info)
  end

  def read_article(_root, %{community: community, thread: thread, id: inner_id}, info, _opts) do
    do_read_article(%{community: community, thread: thread, inner_id: inner_id}, info)
  end

  defp do_read_article(%{community: community, thread: thread, inner_id: inner_id}, %{
         context: %{cur_user: user}
       }) do
    with {:ok, community} <- FrontDesk.community(community) do
      CMS.Articles.read(community, thread, inner_id, user)
    end
  end

  defp do_read_article(%{community: community, thread: thread, inner_id: inner_id}, _info) do
    with {:ok, community} <- FrontDesk.community(community) do
      CMS.Articles.read(community, thread, inner_id)
    end
  end

  def set_post_cat(_root, %{article: article, cat: cat}, _info) do
    CMS.Articles.set_cat(article, cat)
  end

  def set_post_status(_root, %{article: article, status: status}, _info) do
    CMS.Articles.set_status(article, status)
  end

  def paged_articles(_root, ~m(thread filter)a, %{context: %{cur_user: user}}) do
    CMS.Articles.page(thread, filter, user)
  end

  def paged_articles(_root, ~m(thread filter)a, _info) do
    CMS.Articles.page(thread, filter)
  end

  def grouped_kanban_posts(_root, %{community: community}, _info) do
    CMS.Articles.grouped_kanban(community)
  end

  def paged_kanban_posts(_root, %{community: community, filter: filter}, _info) do
    CMS.Articles.paged_kanban(community, filter)
  end

  def paged_reports(_root, ~m(filter)a, _) do
    CMS.AbuseReports.paged_reports(filter)
  end

  @doc "Creates and immediately publishes a Post through the Post product boundary."
  def create_post(root, args, info), do: create_article(root, Map.put(args, :thread, :post), info)

  @doc "Creates and immediately publishes a Blog through the Blog product boundary."
  def create_blog(root, args, info), do: create_article(root, Map.put(args, :thread, :blog), info)

  @doc "Creates and immediately publishes a Changelog through its product boundary."
  def create_changelog(root, args, info) do
    create_article(root, Map.put(args, :thread, :changelog), info)
  end

  @doc "Creates a Post Draft without running official publish effects."
  def create_post_draft(root, args, info) do
    create_article_draft(root, Map.put(args, :thread, :post), info)
  end

  @doc "Creates a Blog Draft without running official publish effects."
  def create_blog_draft(root, args, info) do
    create_article_draft(root, Map.put(args, :thread, :blog), info)
  end

  @doc "Creates a Changelog Draft without running official publish effects."
  def create_changelog_draft(root, args, info) do
    create_article_draft(root, Map.put(args, :thread, :changelog), info)
  end

  @doc "Updates a Post Draft while keeping the current public Post unchanged."
  def update_post_draft(root, args, info) do
    update_article_draft(root, Map.put(args, :thread, :post), info)
  end

  @doc "Updates a Blog Draft while keeping the current public Blog unchanged."
  def update_blog_draft(root, args, info) do
    update_article_draft(root, Map.put(args, :thread, :blog), info)
  end

  @doc "Updates a Changelog Draft while keeping its current public version unchanged."
  def update_changelog_draft(root, args, info) do
    update_article_draft(root, Map.put(args, :thread, :changelog), info)
  end

  @doc "Publishes a Post Draft through the canonical Article Publish lifecycle."
  def publish_post_draft(root, args, info) do
    publish_article_draft(root, Map.put(args, :thread, :post), info)
  end

  @doc "Publishes a Blog Draft through the canonical Article Publish lifecycle."
  def publish_blog_draft(root, args, info) do
    publish_article_draft(root, Map.put(args, :thread, :blog), info)
  end

  @doc "Publishes a Changelog Draft through the canonical Article Publish lifecycle."
  def publish_changelog_draft(root, args, info) do
    publish_article_draft(root, Map.put(args, :thread, :changelog), info)
  end

  defp create_article(_root, ~m(community thread)a = args, %{context: %{cur_user: user}}) do
    CMS.Articles.create(community, thread, Map.put(args, :cur_user, user), user)
  end

  defp create_article_draft(
         _root,
         ~m(community thread)a = args,
         %{context: %{cur_user: user}}
       ) do
    CMS.Articles.create_draft(community, thread, Map.put(args, :cur_user, user), user)
  end

  defp update_article_draft(
         _root,
         %{community: community, thread: thread, id: article_hash_id} = args,
         %{context: %{cur_user: user}}
       ) do
    CMS.Articles.update_draft(
      community,
      thread,
      article_hash_id,
      args
      |> Map.drop([:community, :thread, :id, :passport_is_owner])
      |> Map.put(:cur_user, user),
      user
    )
  end

  defp publish_article_draft(
         _root,
         %{community: community, thread: thread, id: article_hash_id},
         %{context: %{cur_user: user}}
       ) do
    with {:ok, %{article: public_article}} <-
           CMS.Articles.publish_draft(community, thread, article_hash_id, user) do
      {:ok, public_article}
    end
  end

  def update_article(_root, %{article: article} = args, %{context: %{cur_user: user}}) do
    CMS.Articles.update(article, Map.put(args, :cur_user, user), user)
  end

  def update_article(_root, %{article: article} = args, _info) do
    CMS.Articles.update(article, args)
  end

  # #######################
  # article actions
  # #######################
  def trash_article(_root, %{article: article}, %{context: %{cur_user: user}}) do
    with {:ok, item} <- CMS.Articles.trash(article, user) do
      CMS.Articles.get_trashed(item.hash_id)
    end
  end

  def restore_trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread},
        %{context: %{cur_user: user}}
      ) do
    with {:ok, item} <- CMS.Articles.get_trashed(id),
         :ok <- verify_trash_scope(item, community, thread) do
      CMS.Articles.restore_trashed(item, user)
    end
  end

  def permanently_delete_trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread},
        %{context: %{cur_user: user}}
      ) do
    with {:ok, item} <- CMS.Articles.get_trashed(id),
         :ok <- verify_trash_scope(item, community, thread) do
      CMS.Articles.permanently_delete_trashed(item, user)
    end
  end

  def permanently_delete_trash_action(
        _root,
        %{id: id, community: %Community{} = community, thread: thread},
        %{context: %{cur_user: user}}
      ) do
    with {:ok, action} <- CMS.Trash.get_action(id),
         true <- action.community_id == community.id,
         {:ok, ^thread} <- CMS.Trash.action_thread(action) do
      CMS.Trash.permanently_delete_action(action, user)
    else
      _ -> {:error, {:not_exist, "TrashAction"}}
    end
  end

  def trashed_articles(
        _root,
        %{community: %Community{} = community, thread: thread} = args,
        _info
      ) do
    filter = (Map.get(args, :filter) || %{}) |> Map.put(:thread, thread)
    CMS.Articles.list_trashed(community, filter)
  end

  def trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread},
        _info
      ) do
    with {:ok, item} <- CMS.Articles.get_trashed(id),
         :ok <- verify_trash_scope(item, community, thread) do
      {:ok, item}
    end
  end

  def cms_audit_logs(_root, %{community: %Community{} = community} = args, _info) do
    CMS.Audit.list(community, Map.get(args, :filter) || %{})
  end

  def trashed_article_mentioned_by(item, args, _info) do
    CMS.ArtimentMentions.mentioned_by(item.thread, item.article.id, Map.get(args, :filter))
  end

  def trashed_article_mentions(item, args, _info) do
    CMS.ArtimentMentions.mentions(item.thread, item.article.id, Map.get(args, :filter))
  end

  def pin_article(_root, ~m(article article_path)a, _info) do
    with {:ok, community} <- article_path_community(article_path) do
      CMS.Articles.pin(community, article)
    end
  end

  def undo_pin_article(_root, ~m(article article_path)a, _info) do
    with {:ok, community} <- article_path_community(article_path) do
      CMS.Articles.undo_pin(community, article)
    end
  end

  defp verify_trash_scope(item, %Community{} = community, thread) do
    if item.community_id == community.id and item.thread == thread do
      :ok
    else
      {:error, {:not_exist, "TrashedArticle"}}
    end
  end

  def report_article(_root, ~m(article reason attr)a, %{context: %{cur_user: user}}) do
    CMS.AbuseReports.article(article, reason, attr, user)
  end

  def undo_report_article(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.AbuseReports.undo_article(article, user)
  end

  def mentions(_root, %{source: source} = args, _info) do
    with {:ok, {type, id}} <- resolve_mention_source(source) do
      CMS.ArtimentMentions.mentions(type, id, Map.get(args, :filter))
    end
  end

  def mentioned_by(_root, %{target: target} = args, _info) do
    with {:ok, {type, id}} <- resolve_mention_target(target) do
      CMS.ArtimentMentions.mentioned_by(type, id, Map.get(args, :filter))
    end
  end

  # #######################
  # thread reaction ..
  # #######################
  def lock_article_comments(_root, ~m(article)a, _info),
    do: CMS.Articles.lock_comments(article)

  def undo_lock_article_comments(_root, ~m(article)a, _info) do
    CMS.Articles.undo_lock_comments(article)
  end

  def sink_article(_root, ~m(article)a, _info), do: CMS.Articles.sink(article)
  def undo_sink_article(_root, ~m(article)a, _info), do: CMS.Articles.undo_sink(article)

  def upvote_article(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.Articles.upvote(article, user)
  end

  def undo_upvote_article(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.Articles.undo_upvote(article, user)
  end

  def upvoted_users(_root, ~m(article filter)a, _info) do
    CMS.Articles.upvoted_users(article, filter)
  end

  def collected_users(_root, ~m(article filter)a, _info) do
    CMS.Articles.collected_users(article, filter)
  end

  def emotion_to_article(_root, ~m(article emotion)a, %{context: %{cur_user: user}}) do
    CMS.Articles.emotion(article, emotion, user)
  end

  def undo_emotion_to_article(_root, ~m(article emotion)a, %{context: %{cur_user: user}}) do
    CMS.Articles.undo_emotion(article, emotion, user)
  end

  # #######################
  # category ..
  # #######################
  def paged_categories(_root, ~m(filter)a, _info), do: Category |> ORM.find_all(filter)

  def create_category(_root, ~m(community title slug)a, %{context: %{cur_user: user}}) do
    CMS.Communities.create_category(%{community: community, title: title, slug: slug}, user)
  end

  def delete_category(_root, %{community: community, id: id}, _info) do
    CMS.Communities.delete_category(community, id)
  end

  def update_category(_root, ~m(community id title)a, %{context: %{cur_user: _}}) do
    CMS.Communities.update_category(community, ~m(%Category id title)a)
  end

  def set_category(_root, ~m(community category_id)a, %{context: %{cur_user: _}}) do
    CMS.Communities.set_category(community, %Category{id: category_id})
  end

  def unset_category(_root, ~m(community category_id)a, %{context: %{cur_user: _}}) do
    CMS.Communities.unset_category(community, %Category{id: category_id})
  end

  # #######################
  # moderators ..
  # #######################
  def all_passport_rules(_root, _, _) do
    with {:ok, rules} <- CMS.Communities.all_passport_rules() do
      {:ok,
       %{
         root: Jason.encode!(rules.root),
         moderator: Jason.encode!(rules.moderator)
       }}
    end
  end

  def add_moderator(_root, ~m(community user)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.add_moderator(community, user, cur_user)
  end

  def add_moderators(_root, ~m(community users)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.add_moderators(community, users, cur_user)
  end

  def remove_moderator(_root, ~m(community user)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.remove_moderator(community, user, cur_user)
  end

  def update_moderator_passport(_root, ~m(community user rules)a, %{
        context: %{cur_user: cur_user}
      }) do
    CMS.Communities.update_moderator_passport(community, rules, user, cur_user)
  end

  def paged_community_moderators(_root, ~m(community filter)a, _info) do
    CMS.Communities.members(:moderators, %Community{slug: community}, filter)
  end

  # #######################
  # tags ..
  # #######################
  def create_community_tag(_root, %{thread: thread, community: community} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.Communities.create_tag(%Community{slug: community}, thread, args, user)
  end

  def create_community_tag_group(_root, %{thread: thread, community: community} = args, _info) do
    CMS.Communities.create_tag_group(%Community{slug: community}, thread, args)
  end

  def update_community_tag(_root, %{id: id} = args, _info) do
    CMS.Communities.update_tag(id, args)
  end

  def update_community_tag_group(
        _root,
        %{id: id, thread: thread, community: community} = args,
        _info
      ) do
    CMS.Communities.update_tag_group(%Community{slug: community}, thread, id, args)
  end

  def delete_community_tag_group(_root, %{id: id, thread: thread, community: community}, _info) do
    CMS.Communities.delete_tag_group(%Community{slug: community}, thread, id)
  end

  def delete_community_tag(_root, %{id: id}, _info) do
    CMS.Communities.delete_tag(id)
  end

  def set_community_tag(_root, ~m(article community_tag_id)a, _info) do
    CMS.Communities.set_tag(article, community_tag_id)
  end

  def unset_community_tag(_root, ~m(article community_tag_id)a, _info) do
    CMS.Communities.unset_tag(article, community_tag_id)
  end

  def community_tag_groups(_root, ~m(community thread)a, _info) do
    CMS.Communities.tag_groups(~m(community thread)a)
  end

  def community_tag_stats(_root, ~m(community thread slug)a, _info) do
    CMS.Communities.tag_stats(community, thread, slug)
  end

  def community_tag_stats(root, _args, _info) do
    CMS.Communities.tag_stats(root)
  end

  def community_tag_group_title(%{tag_group: %{title: title}}, _args, _info), do: {:ok, title}

  def community_tag_group_title(%{group: group}, _args, _info) when is_binary(group),
    do: {:ok, group}

  def community_tag_group_title(%{group_id: group_id}, _args, _info) when not is_nil(group_id) do
    case Helper.ORM.find(GroupherServer.CMS.Model.CommunityTagGroup, group_id) do
      {:ok, group} -> {:ok, group.title}
      _ -> {:ok, nil}
    end
  end

  def community_tag_group_title(_, _args, _info), do: {:ok, nil}

  def reindex_community_tags(_root, ~m(community thread group_id tags)a, _info) do
    with {:ok, _} <- CMS.Communities.reindex_tags(community, thread, group_id, tags) do
      {:ok, %{done: true}}
    end
  end

  def reindex_community_tags_across_groups(_root, ~m(community thread tags)a, _info) do
    with {:ok, _} <- CMS.Communities.reindex_tags(community, thread, tags) do
      {:ok, %{done: true}}
    end
  end

  def reindex_community_tag_groups(_root, ~m(community thread groups)a, _info) do
    with {:ok, _} <- CMS.Communities.reindex_tag_groups(community, thread, groups) do
      {:ok, %{done: true}}
    end
  end

  # #######################
  # community subscribe ..
  # #######################
  def subscribe_community(_root, ~m(community)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.subscribe(community, cur_user)
  end

  def unsubscribe_community(_root, ~m(community)a, %{context: %{cur_user: cur_user}}) do
    with {:ok, unsubscribed_community} <- CMS.Communities.unsubscribe(community, cur_user) do
      {:ok, unsubscribed_community}
    end
  end

  def paged_community_subscribers(_root, ~m(community filter)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.members(:subscribers, %Community{slug: community}, filter, cur_user)
  end

  def paged_community_subscribers(_root, ~m(community filter)a, _info) do
    CMS.Communities.members(:subscribers, %Community{slug: community}, filter)
  end

  def paged_community_subscribers(_root, _args, _info), do: {:error, "invalid args"}

  def mirror_article(_root, ~m(target_community article community_tags)a, _info) do
    CMS.Articles.mirror(target_community, article, community_tags)
  end

  def unmirror_article(_root, ~m(target_community article)a, _info) do
    CMS.Articles.unmirror(target_community, article)
  end

  def move_article(_root, ~m(target_community article community_tags)a, _info) do
    CMS.Articles.move(target_community, article, community_tags)
  end

  def mirror_to_home(_root, ~m(target_community article community_tags)a, _info) do
    CMS.Articles.mirror_to_home(target_community, article, community_tags)
  end

  def move_to_blackhole(_root, ~m(target_community article community_tags)a, _info) do
    CMS.Articles.move_to_blackhole(target_community, article, community_tags)
  end

  # #######################
  # comments ..
  # #######################
  def comments_state(_root, %{article: article, article_path: %{thread: thread}}, %{
        context: %{cur_user: user}
      }) do
    CMS.Comments.comments_state(thread, article.id, user)
  end

  def comments_state(_root, %{article: article, article_path: %{thread: thread}}, _) do
    CMS.Comments.comments_state(thread, article.id)
  end

  def one_comment(_root, %{comment: comment}, %{context: %{cur_user: user}}) do
    CMS.Comments.one_comment(comment, user)
  end

  def one_comment(_root, %{comment: comment}, _) do
    CMS.Comments.one_comment(comment)
  end

  def paged_comments(
        _root,
        %{article: article, article_path: %{thread: thread}, filter: filter, mode: mode},
        %{context: %{cur_user: user}}
      ) do
    CMS.Comments.paged_comments(thread, article.id, filter, mode, user)
  end

  def paged_comments(
        _root,
        %{article: article, article_path: %{thread: thread}, filter: filter, mode: mode},
        _info
      ) do
    CMS.Comments.paged_comments(thread, article.id, filter, mode)
  end

  def paged_comments_participants(
        _root,
        %{article: article, article_path: %{thread: thread}, filter: filter},
        _info
      ) do
    CMS.Comments.paged_comments_participants(thread, article.id, filter)
  end

  def create_comment(_root, %{article: article, article_path: %{thread: thread}, body: body}, %{
        context: %{cur_user: user}
      }) do
    CMS.Comments.create_comment(thread, article, body, user)
  end

  def update_comment(_root, ~m(body comment)a, _info) do
    CMS.Comments.update_comment(comment, body)
  end

  def delete_comment(_root, ~m(comment)a, _info) do
    CMS.Comments.delete_comment(comment)
  end

  def reply_comment(_root, %{comment: comment, body: body}, %{context: %{cur_user: user}}) do
    CMS.Comments.reply_comment(comment.id, body, user)
  end

  def upvote_comment(_root, %{comment: comment}, %{context: %{cur_user: user}}) do
    CMS.Comments.upvote_comment(comment.id, user)
  end

  def undo_upvote_comment(_root, %{comment: comment}, %{context: %{cur_user: user}}) do
    CMS.Comments.undo_upvote_comment(comment.id, user)
  end

  def report_comment(_root, ~m(comment reason attr)a, %{context: %{cur_user: user}}) do
    CMS.AbuseReports.comment(comment, reason, attr, user)
  end

  def undo_report_comment(_root, ~m(comment)a, %{context: %{cur_user: user}}) do
    CMS.AbuseReports.undo_comment(comment, user)
  end

  def emotion_to_comment(_root, %{comment: comment, emotion: emotion}, %{
        context: %{cur_user: user}
      }) do
    CMS.Comments.emotion_to_comment(comment.id, emotion, user)
  end

  def undo_emotion_to_comment(_root, %{comment: comment, emotion: emotion}, %{
        context: %{cur_user: user}
      }) do
    CMS.Comments.undo_emotion_to_comment(comment.id, emotion, user)
  end

  def mark_comment_solution(_root, %{comment: comment}, %{context: %{cur_user: user}}) do
    CMS.Comments.mark_comment_solution(comment.id, user)
  end

  def undo_mark_comment_solution(_root, %{comment: comment}, %{context: %{cur_user: user}}) do
    CMS.Comments.undo_mark_comment_solution(comment.id, user)
  end

  def pin_comment(_root, ~m(comment)a, _info), do: CMS.Comments.pin_comment(comment.id)

  def undo_pin_comment(_root, ~m(comment)a, _info), do: CMS.Comments.undo_pin_comment(comment.id)

  def emotions(%{thread: _} = root, _args, _info) do
    {:ok, EmotionFormatter.format(root, :comment)}
  end

  def emotions(root, _args, _info) do
    {:ok, EmotionFormatter.format(root, :article)}
  end

  def comment_inner_id(%{inner_id: inner_id}, _args, _info) when not is_nil(inner_id),
    do: {:ok, inner_id}

  def comment_inner_id(_comment, _args, _info), do: {:ok, nil}

  defp resolve_article_path(article_path) do
    with {:ok, %{thread: thread} = article_path} <-
           ArticlePath.parse(article_path),
         {:ok, article} <- CMS.FrontDesk.article(article_path) do
      {:ok, {thread, article}}
    end
  end

  defp resolve_mention_source(source) do
    with {:ok, key, value} <- one_of_input(source, [:article, :comment], "mention source") do
      case key do
        :article ->
          with {:ok, {thread, article}} <- resolve_article_path(value) do
            {:ok, {thread, article.id}}
          end

        :comment ->
          with {:ok, comment} <- resolve_comment_path(value) do
            {:ok, {:comment, comment.id}}
          end
      end
    end
  end

  defp resolve_mention_target(target) do
    with {:ok, key, value} <-
           one_of_input(target, [:article, :comment, :user_login], "mention target") do
      case key do
        :article ->
          with {:ok, {thread, article}} <- resolve_article_path(value) do
            {:ok, {thread, article.id}}
          end

        :comment ->
          with {:ok, comment} <- resolve_comment_path(value) do
            {:ok, {:comment, comment.id}}
          end

        :user_login ->
          with {:ok, user} <- FrontDesk.user(value) do
            {:ok, {:user, user.id}}
          end
      end
    end
  end

  defp resolve_comment_path(%{article: _article_path} = comment_path) do
    CMS.FrontDesk.comment(comment_path)
  end

  defp one_of_input(input, keys, label) do
    present_keys =
      keys
      |> Enum.filter(fn key -> not is_nil(Map.get(input, key)) end)

    case present_keys do
      [key] -> {:ok, key, Map.get(input, key)}
      [] -> {:error, "missing #{label}"}
      _ -> {:error, "ambiguous #{label}"}
    end
  end

  ############
  ############
  ############
  def paged_comment_replies(_root, %{comment: comment, filter: filter}, %{
        context: %{cur_user: user}
      }) do
    CMS.Comments.paged_comment_replies(comment.id, filter, user)
  end

  def paged_comment_replies(_root, %{comment: comment, filter: filter}, _info) do
    CMS.Comments.paged_comment_replies(comment.id, filter)
  end

  # #######################
  # sync github content ..
  # #######################
  def search_communities(_root, %{title: title, category: category}, %{context: %{cur_user: user}}) do
    CMS.Search.community(title, category, user)
  end

  def search_communities(_root, %{title: title, category: category}, _info) do
    CMS.Search.community(title, category)
  end

  def search_communities(_root, %{title: title}, %{context: %{cur_user: user}}) do
    CMS.Search.community(title, user)
  end

  def search_communities(_root, %{title: title}, _info) do
    CMS.Search.community(title)
  end

  def search_artiments(_root, %{query: query}, _info), do: CMS.SearchArtiments.search(query)

  # ##############################################
  # counts just for managers to use in admin site ..
  # ##############################################
  def community_tags_count(root, _, _),
    do: CMS.Communities.count(%Community{id: root.id}, :community_tags)

  defp article_path_community(%{community: %Community{} = community}), do: {:ok, community}

  defp article_path_community(%{community: community}) when is_binary(community) do
    CMS.FrontDesk.community(community)
  end

  defp article_path_community(_), do: {:error, "invalid article input"}
end
