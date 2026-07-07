defmodule GroupherServer.CMS.DocTree.Publish do
  @moduledoc """
  Publish workflows for docs and docs tree snapshots.

      Dashboard Editor
      ├─ Doc draft changes
      │    docs(stage=draft)
      │
      └─ Tree draft changes
           doc_tree_events(owner=tree, status=staged)

                 |
                 v
          publish_changes/3
                 |
                 ├─ docs + ArticleDocument
                 ├─ doc_tree_nodes(stage=public)
                 └─ publish_releases
                      ├─ tree_snapshot_id -> doc_tree_snapshots
                      ├─ publish_release_articles
                      └─ publish_release_tree_events

  Tree and article are still separate domains internally, but the public product
  surface exposes one publish action. The release row is the snapshot anchor that
  lets history and rollback talk about the full public docs site at one moment.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User

  alias CMS.DocTree.Publish.{
    Checklist,
    DocPublisher,
    PublicProjection,
    Release,
    Restore,
    Result,
    Selection
  }

  require CMS.Const

  alias CMS.Model.{
    Community,
    Doc,
    DocTreeEvent,
    DocTreeNode
  }

  alias Helper.{T, Transaction}

  @publish_flow_noop CMS.Const.doc_publish_flow(:noop)
  @publish_flow_publish CMS.Const.doc_publish_flow(:publish)
  @publish_flow_restore CMS.Const.doc_publish_flow(:restore)
  @tree_delete_event_types [
    CMS.Const.tree_event(:node_delete),
    CMS.Const.tree_event(:pin_remove)
  ]

  @doc """
  Builds the unified publish checklist consumed by the editor ActionSnackbar.

  The returned ids are opaque UI ids. The frontend should show them as a simple
  checklist and send selected ids back to `publish_changes/4`; dependency
  resolution stays server-side.

  ## Examples

      iex> Publish.checklist(community).total_count
      3
  """
  @spec checklist(Community.t()) :: map()
  def checklist(%Community{} = community) do
    Checklist.build(community)
  end

  @doc """
  Publishes selected doc and tree changes as a single release.

  Nil selections mean "publish every selected-by-default item" from the current
  checklist. Explicit lists publish only those opaque checklist item ids, such as
  `doc:<doc_id>` and `tree:<event_id>`; these are not article inner ids or raw
  doc tree node ids.

  ## Examples

      iex> Publish.publish_changes(community, %{doc_change_ids: ["doc:12"]}, user)
      {:ok, %{done: true, release: %PublishRelease{}}}
  """
  @spec publish_changes(Community.t(), map(), User.t(), keyword()) :: T.domain_res(map())
  def publish_changes(%Community{} = community, args, %User{} = user, opts \\ []) do
    sync_cover? = Keyword.get(opts, :sync_cover, true)

    Transaction.lock_global("doc_tree:#{community.id}", fn ->
      Repo.transaction(fn ->
        current_checklist = checklist(community)

        with {:ok, selection} <- Selection.from_input(args, current_checklist),
             tree_checklist_item_ids <-
               include_doc_shell_tree_checklist_item_ids(
                 community,
                 args,
                 selection.doc_checklist_item_ids,
                 selection.tree_checklist_item_ids
               ),
             selection <-
               Selection.put_tree_checklist_item_ids(selection, tree_checklist_item_ids),
             {:ok, publish_flow} <- Selection.flow(current_checklist, selection) do
          case publish_flow do
            @publish_flow_noop ->
              %{done: true, release: nil, checklist: current_checklist}

            @publish_flow_restore ->
              case restore_selected_changes(
                     community,
                     selection.restore_tree_checklist_item_ids,
                     user
                   ) do
                {:ok, result} -> result
                {:error, reason} -> Repo.rollback(reason)
                reason -> Repo.rollback(reason)
              end

            @publish_flow_publish ->
              case publish_selected_changes(
                     community,
                     current_checklist,
                     selection.doc_checklist_item_ids,
                     selection.tree_checklist_item_ids,
                     selection.restore_tree_checklist_item_ids,
                     user,
                     sync_cover?
                   ) do
                {:ok, result} -> result
                {:error, reason} -> Repo.rollback(reason)
                reason -> Repo.rollback(reason)
              end
          end
        else
          {:error, reason} -> Repo.rollback(reason)
          reason -> Repo.rollback(reason)
        end
      end)
      |> case do
        {:ok, result} -> {:ok, result}
        {:error, reason} -> {:error, reason}
      end
    end)
  end

  @doc """
  Moves a published doc page back to draft by creating a new draft row sharing
  the same `doc_id`. The public row is left untouched — it stays served until
  the next publish overwrites it.

  Content is copied from the public `ArticleDocument` JSON body and flows through
  `Articles.Draft.create` so all derived fields (markdown, html, content_hash,
  etc.) are regenerated by ContentPipeline. The caller's `user` is recorded as
  the draft author for audit.

  ## Examples

      iex> Publish.move_doc_to_draft(community, draft_node.node_id, user)
      {:ok, %Doc{stage: CMS.Const.stage(:draft), doc_id: "a1b2c3d4-..."}}
  """
  @spec move_doc_to_draft(Community.t(), T.id(), User.t()) :: T.domain_res(Doc.t())
  def move_doc_to_draft(%Community{} = community, node_id, %User{} = user) do
    DocPublisher.move_doc_to_draft(community, node_id, user)
  end

  @doc """
  Deprecated by the stage model; tree draft/public state is owned by tree events.
  """
  @spec move_group_to_draft(Community.t(), T.id()) :: T.domain_res(map())
  def move_group_to_draft(_community, _group_id),
    do: {:error, {:custom, "Group draft state is managed by unpublished tree events."}}

  @doc """
  Resolves the public-stage node for a stable draft `node_id`.

  Cover mutations use this to translate editor ids into public tree rows.

  ## Examples

      iex> Publish.public_node_for_draft(community, draft.node_id)
      {:ok, %DocTreeNode{stage: CMS.Const.stage(:public)}}
  """
  @spec public_node_for_draft(Community.t(), T.id()) :: T.domain_res(DocTreeNode.t())
  def public_node_for_draft(%Community{} = community, node_id) do
    DocPublisher.public_node_for_draft(community, node_id)
  end

  defp restore_selected_changes(
         %Community{} = community,
         restore_tree_checklist_item_ids,
         %User{} = user
       ) do
    with {:ok, _events} <-
           restore_tree_checklist_items(community, restore_tree_checklist_item_ids, user),
         next_checklist <- checklist(community),
         {:ok, _state} <- Release.mark_site_draft_clean(community, next_checklist) do
      {:ok, %{done: true, release: nil, checklist: next_checklist}}
    end
  end

  defp publish_selected_changes(
         %Community{} = community,
         current_checklist,
         doc_checklist_item_ids,
         tree_checklist_item_ids,
         restore_tree_checklist_item_ids,
         %User{} = user,
         sync_cover?
       ) do
    with {:ok, _restored_events} <-
           restore_tree_checklist_items(community, restore_tree_checklist_item_ids, user),
         {:ok, tree_result} <- prepare_tree_checklist_items(community, tree_checklist_item_ids),
         :ok <-
           reject_doc_tree_delete_overlaps(
             current_checklist.doc_changes,
             doc_checklist_item_ids,
             tree_result.events
           ),
         :ok <- PublicProjection.preapply_tree_delete_events(community, tree_result.events),
         {:ok, doc_revisions} <-
           publish_doc_checklist_items(
             community,
             current_checklist.doc_changes,
             doc_checklist_item_ids,
             user,
             sync_cover?
           ),
         :ok <- PublicProjection.apply_tree_events(community, tree_result.events),
         {:ok, release} <- Release.create(community, user, doc_revisions, tree_result),
         next_checklist <- checklist(community),
         {:ok, _state} <- Release.mark_site_release_published(community, user, next_checklist) do
      {:ok, %{done: true, release: release, checklist: next_checklist}}
    end
  end

  defp publish_doc_checklist_items(
         %Community{} = community,
         checklist_items,
         doc_checklist_item_ids,
         %User{} = user,
         sync_cover?
       ) do
    items = Map.new(checklist_items, &{&1.id, &1})

    Result.map_while_ok(doc_checklist_item_ids, fn checklist_item_id ->
      with %{doc_id: _doc_id} = item <- Map.get(items, checklist_item_id),
           {:ok, snapshot} <-
             DocPublisher.publish_doc_draft(
               community,
               item,
               user,
               sync_cover?
             ) do
        {:ok, %{snapshot: snapshot, checklist_item: item}}
      else
        nil -> {:error, {:custom, "Selected docs publish item no longer exists."}}
        error -> error
      end
    end)
  end

  defp include_doc_shell_tree_checklist_item_ids(
         %Community{} = community,
         args,
         [],
         tree_checklist_item_ids
       ) do
    if tree_selection_omitted?(args) do
      community
      |> doc_shell_tree_checklist_item_ids()
      |> Enum.concat(tree_checklist_item_ids)
      |> Enum.uniq()
    else
      tree_checklist_item_ids
    end
  end

  defp include_doc_shell_tree_checklist_item_ids(
         _community,
         _args,
         _doc_checklist_item_ids,
         tree_checklist_item_ids
       ),
       do: tree_checklist_item_ids

  defp tree_selection_omitted?(args) do
    Selection.tree_selection_omitted?(args)
  end

  defp doc_shell_tree_checklist_item_ids(%Community{} = community) do
    Checklist.doc_shell_tree_checklist_item_ids(community)
  end

  defp prepare_tree_checklist_items(%Community{} = community, tree_checklist_item_ids) do
    events = selected_tree_events(community, tree_checklist_item_ids)

    if length(events) != length(tree_checklist_item_ids) do
      {:error, {:custom, "Selected tree publish item no longer exists."}}
    else
      article_snapshots = Release.article_snapshots_before_tree_events(community, events)

      {:ok, %{events: events, article_snapshots: article_snapshots}}
    end
  end

  defp reject_doc_tree_delete_overlaps(checklist_items, doc_checklist_item_ids, tree_events) do
    doc_items = Map.new(checklist_items, &{&1.id, &1})

    selected_doc_items =
      doc_checklist_item_ids
      |> Enum.map(&Map.get(doc_items, &1))
      |> Enum.reject(&is_nil/1)

    selected_doc_page_node_ids =
      selected_doc_items
      |> Enum.map(& &1.page_node_id)
      |> Enum.reject(&is_nil/1)
      |> MapSet.new(&to_string/1)

    selected_doc_ids =
      selected_doc_items
      |> Enum.map(& &1.doc_id)
      |> Enum.reject(&is_nil/1)
      |> MapSet.new(&to_string/1)

    deleted_nodes = Enum.flat_map(tree_events, &delete_event_nodes/1)

    deleted_node_ids =
      deleted_nodes
      |> Enum.map(&Map.get(&1, "id"))
      |> Enum.reject(&is_nil/1)
      |> MapSet.new(&to_string/1)

    deleted_doc_ids =
      deleted_nodes
      |> Enum.map(&Map.get(&1, "docId"))
      |> Enum.reject(&is_nil/1)
      |> MapSet.new(&to_string/1)

    if MapSet.disjoint?(selected_doc_page_node_ids, deleted_node_ids) and
         MapSet.disjoint?(selected_doc_ids, deleted_doc_ids) do
      :ok
    else
      {:error, {:custom, "Selected docs publish item is also selected for tree deletion."}}
    end
  end

  defp delete_event_nodes(%DocTreeEvent{
         event_type: type,
         inverse_payload: %{"node" => node} = inverse
       })
       when type in @tree_delete_event_types and is_map(node) do
    children =
      inverse
      |> Map.get("children", [])
      |> Enum.filter(&is_map/1)

    [node | children]
  end

  defp delete_event_nodes(_event), do: []

  defp restore_tree_checklist_items(_community, [], _user), do: {:ok, []}

  defp restore_tree_checklist_items(
         %Community{} = community,
         restore_tree_checklist_item_ids,
         %User{} = user
       ) do
    events = selected_tree_events(community, restore_tree_checklist_item_ids)

    if length(events) != length(restore_tree_checklist_item_ids) do
      {:error, {:custom, "Selected tree restore item no longer exists."}}
    else
      Restore.restore_tree_events(community, events, user)
    end
  end

  defp selected_tree_events(_community, []), do: []

  defp selected_tree_events(%Community{} = community, tree_checklist_item_ids) do
    event_ids = Enum.flat_map(tree_checklist_item_ids, &tree_event_id/1)

    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.status == CMS.Const.tree_event_status(:staged))
    |> where([e], e.owner == CMS.Const.tree_event_owner(:tree))
    |> where([e], e.id in ^event_ids)
    |> order_by([e], asc: e.seq, asc: e.id)
    |> Repo.all()
  end

  # GraphQL checklist ids are public strings ("tree:<db id>"), while some tests
  # and internal paths still pass plain integer/string ids. Normalize both here
  # so bad input falls through to the normal "no longer exists" selection error.
  defp tree_event_id("tree:" <> id), do: tree_event_id(id)
  defp tree_event_id(id) when is_integer(id), do: [id]

  defp tree_event_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {id, ""} -> [id]
      _ -> []
    end
  end

  defp tree_event_id(_id), do: []
end
