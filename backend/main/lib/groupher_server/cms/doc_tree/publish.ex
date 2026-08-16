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
                 └─ doc_publish_releases
                      ├─ tree_snapshot_id -> doc_tree_snapshots
                      ├─ doc_publish_release_articles
                      └─ doc_publish_release_tree_events

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
    Restore,
    Result,
    Selection
  }

  alias CMS.Docs.Branch
  alias CMS.DocPublishRelease

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
  @spec checklist(Community.t(), keyword() | map()) :: map() | {:error, term()}
  def checklist(%Community{} = community, opts \\ []) do
    with {:ok, branch} <- Branch.resolve(community, opts) do
      Checklist.build(community, branch)
    end
  end

  @doc """
  Publishes selected doc and tree changes as a single release.

  Nil selections mean "publish every selected-by-default item" from the current
  checklist. Explicit lists publish only those opaque checklist item ids, such as
  `doc:<doc_id>` and `tree:<event_id>`; these are not article inner ids or raw
  doc tree node ids.

  ## Examples

      iex> Publish.publish_changes(community, %{doc_change_ids: ["doc:12"]}, user)
      {:ok, %{done: true, release: %CMS.Model.DocPublishRelease{}}}
  """
  @spec publish_changes(Community.t(), map(), User.t(), keyword()) :: T.domain_res(map())
  def publish_changes(%Community{} = community, args, %User{} = user, opts \\ []) do
    sync_cover? = Keyword.get(opts, :sync_cover, true)

    with {:ok, branch} <- Branch.resolve(community, args) do
      Transaction.lock_global("doc_tree:#{community.id}:#{branch.id}", fn ->
        Repo.transaction(fn ->
          with {:ok, _canonical} <- CMS.Gate.access_check(user, :manage_docs, community) do
            current_checklist = checklist(community, branch_id: branch.id)

            with {:ok, selection} <- Selection.from_input(args, current_checklist),
                 tree_checklist_item_ids <-
                   include_doc_shell_tree_checklist_item_ids(
                     community,
                     branch,
                     args,
                     selection.doc_checklist_item_ids,
                     selection.tree_checklist_item_ids
                   ),
                 selection <-
                   Selection.put_tree_checklist_item_ids(selection, tree_checklist_item_ids),
                 {:ok, publish_flow} <- Selection.flow(current_checklist, selection) do
              case publish_flow do
                @publish_flow_noop ->
                  publish_payload(true, nil, current_checklist)

                @publish_flow_restore ->
                  case restore_selected_changes(
                         community,
                         branch,
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
                         branch,
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
  end

  @doc """
  Moves a published doc page back to draft by creating a new draft row sharing
  the same `doc_id`. The public row is left untouched — it stays served until
  the next publish overwrites it.

  Content is copied from the public `ArticleDocument` as one validated BodyBag.
  Derived fields and `body_hash` are preserved without running an Elixir
  serializer. The caller's `user` is recorded as the draft author for audit.

  ## Examples

      iex> Publish.move_doc_to_draft(community, draft_node.node_id, user)
      {:ok, %Doc{stage: CMS.Const.stage(:draft), article_hash_id: "a1b2c3d4-..."}}
  """
  @spec move_doc_to_draft(Community.t(), T.id(), User.t(), keyword() | map()) ::
          T.domain_res(Doc.t())
  def move_doc_to_draft(%Community{} = community, node_id, %User{} = user, opts \\ []) do
    with {:ok, branch} <- Branch.resolve(community, opts) do
      DocPublisher.move_doc_to_draft(community, branch, node_id, user)
    end
  end

  @doc "Creates missing article drafts for every published Page in one Tab/Group subtree."
  @spec move_subtree_to_draft(Community.t(), T.id(), User.t(), keyword() | map()) ::
          T.domain_res(map())
  def move_subtree_to_draft(
        %Community{} = community,
        node_id,
        %User{} = user,
        opts \\ []
      ) do
    with {:ok, branch} <- Branch.resolve(community, opts),
         {:ok, root} <- DocPublisher.public_node_for_draft(community, branch, node_id),
         true <- root.type in [:tab, :group],
         pages <-
           community
           |> PublicProjection.public_descendants(branch, root.node_id)
           |> Enum.filter(&(&1.type == :page)),
         {:ok, drafts} <-
           Result.map_while_ok(
             pages,
             &DocPublisher.move_doc_to_draft(community, branch, &1.node_id, user)
           ) do
      {:ok, %{done: true, affected_count: length(drafts)}}
    else
      false -> {:error, {:custom, "Draft subtree root must be a Tab or Group."}}
      error -> error
    end
  end

  @doc """
  Resolves the public-stage node for a stable draft `node_id`.

  Cover mutations use this to translate editor ids into public tree rows.

  ## Examples

      iex> Publish.public_node_for_draft(community, draft.node_id)
      {:ok, %DocTreeNode{stage: CMS.Const.stage(:public)}}
  """
  @spec public_node_for_draft(Community.t(), T.id(), keyword() | map()) ::
          T.domain_res(DocTreeNode.t())
  def public_node_for_draft(%Community{} = community, node_id, opts \\ []) do
    with {:ok, branch} <- Branch.resolve(community, opts) do
      DocPublisher.public_node_for_draft(community, branch, node_id)
    end
  end

  defp restore_selected_changes(
         %Community{} = community,
         branch,
         restore_tree_checklist_item_ids,
         %User{} = user
       ) do
    with {:ok, _events} <-
           restore_tree_checklist_items(community, branch, restore_tree_checklist_item_ids, user),
         next_checklist <- checklist(community, branch_id: branch.id),
         {:ok, _state} <-
           DocPublishRelease.mark_site_draft_clean(community, branch, next_checklist) do
      {:ok, publish_payload(true, nil, next_checklist)}
    end
  end

  defp publish_selected_changes(
         %Community{} = community,
         branch,
         current_checklist,
         doc_checklist_item_ids,
         tree_checklist_item_ids,
         restore_tree_checklist_item_ids,
         %User{} = user,
         sync_cover?
       ) do
    with {:ok, _restored_events} <-
           restore_tree_checklist_items(community, branch, restore_tree_checklist_item_ids, user),
         {:ok, tree_result} <-
           prepare_tree_checklist_items(community, branch, tree_checklist_item_ids),
         :ok <-
           reject_doc_tree_delete_overlaps(
             current_checklist.doc_changes,
             doc_checklist_item_ids,
             tree_result.events
           ),
         :ok <-
           PublicProjection.preapply_tree_delete_events(community, branch, tree_result.events),
         {:ok, doc_revisions} <-
           publish_doc_checklist_items(
             community,
             branch,
             current_checklist.doc_changes,
             doc_checklist_item_ids,
             user,
             sync_cover?
           ),
         :ok <- PublicProjection.apply_tree_events(community, branch, tree_result.events),
         {:ok, release} <-
           DocPublishRelease.create(community, branch, user, doc_revisions, tree_result),
         next_checklist <- checklist(community, branch_id: branch.id),
         {:ok, _state} <-
           DocPublishRelease.mark_site_release_published(
             community,
             branch,
             user,
             next_checklist
           ) do
      {:ok, publish_payload(true, release, next_checklist)}
    end
  end

  defp publish_payload(done, release, checklist) do
    %{
      done: done,
      release: release,
      checklist: checklist,
      scope: %{total_count: checklist.total_count}
    }
  end

  defp publish_doc_checklist_items(
         %Community{} = community,
         branch,
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
               branch,
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
         branch,
         args,
         [],
         tree_checklist_item_ids
       ) do
    if tree_selection_omitted?(args) do
      community
      |> doc_shell_tree_checklist_item_ids(branch)
      |> Enum.concat(tree_checklist_item_ids)
      |> Enum.uniq()
    else
      tree_checklist_item_ids
    end
  end

  defp include_doc_shell_tree_checklist_item_ids(
         _community,
         _branch,
         _args,
         _doc_checklist_item_ids,
         tree_checklist_item_ids
       ),
       do: tree_checklist_item_ids

  defp tree_selection_omitted?(args) do
    Selection.tree_selection_omitted?(args)
  end

  defp doc_shell_tree_checklist_item_ids(%Community{} = community, branch) do
    Checklist.doc_shell_tree_checklist_item_ids(community, branch)
  end

  defp prepare_tree_checklist_items(%Community{} = community, branch, tree_checklist_item_ids) do
    events = selected_tree_events(community, branch, tree_checklist_item_ids)

    if length(events) != length(tree_checklist_item_ids) do
      {:error, {:custom, "Selected tree publish item no longer exists."}}
    else
      doc_snapshots =
        DocPublishRelease.doc_snapshots_before_tree_events(community, branch, events)

      {:ok, %{events: events, doc_snapshots: doc_snapshots}}
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
    pages =
      inverse
      |> Map.get("pages", [])
      |> Enum.filter(&is_map/1)

    [node | pages]
  end

  defp delete_event_nodes(_event), do: []

  defp restore_tree_checklist_items(_community, _branch, [], _user), do: {:ok, []}

  defp restore_tree_checklist_items(
         %Community{} = community,
         branch,
         restore_tree_checklist_item_ids,
         %User{} = user
       ) do
    events = selected_tree_events(community, branch, restore_tree_checklist_item_ids)

    if length(events) != length(restore_tree_checklist_item_ids) do
      {:error, {:custom, "Selected tree restore item no longer exists."}}
    else
      Restore.restore_tree_events(community, branch, events, user)
    end
  end

  defp selected_tree_events(_community, _branch, []), do: []

  defp selected_tree_events(%Community{} = community, branch, tree_checklist_item_ids) do
    event_ids = Enum.flat_map(tree_checklist_item_ids, &tree_event_id/1)

    DocTreeEvent
    |> where([e], e.community_id == ^community.id)
    |> where([e], e.branch_id == ^branch.id)
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
