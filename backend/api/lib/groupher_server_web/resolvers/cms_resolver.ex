defmodule GroupherServerWeb.Resolvers.CMS do
  @moduledoc """
  Absinthe resolver boundary for CMS-facing queries and mutations.

  This module keeps GraphQL concerns at the edge: it unpacks typed arguments,
  reads authenticated viewer context when present, and delegates domain work to
  `GroupherServer.CMS` and adjacent platform contexts. It should not own
  persistence rules.

      GraphQL field
          |
          v
      Resolvers.CMS
          |
          +--> CMS.Communities / CMS.Articles / CMS.DocTree
          +--> CMS.DocCover / CMS.Dashboard / CMS.Comments
          +--> Analysis.Web

  The resolver layer is also where public API terms such as article/comment
  paths are translated into backend calls. Keep internal database ids and public
  path contracts separate here.
  """

  require GroupherServer.CMS.Assets.ErrorCat
  require GroupherServer.CMS.ErrorCat
  require GroupherServer.CMS.Const

  import ShortMaps
  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, Activity, Analysis, CMS, ErrorCat, FrontDesk, Repo}
  alias GroupherServerWeb.Resolvers.{ArticleInteractionPayload, ArticleStatsPayload}
  alias Analysis.Web, as: AnalysisWeb

  alias Accounts.Model.User
  alias CMS.Helper.{ArticlePath, EmotionFormatter}
  alias CMS.Assets.ErrorCat, as: AssetErrorCat
  alias CMS.ErrorCat, as: CmsErrorCat
  alias CMS.Model.{Author, Category, Comment, Community, DraftCoverEdit, RevisionCoverEdit}
  alias Helper.{OgInfo, ORM}

  @doc "Resolves the public command id from the internal receipt metadata on a domain result."
  def command_id(value, _args, _info), do: {:ok, Map.get(value, :command_id)}

  @doc "Records an explicit, visible public Article read."
  def track_article_view(_root, %{article: article_path}, info) do
    {viewer, actor_opts} = view_actor(info.context)

    with {:ok, classification} <- Map.fetch(info.context, :request_actor),
         {:ok, article} <- CMS.FrontDesk.article_for_view_tracking(article_path) do
      CMS.ViewTracker.track(
        article,
        viewer,
        classification,
        Keyword.put(actor_opts, :read_purpose, :public_read)
      )
    end
  end

  defp view_actor(%{delegated_actor: %{user_actor: viewer} = delegation}),
    do: {viewer, [delegation: delegation]}

  defp view_actor(%{service_actor: service}), do: {nil, [service_credential: service]}

  defp view_actor(%{service_auth_failure: _code}), do: {nil, []}

  defp view_actor(%{cur_user: viewer}), do: {viewer, []}

  defp view_actor(%{anonymous_session: session}),
    do: {nil, [anonymous_session: session]}

  defp view_actor(_context), do: {nil, []}

  @viewer_batch_size 100

  def article_logs(_root, %{article: article} = args, info) do
    actor = Map.get(info.context, :cur_user)
    filter = Map.get(args, :filter, %{})
    Activity.list_article_logs(article, actor, filter)
  end

  def article_insights(_root, %{article: article} = args, info) do
    viewer = Map.get(info.context, :cur_user)

    opts =
      [
        from: Map.get(args, :from),
        to: Map.get(args, :to),
        metrics: Map.get(args, :metrics),
        actor_types: Map.get(args, :actor_types),
        is_authenticated: Map.get(args, :is_authenticated),
        passport_granted_community_slugs:
          Analysis.ArticleInsights.passport_granted_community_slugs(viewer)
      ]
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)

    Analysis.ArticleInsights.trend(article, viewer, opts)
  end

  @doc "Reads one public ArticleStats batch after Article scope admission."
  def article_stats(
        _root,
        %{community: community, thread: thread, inner_ids: inner_ids},
        _info
      ) do
    CMS.FrontDesk.article_stats(community, thread, inner_ids)
  end

  def community_activity(_root, %{community: %Community{} = community} = args, info) do
    actor = Map.get(info.context, :cur_user)
    Activity.list_community_logs(community, actor, args.selection, args.page)
  end

  def community_activity_stats(
        _root,
        %{community: %Community{} = community, selection: selection},
        info
      ) do
    actor = Map.get(info.context, :cur_user)
    Activity.get_community_log_stats(community, actor, selection)
  end

  def community_activity_config(_root, %{community: %Community{} = community}, info) do
    Activity.get_community_log_config(community, Map.get(info.context, :cur_user))
  end

  def export_community_activity(
        _root,
        %{community: %Community{} = community, format: format} = args,
        info
      ) do
    Activity.export_community_logs(
      community,
      Map.get(info.context, :cur_user),
      args.selection,
      format
    )
  end

  def community_activity_event(
        _root,
        %{community: %Community{} = community, event_ref: event_ref},
        info
      ) do
    Activity.get_community_log_event(community, Map.get(info.context, :cur_user), event_ref)
  end

  # #######################
  # community ..
  # #######################
  def community_application_state(_root, _args, %{context: %{cur_user: user}}) do
    with {:ok, current} <- CMS.CommunityApplications.current(user),
         {:ok, latest_failed} <- CMS.CommunityApplications.latest_failed(user) do
      policy = CMS.CommunityApplications.can_apply(user)

      {:ok,
       %{
         can_apply: %{policy | reason_code: stringify(policy.reason_code)},
         current_application: current,
         latest_failed_application: latest_failed
       }}
    end
  end

  def community_application(_root, %{ref: public_ref}, %{context: %{cur_user: user}}) do
    CMS.CommunityApplications.get_owned(public_ref, user) |> application_result()
  end

  def review_community_application(_root, %{ref: public_ref}, %{
        context: %{cur_user: reviewer}
      }) do
    CMS.CommunityApplications.review_detail(public_ref, reviewer) |> application_result()
  end

  def paged_community_applications(_root, args, %{context: %{cur_user: reviewer}}) do
    filter =
      args
      |> Map.get(:filter, %{})
      |> Map.put(:first, Map.get(args, :first, 20))
      |> Map.put(:after, Map.get(args, :after))
      |> normalize_application_filter()

    case CMS.CommunityApplications.review_queue(filter, reviewer) do
      {:ok, page} -> {:ok, connection(page.entries, page.has_next_page, &application_cursor/1)}
      error -> application_result(error)
    end
  end

  def create_community_application_logo_upload_intent(
        _root,
        %{input: input},
        %{context: %{cur_user: user}}
      ) do
    CMS.CommunityApplications.create_logo_upload_intent(input, user) |> application_result()
  end

  def complete_community_application_logo_upload(_root, %{input: input}, _info) do
    CMS.CommunityApplications.complete_logo_upload(input) |> application_result()
  end

  def submit_community_application(
        _root,
        %{input: input, idempotency_key: idempotency_key},
        %{context: %{cur_user: user}}
      ) do
    CMS.CommunityApplications.submit(input, user, idempotency_key) |> application_result()
  end

  def cancel_community_application(
        _root,
        %{ref: public_ref, expected_version: expected_version},
        %{context: %{cur_user: user}}
      ) do
    CMS.CommunityApplications.cancel(public_ref, user, expected_version) |> application_result()
  end

  def start_community_application_review(
        _root,
        %{ref: public_ref, expected_version: expected_version},
        %{context: %{cur_user: reviewer}}
      ) do
    CMS.CommunityApplications.start_review(public_ref, reviewer, expected_version)
    |> application_result()
  end

  def approve_community_application(_root, args, %{context: %{cur_user: reviewer}}) do
    metadata = %{note: Map.get(args, :note)}

    CMS.CommunityApplications.approve(args.ref, reviewer, args.expected_version, metadata)
    |> application_result()
  end

  def reject_community_application(_root, args, %{context: %{cur_user: reviewer}}) do
    reason = %{reason_code: args.reason_code, note: Map.get(args, :note)}

    CMS.CommunityApplications.reject(args.ref, reviewer, args.expected_version, reason)
    |> application_result()
  end

  def retry_community_creation(_root, args, %{context: %{cur_user: reviewer}}) do
    CMS.CommunityApplications.retry_creation(args.ref, reviewer, args.expected_version)
    |> application_result()
  end

  def retry_community_setup(_root, args, %{context: %{cur_user: reviewer}}) do
    CMS.Communities.retry_setup(args.ref, reviewer, args.expected_version)
    |> application_result()
  end

  def community_application_logo(application, _args, _info),
    do: CMS.CommunityApplications.logo(application) |> application_result()

  def application_applicant(application, _args, _info),
    do: CMS.CommunityApplications.applicant(application) |> application_result()

  def application_reviewer(application, _args, _info),
    do: CMS.CommunityApplications.reviewer(application) |> application_result()

  def application_community(application, _args, _info),
    do: CMS.CommunityApplications.application_community(application) |> application_result()

  def community_application_events(application, args, _info) do
    case CMS.CommunityApplications.events(application, args) do
      {:ok, page} -> {:ok, connection(page.entries, page.has_next_page, &event_cursor/1)}
      error -> application_result(error)
    end
  end

  def application_actor_ref(actor, _args, _info), do: {:ok, actor.login}
  def application_community_ref(community, _args, _info), do: {:ok, community.slug}

  def application_job_error(%{last_job_error: nil}, _args, _info), do: {:ok, nil}

  def application_job_error(%{last_job_error: error}, _args, _info) do
    {:ok,
     %{
       reason_code: error["reason_code"],
       message: error["message"],
       operation_ref: error["operation_ref"],
       occurred_at: error["occurred_at"],
       attempt: error["attempt"]
     }}
  end

  def application_event_actor(event, _args, _info),
    do: CMS.CommunityApplications.event_actor(event) |> application_result()

  def community_application_logo_origin_info(_root, %{public_ref: public_ref}, _info),
    do: CMS.CommunityApplications.logo_origin(public_ref) |> application_result()

  def press_config(_root, %{community: community}, _info), do: CMS.Press.config(community)

  def update_press_config(_root, %{input: %{community: community} = input}, %{
        context: %{cur_user: actor}
      }) do
    input = Map.delete(input, :community)

    with {:ok, config} <- CMS.Press.update_config(community, input, actor) do
      {:ok, %{config: config}}
    end
  end

  def press_article(_root, %{article: article_path}, _info) do
    with {:ok, article_path} <- ArticlePath.parse(article_path) do
      CMS.Press.article(article_path)
    end
  end

  def press_community_rss_feed(_root, %{community: community, input: input}, _info),
    do: CMS.Press.community_rss_feed(community, input)

  def press_thread_rss_feed(
        _root,
        %{community: community, thread: thread, input: input},
        _info
      ),
      do: CMS.Press.thread_rss_feed(community, thread, input)

  def press_site_manifest(_root, %{community: community}, _info),
    do: CMS.Press.site_manifest(community)

  def community(_root, %{slug: slug, inc_views: inc_views}, %{context: %{cur_user: user}}) do
    CMS.Communities.fetch(slug, user, inc_views: inc_views)
  end

  def community(_root, %{slug: slug, inc_views: inc_views}, _info) do
    CMS.Communities.fetch(slug, inc_views: inc_views)
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

  def community_asset_stats(_root, %{community: %Community{} = community} = args, _info) do
    CMS.Assets.stats(community, Map.get(args, :filter))
  end

  def community_asset_origin_info(_root, %{public_ref: public_ref}, _info) do
    case CMS.Assets.origin_info(public_ref) do
      {:ok, asset} -> {:ok, asset}
      {:error, AssetErrorCat.error_pattern(reason: :not_exist)} -> {:ok, nil}
      {:error, reason} -> {:error, reason}
    end
  end

  def wallpaper_batch_published(_root, %{batch_ref: batch_ref}, _info) do
    {:ok, CMS.Wallpaper.batch_published?(batch_ref)}
  end

  def register_community_asset(_root, %{community: %Community{} = community, asset: asset}, %{
        context: %{cur_user: user}
      }) do
    CMS.Assets.register_to_community(community, asset, user)
  end

  def create_community_asset_upload_intent(
        _root,
        %{community: %Community{} = community, file: file},
        %{context: %{cur_user: user}}
      ) do
    CMS.Assets.create_upload_intent(community, file, user)
  end

  def complete_community_asset_upload(_root, %{input: input}, _info) do
    CMS.Assets.complete_upload(input)
  end

  def delete_community_asset(_root, %{community: %Community{} = community, id: id}, _info) do
    CMS.Assets.delete(community, id)
  end

  def create_community(_root, args, %{context: %{cur_user: user}}) do
    CMS.Communities.create(args, user)
  end

  def update_community(
        _root,
        %{community: community} = args,
        %{context: %{cur_user: user}}
      ) do
    CMS.Communities.update(community, args, user)
  end

  def update_dashboard(_root, %{community: community, dsb_section: _key} = args, _info) do
    CMS.Dashboard.update(community, args)
  end

  def publish_wallpaper(
        _root,
        %{community: %Community{} = community, input: input},
        %{context: %{cur_user: %User{} = user}}
      ) do
    CMS.Wallpaper.publish(community, input, user)
  end

  def update_dashboard_content_shadow(
        _root,
        %{community: %Community{} = community, enabled: enabled},
        _info
      ) do
    CMS.Dashboard.update(community, :content_shadow, enabled)
  end

  def prepare_wallpaper_upload(
        _root,
        %{community: %Community{} = community, input: input},
        %{context: %{cur_user: %User{} = user}}
      ) do
    CMS.Wallpaper.prepare_upload(community, input, user)
  end

  def restore_wallpaper_snapshot(
        _root,
        %{community: %Community{} = community, input: input},
        %{context: %{cur_user: %User{} = user}}
      ) do
    CMS.Wallpaper.restore_snapshot(community, input, user)
  end

  def save_custom_theme_preset(_root, %{community: community} = args, _info) do
    CMS.Dashboard.save_custom_theme_preset(community, args)
  end

  def select_theme_preset(_root, %{community: community} = args, _info) do
    CMS.Dashboard.select_theme_preset(community, args)
  end

  def doc_tree(_root, %{community: %Community{} = community}, %{context: %{cur_user: user}}) do
    CMS.DocTree.read(community, actor: user, policy_mode: :moderator_management)
  end

  def doc_tree(_root, %{community: community}, %{context: %{cur_user: user}}) do
    with {:ok, community} <- CMS.Communities.fetch(community, inc_views: false) do
      CMS.DocTree.read(community, actor: user, policy_mode: :moderator_management)
    end
  end

  def doc_public_tree(_root, %{community: %Community{} = community}, _info) do
    CMS.DocTree.read_public(community)
  end

  def doc_public_tree(_root, %{community: community}, _info) do
    with {:ok, community} <- CMS.Communities.fetch(community, inc_views: false) do
      CMS.DocTree.read_public(community)
    end
  end

  def doc_tree_trash_items(
        _root,
        %{community: %Community{} = community},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocTree.trash_items(community, actor: user, policy_mode: :moderator_management)
  end

  def doc_tree_trash_items(
        _root,
        %{community: community},
        %{context: %{cur_user: user}}
      ) do
    with {:ok, community} <- CMS.Communities.fetch(community, inc_views: false) do
      CMS.DocTree.trash_items(community, actor: user, policy_mode: :moderator_management)
    end
  end

  def doc_cover(
        _root,
        %{community: %Community{} = community} = args,
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.read(community, doc_cover_view(args), user)
  end

  def doc_cover(
        _root,
        %{community: community} = args,
        %{context: %{cur_user: user}}
      ) do
    with {:ok, community} <- CMS.Communities.fetch(community, inc_views: false) do
      CMS.DocCover.read(community, doc_cover_view(args), user)
    end
  end

  def doc_draft(
        _root,
        %{community: %Community{} = community, id: doc_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.Docs.read_editor_head(community, doc_id,
      actor: user,
      policy_mode: :moderator_management
    )
  end

  def doc_draft(
        _root,
        %{community: community, id: doc_id},
        %{context: %{cur_user: user}}
      ) do
    with {:ok, community} <- CMS.Communities.fetch(community, inc_views: false) do
      CMS.Docs.read_editor_head(community, doc_id,
        actor: user,
        policy_mode: :moderator_management
      )
    end
  end

  @doc "Lists immutable published versions for one stable Doc branch."
  def doc_branch_versions(_root, %{doc_id: doc_id, branch_id: branch_id} = args, _info) do
    with {:ok, branch_id} <- positive_integer_id(branch_id) do
      CMS.Docs.list_branch_versions(doc_id, branch_id, limit: Map.get(args, :limit, 30))
    end
  end

  @doc "Loads one immutable published version for a stable Doc branch."
  def doc_branch_version(
        _root,
        %{doc_id: doc_id, branch_id: branch_id, branch_version_id: branch_version_id},
        _info
      ) do
    with {:ok, branch_id} <- positive_integer_id(branch_id),
         {:ok, branch_version_id} <- positive_integer_id(branch_version_id) do
      CMS.Docs.get_branch_version(doc_id, branch_id, branch_version_id)
    end
  end

  @doc "Restores one immutable Doc Revision into its branch Draft workspace."
  def restore_doc_revision_to_draft(
        _root,
        %{doc_id: doc_id, branch_id: branch_id, revision_id: revision_id, cur_user: user} = args,
        _info
      ) do
    with {:ok, branch_id} <- positive_integer_id(branch_id) do
      opts =
        case args[:expected_version] do
          version when is_integer(version) -> [expected_version: version]
          _ -> []
        end

      CMS.Docs.restore_revision_to_draft(doc_id, branch_id, revision_id, user, opts)
    end
  end

  defp positive_integer_id(value) when is_integer(value) and value > 0, do: {:ok, value}

  defp positive_integer_id(value) when is_binary(value) do
    case Integer.parse(value) do
      {id, ""} when id > 0 -> {:ok, id}
      _ -> {:error, CmsErrorCat.custom("invalid id")}
    end
  end

  defp positive_integer_id(_value), do: {:error, CmsErrorCat.custom("invalid id")}

  def create_doc_tree_node(
        _root,
        %{community: community, input: input} = args,
        %{context: %{cur_user: user}}
      ) do
    CMS.DocTree.create_node(
      community,
      input
      |> Map.put(:parent_node_id, args[:parent_node_id])
      |> Map.put(:base_revision, args[:base_revision])
      |> Map.put(:command_id, args[:command_id])
      |> with_doc_tree_actor(args),
      user
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
      patch
      |> Map.put(:base_revision, args[:base_revision])
      |> Map.put(:command_id, args[:command_id])
      |> with_doc_tree_actor(args)
    )
  end

  def update_doc_draft(
        _root,
        %{
          community: community,
          article: %CMS.Model.Article{} = doc,
          branch_id: branch_id,
          cur_user: user
        } = args,
        _info
      ) do
    CMS.DocTree.update_draft(
      community,
      doc,
      args
      |> Map.take([:title, :subtitle, :slug, :body_bag, :expected_version, :command_id])
      |> Map.put(:branch_id, branch_id),
      user
    )
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

    CMS.DocTree.publish_changes(community, input, user,
      sync_cover: sync_cover?,
      command_id: args[:command_id]
    )
  end

  defp doc_cover_view(args), do: Map.get(args, :view) || :public

  defp publish_with_cover_sync?(args),
    do: (Map.get(args, :mode) || :with_cover_sync) == :with_cover_sync

  defp with_doc_tree_actor(attrs, %{cur_user: user} = _args),
    do: attrs |> Map.put(:actor_id, user.id) |> Map.put(:actor, user)

  defp with_doc_tree_actor(attrs, _args), do: attrs

  def move_doc_to_draft(_root, %{community: community, id: id, cur_user: user} = args, _info) do
    with {:ok, draft} <-
           CMS.DocTree.move_doc_to_draft(community, id, user, command_id: args[:command_id]) do
      {:ok,
       %{
         doc_id: draft.article_id,
         stage: draft.stage,
         publish_state: %{
           status: CMS.Const.stage(:draft),
           published: true,
           published_before: true,
           has_draft: true,
           public_doc_id: draft.article_id,
           has_unpublished_changes: false
         },
         command_id: Map.get(draft, :command_id)
       }}
    end
  end

  def move_doc_tree_subtree_to_draft(
        _root,
        %{community: community, node_id: node_id, cur_user: user} = args,
        _info
      ) do
    CMS.DocTree.move_subtree_to_draft(community, node_id, user, command_id: args[:command_id])
  end

  def add_doc_cover_card(
        _root,
        %{community: community, group_node_id: group_node_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.add_card(community, group_node_id, user)
  end

  def remove_doc_cover_card(
        _root,
        %{community: community, group_node_id: group_node_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.remove_card(community, group_node_id, user)
  end

  def reorder_doc_cover_cards(
        _root,
        %{community: community, ids: ids},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.reorder_cards(community, ids, user)
  end

  def update_doc_cover_card_appearance(
        _root,
        %{community: community, id: id, appearance: appearance},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.update_card_appearance(community, id, appearance, user)
  end

  def pin_doc_to_cover(
        _root,
        %{community: community, node_id: node_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.pin_doc(community, node_id, user)
  end

  def unpin_doc_from_cover(
        _root,
        %{community: community, node_id: node_id},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.unpin_doc(community, node_id, user)
  end

  def reorder_doc_cover_pinned_docs(
        _root,
        %{community: community, node_ids: node_ids},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.reorder_pinned_docs(community, node_ids, user)
  end

  def update_pinned_doc_appearance(
        _root,
        %{community: community, node_id: node_id, appearance: appearance},
        %{context: %{cur_user: user}}
      ) do
    CMS.DocCover.update_pinned_doc_appearance(community, node_id, appearance, user)
  end

  def delete_doc_tree_node(_root, %{community: community, id: id} = args, _info) do
    CMS.DocTree.delete_node(
      community,
      id,
      %{base_revision: args[:base_revision], command_id: args[:command_id]}
      |> with_doc_tree_actor(args)
    )
  end

  def restore_doc_tree_trash_item(_root, %{community: community, id: id} = args, _info) do
    CMS.DocTree.restore_trash_item(
      community,
      id,
      %{
        base_revision: args[:base_revision],
        command_id: args[:command_id],
        target_parent_node_id: args[:target_parent_node_id],
        target_index: args[:target_index]
      }
      |> with_doc_tree_actor(args)
    )
  end

  def duplicate_doc_tree_node(_root, %{community: community, id: id} = args, _info) do
    CMS.DocTree.duplicate_node(
      community,
      id,
      %{base_revision: args[:base_revision], command_id: args[:command_id]}
      |> with_doc_tree_actor(args)
    )
  end

  def move_doc_tree_node(_root, %{community: community, id: id} = args, _info) do
    CMS.DocTree.move_node(
      community,
      id,
      %{
        base_revision: args[:base_revision],
        command_id: args[:command_id],
        target_parent_node_id: args[:target_parent_node_id],
        target_index: args.target_index
      }
      |> with_doc_tree_actor(args)
    )
  end

  def open_graph_info(_root, %{url: url}, _info), do: OgInfo.get(url)

  def request_destroy_community(_root, %{community: %Community{} = community} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.Communities.request_destroy(community, user, command_id: args[:command_id])
  end

  def check_community_name(_root, %{slug: slug}, _info),
    do: CMS.Communities.check_name(slug)

  @doc "Returns version-owned cover editor state only to the Article author."
  def cover_edit_info(article, _, %{context: %{cur_user: %User{id: user_id}}}) do
    with author_id when not is_nil(author_id) <- Map.get(article, :author_id),
         {:ok, %Author{user_id: ^user_id}} <- ORM.find(Author, author_id),
         %{} = edit <- load_cover_edit(article) do
      {:ok, present_cover_edit(edit)}
    else
      _ -> {:ok, nil}
    end
  end

  def cover_edit_info(_, _, _), do: {:ok, nil}

  defp load_cover_edit(%{body_draft_id: body_draft_id}) when is_binary(body_draft_id),
    do: Repo.get(DraftCoverEdit, body_draft_id)

  defp load_cover_edit(%{revision_id: revision_id}) when is_binary(revision_id),
    do: Repo.get(RevisionCoverEdit, revision_id)

  defp load_cover_edit(_article), do: nil

  defp present_cover_edit(edit) do
    edit
    |> Map.from_struct()
    |> Map.put(:id, Map.get(edit, :body_draft_id) || Map.get(edit, :revision_id))
    |> Map.put(:light, %{
      background_id: edit.light_background_id,
      original_background_id: edit.light_original_background_id,
      images: edit.light_images
    })
    |> Map.put(:dark, %{
      background_id: edit.dark_background_id,
      original_background_id: edit.dark_original_background_id,
      images: edit.dark_images
    })
  end

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

  defp do_read_article(
         %{community: community, thread: thread, inner_id: inner_id},
         %{context: context}
       ) do
    article_path = %{community: community, thread: thread, inner_id: inner_id}
    FrontDesk.article(article_path, Map.get(context, :cur_user))
  end

  def set_post_cat(_root, %{article: article, cat: cat}, %{context: %{cur_user: user}}) do
    with {:ok, _} <- CMS.Articles.set_cat(article.id, cat, user),
         do: {:ok, Map.put(article, :cat, cat)}
  end

  def set_post_status(_root, %{article: article, status: status}, %{context: %{cur_user: user}}) do
    with {:ok, _} <- CMS.Articles.set_status(article.id, status, user),
         do: {:ok, Map.put(article, :status, status)}
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
    CMS.Articles.create(community, thread, Map.put(args, :cur_user, user), user,
      command_id: args[:command_id]
    )
  end

  defp create_article_draft(
         _root,
         ~m(community thread)a = args,
         %{context: %{cur_user: user}}
       ) do
    with {:ok, %{article: article, draft: draft}} <-
           CMS.Articles.create_stable_draft(
             community,
             thread,
             Map.put(args, :cur_user, user),
             user
           ) do
      {:ok, Map.put(Map.from_struct(draft), :article, article)}
    end
  end

  defp update_article_draft(
         _root,
         %{article: article} = args,
         %{context: %{cur_user: user}}
       ) do
    CMS.Articles.update_draft(
      article.id,
      args
      |> Map.drop([:community, :thread, :id, :article, :passport_is_owner])
      |> Map.put(:cur_user, user),
      user,
      expected_version: args[:expected_version]
    )
  end

  defp publish_article_draft(
         _root,
         %{community: community, thread: thread, article: article} = args,
         %{context: %{cur_user: user}}
       ) do
    with {:ok, %{article: published}} <-
           CMS.Articles.publish(article.id, user,
             expected_draft_version: args[:expected_version],
             expected_lifecycle_version: args[:expected_lifecycle_version],
             command_id: args[:command_id]
           ),
         {:ok, public_article} <-
           CMS.FrontDesk.article(%{
             community: community.slug,
             thread: thread,
             inner_id: published.inner_id
           }) do
      {:ok, public_article}
    end
  end

  def update_article(_root, %{article: article} = args, %{context: %{cur_user: user}}) do
    CMS.Articles.update(
      article,
      args |> Map.drop([:article, :command_id]) |> Map.put(:cur_user, user),
      user,
      args[:command_id]
    )
  end

  # #######################
  # article actions
  # #######################
  def trash_article(_root, %{article: article} = args, %{context: %{cur_user: user}}) do
    with {:ok, item} <- CMS.Articles.trash(article, user, command_id: args[:command_id]) do
      with {:ok, hydrated} <- CMS.Articles.get_trashed(item.hash_id) do
        {:ok,
         %{
           hydrated
           | command_id: Map.get(item, :command_id)
         }}
      end
    end
  end

  def restore_trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: user}}
      ) do
    command_id = args[:command_id]
    opts = [command_id: command_id, community_id: community.id, thread: thread]

    case CMS.Articles.get_trashed(id) do
      {:ok, item} ->
        with :ok <- verify_trash_scope(item, community, thread) do
          CMS.Articles.restore_trashed(item.hash_id, user, opts)
        end

      {:error, _reason} when is_binary(command_id) ->
        CMS.Articles.restore_trashed(id, user, opts)

      error ->
        error
    end
  end

  def permanently_delete_trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: user}}
      ) do
    command_id = args[:command_id]
    opts = [command_id: command_id, community_id: community.id, thread: thread]

    case CMS.Articles.get_trashed(id) do
      {:ok, item} ->
        with :ok <- verify_trash_scope(item, community, thread) do
          CMS.Articles.permanently_delete_trashed(item.hash_id, user, opts)
        end

      {:error, _reason} when is_binary(command_id) ->
        CMS.Articles.permanently_delete_trashed(id, user, opts)

      error ->
        error
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
      _ -> {:error, CMS.Articles.ErrorCat.not_exist("TrashAction")}
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

  def analysis_web_summary(_root, %{community: %Community{} = community} = args, _info) do
    AnalysisWeb.summary(community, args)
  end

  def analysis_tracking_website_id(_root, %{community: %Community{} = community}, _info) do
    AnalysisWeb.tracking_website_id(community)
  end

  def analysis_visitor_location_map(_root, %{community: %Community{} = community}, _info) do
    AnalysisWeb.visitor_location_map(community)
  end

  def analysis_trends_overview(_root, %{community: %Community{} = community} = args, _info) do
    AnalysisWeb.trends_overview(community, args)
  end

  def analysis_active_visitors(_root, %{community: %Community{} = community}, _info) do
    case AnalysisWeb.active(community) do
      {:ok, payload} -> {:ok, payload}
      {:error, _reason} -> {:ok, nil}
    end
  end

  def analysis_trend_pages(
        _root,
        %{community: %Community{} = community, dimension: dimension} = args,
        _info
      ) do
    AnalysisWeb.trend_pages(community, args, dimension)
  end

  def analysis_trend_sources(
        _root,
        %{community: %Community{} = community, dimension: dimension} = args,
        _info
      ) do
    AnalysisWeb.trend_sources(community, args, dimension)
  end

  def analysis_trend_environment(
        _root,
        %{community: %Community{} = community, dimension: dimension} = args,
        _info
      ) do
    AnalysisWeb.trend_environment(community, args, dimension)
  end

  def analysis_trend_location(
        _root,
        %{community: %Community{} = community, dimension: dimension} = args,
        _info
      ) do
    AnalysisWeb.trend_location(community, args, dimension)
  end

  def analysis_trend_traffic(_root, %{community: %Community{} = community} = args, _info) do
    AnalysisWeb.trend_traffic(community, args)
  end

  def trashed_article_mentioned_by(item, args, _info) do
    CMS.ArtimentMentions.mentioned_by(item.thread, item.article.id, Map.get(args, :filter))
  end

  def trashed_article_mentions(item, args, _info) do
    CMS.ArtimentMentions.mentions(item.thread, item.article.id, Map.get(args, :filter))
  end

  def pin_article(_root, ~m(article article_path)a, %{context: %{cur_user: user}}) do
    with {:ok, community} <- article_path_community(article_path) do
      CMS.Articles.pin(community, article.id, user)
    end
  end

  def undo_pin_article(_root, ~m(article article_path)a, %{context: %{cur_user: user}}) do
    with {:ok, community} <- article_path_community(article_path) do
      CMS.Articles.undo_pin(community, article.id, user)
    end
  end

  defp verify_trash_scope(item, %Community{} = community, thread) do
    if item.community_id == community.id and item.thread == thread do
      :ok
    else
      {:error, CMS.Articles.ErrorCat.not_exist("TrashedArticle")}
    end
  end

  def report_article(_root, ~m(article reason attr)a, %{context: %{cur_user: user}}) do
    CMS.Interactions.report(article, reason, attr, user) |> hydrate_report_interaction(user)
  end

  def undo_report_article(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.Interactions.undo_report(article, user) |> hydrate_report_interaction(user)
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
  def lock_article_comments(_root, ~m(article)a, %{context: %{cur_user: user}}),
    do: article_state_result(CMS.Articles.lock_comments(article.id, user), article)

  def undo_lock_article_comments(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    article_state_result(CMS.Articles.undo_lock_comments(article.id, user), article)
  end

  def sink_article(_root, ~m(article)a, %{context: %{cur_user: user}}),
    do:
      article_state_result(
        CMS.Articles.sink(article.id, user, branch_opts(article)),
        article
      )

  def undo_sink_article(_root, ~m(article)a, %{context: %{cur_user: user}}),
    do:
      article_state_result(
        CMS.Articles.undo_sink(article.id, user, branch_opts(article)),
        article
      )

  def upvote_article(_root, %{article: article} = args, %{context: %{cur_user: user}}) do
    CMS.Interactions.upvote(article, user, Map.get(args, :command_id))
    |> hydrate_interaction(user)
  end

  def undo_upvote_article(_root, %{article: article} = args, %{context: %{cur_user: user}}) do
    CMS.Interactions.undo_upvote(article, user, Map.get(args, :command_id))
    |> hydrate_interaction(user)
  end

  def upvoted_users(_root, ~m(article filter)a, _info) do
    CMS.Interactions.upvoted_users(article, filter)
  end

  def collected_users(_root, ~m(article filter)a, _info) do
    CMS.Interactions.collected_users(article, filter)
  end

  def emotion_to_article(_root, %{article: article, emotion: emotion} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.Interactions.emotion(article, emotion, user, Map.get(args, :command_id))
    |> hydrate_interaction(user)
  end

  def undo_emotion_to_article(_root, %{article: article, emotion: emotion} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.Interactions.undo_emotion(article, emotion, user, Map.get(args, :command_id))
    |> hydrate_interaction(user)
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
    CMS.Communities.unsubscribe(community, cur_user)
  end

  def paged_community_subscribers(_root, ~m(community filter)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.members(:subscribers, %Community{slug: community}, filter, cur_user)
  end

  def paged_community_subscribers(_root, ~m(community filter)a, _info) do
    CMS.Communities.members(:subscribers, %Community{slug: community}, filter)
  end

  def paged_community_subscribers(_root, _args, _info), do: {:error, "invalid args"}

  def mirror_article(_root, ~m(target_community article community_tags)a, %{
        context: %{cur_user: user}
      }) do
    CMS.Articles.mirror(target_community, article.id, community_tags, user)
  end

  def unmirror_article(_root, ~m(target_community article)a, %{context: %{cur_user: user}}) do
    CMS.Articles.unmirror(target_community, article.id, user)
  end

  def move_article(_root, ~m(target_community article community_tags)a, %{
        context: %{cur_user: user}
      }) do
    CMS.Articles.move(target_community, article.id, community_tags, user)
  end

  def mirror_to_home(_root, ~m(target_community article community_tags)a, %{
        context: %{cur_user: user}
      }) do
    CMS.Articles.mirror_to_home(target_community, article.id, community_tags, user)
  end

  def move_to_blackhole(_root, ~m(target_community article community_tags)a, %{
        context: %{cur_user: user}
      }) do
    CMS.Articles.move_to_blackhole(target_community, article.id, community_tags, user)
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

  def article_viewer_states(_root, %{paths: paths}, info) do
    with :ok <- validate_viewer_batch(paths) do
      case Map.get(info.context, :cur_user) do
        %User{} = user -> article_viewer_states_for_paths(paths, user)
        _ -> {:ok, []}
      end
    end
  end

  def article_interaction_states(_root, %{paths: paths}, info) do
    with :ok <- validate_viewer_batch(paths) do
      case Map.get(info.context, :cur_user) do
        %User{} = user -> article_interaction_states_for_paths(paths, user)
        _ -> {:ok, []}
      end
    end
  end

  def comment_viewer_states(
        _root,
        %{article: article_path, comment_inner_ids: comment_inner_ids},
        info
      ) do
    with :ok <- validate_viewer_batch(comment_inner_ids) do
      case Map.get(info.context, :cur_user) do
        %User{} = user -> resolve_comment_viewer_states(article_path, comment_inner_ids, user)
        _ -> {:ok, []}
      end
    end
  end

  def comment_reconcile_states(
        _root,
        %{article: article_path, comment_inner_ids: comment_inner_ids},
        info
      ) do
    with :ok <- validate_viewer_batch(comment_inner_ids),
         {:ok, {thread, article}} <- article(article_path),
         viewer <- Map.get(info.context, :cur_user),
         {:ok, comments} <-
           CMS.Comments.reconcile_comments(thread, article, comment_inner_ids, viewer) do
      stats =
        CMS.ArticleStats.for_articles(thread, [article])
        |> Map.get({thread, article.id}, %{})

      comments_by_inner_id = Map.new(comments, &{to_string(&1.inner_id), &1})

      entries =
        Enum.map(comment_inner_ids, fn inner_id ->
          comment =
            comments_by_inner_id
            |> Map.get(to_string(inner_id))
            |> case do
              nil -> nil
              value -> Map.put(value, :article, article)
            end

          %{comment_inner_id: inner_id, comment: comment}
        end)

      {:ok,
       %{
         article: %{
           inner_id: article.inner_id,
           comments_count: Map.get(stats, :comments_count, 0),
           comments_revision: Map.get(stats, :comments_revision, 0)
         },
         entries: entries
       }}
    end
  end

  defp validate_viewer_batch(paths) when is_list(paths) and length(paths) <= @viewer_batch_size,
    do: :ok

  defp validate_viewer_batch(_paths),
    do: {:error, "viewer batch cannot contain more than 100 paths"}

  defp article_viewer_states_for_paths(paths, user) do
    with {:ok, resolved} <- CMS.FrontDesk.article_paths(paths),
         states when is_map(states) <-
           CMS.ViewTracker.Query.viewer_states(Enum.map(resolved, & &1.article), user) do
      {:ok,
       Enum.map(resolved, fn %{path: path, article: article} ->
         {:ok, %{artiment: type}} = CMS.Artiment.Matcher.match_interaction(article)
         state = Map.fetch!(states, {type, article.id})

         %{
           community: path.community,
           thread: path.thread,
           inner_id: article.inner_id,
           viewer_has_viewed: state.viewer_has_viewed
         }
       end)}
    end
  end

  defp article_interaction_states_for_paths(paths, user) do
    with {:ok, resolved} <- CMS.FrontDesk.article_paths(paths),
         states when is_map(states) <-
           CMS.Interactions.viewer_states(Enum.map(resolved, & &1.article), user) do
      {:ok,
       Enum.map(resolved, fn %{path: path, article: article} ->
         {:ok, %{artiment: type}} = CMS.Artiment.Matcher.match_interaction(article)
         interaction = Map.fetch!(states, {type, article.id})

         ArticleInteractionPayload.from(
           %{community: path.community, thread: path.thread, inner_id: article.inner_id},
           interaction
         )
       end)}
    end
  end

  defp resolve_comment_viewer_states(article_path, comment_inner_ids, user) do
    with {:ok, {thread, article}} <- article(article_path),
         {:ok, hydrated} <-
           CMS.Comments.reconcile_comments(thread, article, comment_inner_ids, user) do
      {:ok,
       Enum.map(hydrated, fn comment ->
         %{
           inner_id: comment.inner_id,
           viewer_has_upvoted: comment.viewer_has_upvoted,
           viewer_has_reported: comment.viewer_has_reported,
           emotions: viewer_comment_emotions(comment)
         }
       end)}
    end
  end

  defp viewer_comment_emotions(comment) do
    EmotionFormatter.format(comment, :comment)
    |> Enum.map(fn emotion ->
      %{type: emotion.type, viewer_has_reacted: emotion.viewer_has_reacted}
    end)
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

  def create_comment(
        _root,
        %{article: article, article_path: %{thread: thread}, body: body} = args,
        %{
          context: %{cur_user: user}
        }
      ) do
    thread
    |> CMS.Comments.create_comment_payload(
      article,
      body,
      user,
      Map.get(args, :command_id)
    )
    |> present_comment_write()
  end

  def update_comment(_root, ~m(body comment)a = args, %{context: %{cur_user: user}}) do
    CMS.Comments.update_comment(comment, body, user, Map.get(args, :command_id))
    |> present_comment_write()
  end

  def delete_comment(_root, ~m(comment)a = args, %{context: %{cur_user: user}}) do
    CMS.Comments.delete_comment(comment, user, Map.get(args, :command_id))
    |> present_comment_write()
  end

  def reply_comment(_root, %{comment: comment, body: body} = args, %{context: %{cur_user: user}}) do
    CMS.Comments.reply_comment_payload(comment, body, user, Map.get(args, :command_id))
    |> present_comment_write()
  end

  def upvote_comment(_root, %{comment: comment} = args, %{context: %{cur_user: user}}) do
    CMS.Interactions.upvote(comment, user, Map.get(args, :command_id))
    |> hydrate_interaction(user)
  end

  def undo_upvote_comment(_root, %{comment: comment} = args, %{context: %{cur_user: user}}) do
    CMS.Interactions.undo_upvote(comment, user, Map.get(args, :command_id))
    |> hydrate_interaction(user)
  end

  def report_comment(_root, ~m(comment reason attr)a, %{context: %{cur_user: user}}) do
    CMS.Interactions.report(comment, reason, attr, user) |> hydrate_report_interaction(user)
  end

  def undo_report_comment(_root, ~m(comment)a, %{context: %{cur_user: user}}) do
    CMS.Interactions.undo_report(comment, user) |> hydrate_report_interaction(user)
  end

  def emotion_to_comment(_root, %{comment: comment, emotion: emotion} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.Interactions.emotion(comment, emotion, user, Map.get(args, :command_id))
    |> hydrate_interaction(user)
  end

  def undo_emotion_to_comment(_root, %{comment: comment, emotion: emotion} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.Interactions.undo_emotion(comment, emotion, user, Map.get(args, :command_id))
    |> hydrate_interaction(user)
  end

  @doc """
  Accepts the resolved Comment as its QA Post's current solution.

  ## Examples

      accept_solution(root, %{comment: comment}, resolution)
  """
  def accept_solution(_root, %{comment: comment}, %{context: %{cur_user: user}}) do
    CMS.Comments.accept_solution(comment, user)
  end

  @doc """
  Revokes the resolved Comment when it is the current solution.

  ## Examples

      revoke_solution(root, %{comment: comment}, resolution)
  """
  def revoke_solution(_root, %{comment: comment}, %{context: %{cur_user: user}}) do
    CMS.Comments.revoke_solution(comment, user)
  end

  def pin_comment(_root, ~m(comment)a, %{context: %{cur_user: user}}),
    do: CMS.Comments.pin_comment(comment, user)

  def undo_pin_comment(_root, ~m(comment)a, %{context: %{cur_user: user}}),
    do: CMS.Comments.undo_pin_comment(comment, user)

  def emotions(%{thread: _} = root, _args, _info) do
    {:ok, EmotionFormatter.format(root, :comment)}
  end

  def emotions(root, _args, _info) do
    {:ok, EmotionFormatter.format(root, :article)}
  end

  def comment_inner_id(%{inner_id: inner_id}, _args, _info) when not is_nil(inner_id),
    do: {:ok, inner_id}

  def comment_inner_id(_comment, _args, _info), do: {:ok, nil}

  defp article(article_path) do
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
          with {:ok, {thread, article}} <- article(value) do
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
          with {:ok, {thread, article}} <- article(value) do
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

  defp hydrate_interaction({:ok, %Comment{} = comment}, user),
    do: CMS.Comments.InteractionResponse.one(comment, user)

  defp hydrate_interaction({:ok, article}, user) do
    command_id = Map.get(article, :command_id)
    reaction_outcome = Map.get(article, :reaction_outcome)
    article = preload_interaction_community(article)

    # These post-commit readers can observe different concurrent revisions.
    # Each payload keeps the revision attached to the state it actually read.
    with command_id when is_binary(command_id) <- command_id,
         reaction_outcome when reaction_outcome in [:changed, :unchanged] <- reaction_outcome,
         {:ok, %{artiment: thread}} <- CMS.Artiment.Matcher.match_interaction(article),
         interaction when is_map(interaction) <- CMS.Interactions.viewer_state(article, user),
         {:ok, article_stats} <-
           ArticleStatsPayload.load(thread, article, article.community.slug),
         interaction_state <-
           ArticleInteractionPayload.from(
             %{
               community: article.community.slug,
               thread: thread,
               inner_id: article.inner_id
             },
             interaction
           ) do
      {:ok,
       %{
         command_id: command_id,
         reaction_outcome: reaction_outcome,
         article_stats: article_stats,
         interaction_state: interaction_state
       }}
    else
      {:error, _} = error -> error
      _ -> {:error, CmsErrorCat.command_result_unavailable()}
    end
  end

  defp hydrate_interaction({:error, _reason} = error, _user), do: error

  defp preload_interaction_community(%{__struct__: _} = article),
    do: GroupherServer.Repo.preload(article, :community)

  defp preload_interaction_community(article) when is_map(article), do: article

  defp present_comment_write({:ok, %{comment: comment, article: article} = result}) do
    article =
      if is_struct(article),
        do: Repo.preload(article, :community),
        else: article

    with {:ok, %{artiment: thread}} <- CMS.Artiment.Matcher.match_interaction(article),
         {:ok, article_stats} <-
           ArticleStatsPayload.load(thread, article, article.community.slug) do
      {:ok,
       %{
         command_id: Map.fetch!(result, :command_id),
         comment: comment,
         article_stats: article_stats
       }}
    end
  end

  defp present_comment_write({:error, _reason} = error), do: error

  defp hydrate_report_interaction({:ok, %Comment{} = comment}, user),
    do: CMS.Comments.InteractionResponse.one(comment, user, surface: :report)

  defp hydrate_report_interaction({:ok, article}, user),
    do: CMS.Articles.Response.one(article, user, surface: :report)

  defp hydrate_report_interaction({:error, _reason} = error, _user), do: error

  defp article_state_result({:ok, updated}, article) do
    meta =
      article
      |> Map.get(:meta, %{})
      |> Map.merge(%{
        is_comment_locked: updated.comments_locked,
        is_sunk: updated.is_sunk,
        last_active_at: updated.last_active_at
      })

    {:ok, article |> Map.put(:active_at, updated.active_at) |> Map.put(:meta, meta)}
  end

  defp article_state_result({:error, _reason} = error, _article), do: error

  defp branch_opts(article) do
    case Map.get(article, :branch_id) do
      branch_id when is_integer(branch_id) -> [branch_id: branch_id]
      _ -> []
    end
  end

  defp normalize_application_filter(filter) do
    filter
    |> maybe_put_actor_id(:applicant_ref, :applicant_id)
    |> maybe_put_actor_id(:reviewer_ref, :reviewer_id)
  end

  defp maybe_put_actor_id(filter, public_key, id_key) do
    case Map.get(filter, public_key) do
      nil ->
        filter

      public_ref ->
        case FrontDesk.user(public_ref) do
          {:ok, user} -> Map.put(filter, id_key, user.id)
          _ -> Map.put(filter, id_key, -1)
        end
    end
  end

  defp connection(entries, has_next_page, cursor_fun) do
    edges =
      Enum.map(entries, fn entry ->
        %{cursor: opaque_cursor(cursor_fun.(entry)), node: entry}
      end)

    %{
      edges: edges,
      page_info: %{
        end_cursor: edges |> List.last() |> then(&if(&1, do: &1.cursor, else: nil)),
        has_next_page: has_next_page
      }
    }
  end

  defp application_cursor(application),
    do: "#{DateTime.to_iso8601(application.submitted_at)}|#{application.public_ref}"

  defp event_cursor(event), do: "#{DateTime.to_iso8601(event.occurred_at)}|#{event.id}"
  defp opaque_cursor(value), do: value |> to_string() |> Base.url_encode64(padding: false)

  defp application_result({:ok, value}), do: {:ok, value}

  defp application_result({:error, reason}) do
    reason_code = reason |> normalize_reason() |> Atom.to_string()

    {:error,
     [
       message: reason_code,
       extensions: %{
         code: ErrorCat.code(ErrorCat.custom()),
         reasonCode: reason_code
       }
     ]}
  end

  defp normalize_reason({reason, _metadata}) when is_atom(reason), do: reason
  defp normalize_reason(CmsErrorCat.error_pattern(reason: reason)), do: reason
  defp normalize_reason(reason) when is_atom(reason), do: reason
  defp normalize_reason(_), do: :apply_not_allowed

  defp stringify(nil), do: nil
  defp stringify(value) when is_atom(value), do: Atom.to_string(value)
  defp stringify(value), do: to_string(value)
end
