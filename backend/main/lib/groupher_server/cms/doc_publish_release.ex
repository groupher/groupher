defmodule GroupherServer.CMS.DocPublishRelease do
  @moduledoc """
  Persists release history for one unified docs publish.

      published tree rows + published Doc snapshots
          |
          v
      doc_tree_snapshots
          |
          v
      doc_publish_releases
          |
          +--> doc_publish_release_articles
          +--> doc_publish_release_tree_events
          |
          v
      docs_site_states base/published markers

  The release row is the checkpoint for the public docs site at one moment. It
  records both Doc snapshots and tree events so history can explain what
  changed.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.DocTree.Events
  alias CMS.DocTree.Publish.{Checklist, PublicProjection, Result}

  alias CMS.Model.{
    DocSnapshot,
    Community,
    DocTreeEvent,
    DocTreeNode,
    DocsSiteState,
    DocPublishRelease,
    DocPublishReleaseArticle,
    DocPublishReleaseTreeEvent
  }

  alias Helper.ORM

  require CMS.Const

  @tree_node_type_group CMS.Const.tree_node_type(:group)
  @tree_node_type_page CMS.Const.tree_node_type(:page)

  @doc "Creates the Docs-only release that binds published Doc and Tree snapshots."
  def create(
        %Community{} = community,
        branch,
        %User{} = user,
        doc_entries,
        %{events: tree_events, doc_snapshots: doc_snapshots}
      ) do
    release_number = next_release_number(community, branch)
    tree_json = CMS.DocTree.Snapshot.published_json(community, branch_id: branch.id)
    event_ids = Enum.map(tree_events, & &1.id)

    with {:ok, tree_snapshot} <-
           Events.publish_snapshot(community, user.id, "publish release",
             branch_id: branch.id,
             tree_json: tree_json,
             event_ids: event_ids
           ),
         {:ok, _state} <- mark_tree_release_published(community, branch, tree_snapshot),
         {:ok, release} <-
           ORM.create(DocPublishRelease, %{
             community_id: community.id,
             branch_id: branch.id,
             release_number: release_number,
             version_slug: "v#{release_number}",
             tree_snapshot_id: tree_snapshot.id,
             author_id: user.id,
             published_at: DateTime.utc_now(:second)
           }),
         {:ok, _articles} <-
           create_release_articles(release, doc_entries, tree_events, doc_snapshots),
         {:ok, _events} <- create_release_tree_events(release, tree_events) do
      {:ok, release}
    end
  end

  @doc "Updates the Docs site publication markers after a release completes."
  def mark_site_release_published(
        %Community{} = community,
        branch,
        %User{} = user,
        next_checklist
      ) do
    with {:ok, state} <-
           ORM.find_by(DocsSiteState, community_id: community.id, branch_id: branch.id) do
      attrs = %{
        last_published_at: DateTime.utc_now(:second),
        last_published_by_id: user.id
      }

      attrs =
        if next_checklist.total_count == 0 do
          Map.put(attrs, :published_version, state.site_draft_version)
        else
          attrs
        end

      ORM.update(state, attrs)
    end
  end

  @doc "Marks the Docs site draft version clean when the next checklist is empty."
  def mark_site_draft_clean(%Community{} = community, branch, %{total_count: 0}) do
    with {:ok, state} <-
           ORM.find_by(DocsSiteState, community_id: community.id, branch_id: branch.id) do
      ORM.update(state, %{published_version: state.site_draft_version})
    end
  end

  def mark_site_draft_clean(%Community{} = community, branch, _next_checklist) do
    ORM.find_by(DocsSiteState, community_id: community.id, branch_id: branch.id)
  end

  @doc "Captures DocSnapshot membership needed before destructive Tree events run."
  def doc_snapshots_before_tree_events(%Community{} = community, branch, tree_events) do
    tree_events
    |> Enum.flat_map(&release_doc_snapshots_before_tree_event(community, branch, &1))
    |> Enum.reject(&is_nil/1)
    |> merge_release_article_attrs()
    |> Map.new(&{&1.node_id, Map.delete(&1, :release_id)})
  end

  defp mark_tree_release_published(%Community{} = community, branch, tree_snapshot) do
    with {:ok, state} <-
           ORM.find_by(DocsSiteState, community_id: community.id, branch_id: branch.id) do
      ORM.update(state, %{
        base_snapshot_id: tree_snapshot.id,
        staged_event_count: Events.staged_tree_event_count(community, branch_id: branch.id)
      })
    end
  end

  defp create_release_articles(
         %DocPublishRelease{} = release,
         doc_entries,
         tree_events,
         doc_snapshots
       ) do
    doc_rows = Enum.map(doc_entries, &release_article_attrs_from_doc(release, &1))

    tree_rows = release_article_attrs_from_tree_events(release, tree_events, doc_snapshots)

    (doc_rows ++ tree_rows)
    |> Enum.reject(&is_nil/1)
    |> merge_release_article_attrs()
    |> Enum.reduce_while({:ok, []}, fn attrs, {:ok, acc} ->
      case ORM.create(DocPublishReleaseArticle, attrs) do
        {:ok, row} -> {:cont, {:ok, [row | acc]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, rows} -> {:ok, Enum.reverse(rows)}
      error -> error
    end
  end

  defp release_article_attrs_from_doc(%DocPublishRelease{} = release, %{
         snapshot: %DocSnapshot{} = snapshot,
         checklist_item: checklist_item
       }) do
    node =
      public_page_by_doc_id(release.community_id, release.branch_id, snapshot.article_hash_id)

    %{
      release_id: release.id,
      doc_id: snapshot.article_hash_id,
      snapshot_id: snapshot.id,
      node_id: node && node.node_id,
      group_node_id: node && node.parent_node_id,
      index: node && node.index,
      title: snapshot.title,
      actions: [checklist_item.action]
    }
  end

  defp release_article_attrs_from_tree_events(
         %DocPublishRelease{} = release,
         tree_events,
         doc_snapshots
       ) do
    snapshot_rows =
      doc_snapshots
      |> Map.values()
      |> Enum.map(&Map.put(&1, :release_id, release.id))

    current_rows =
      tree_events
      |> Enum.flat_map(&article_node_ids_from_tree_event/1)
      |> Enum.uniq()
      |> Enum.map(fn node_id ->
        with %DocTreeNode{doc_id: doc_id} = node when not is_nil(doc_id) <-
               public_page_by_node_id(release.community_id, release.branch_id, node_id),
             %DocSnapshot{} = snapshot <-
               latest_public_doc_snapshot(release.community_id, release.branch_id, doc_id) do
          %{
            release_id: release.id,
            doc_id: doc_id,
            snapshot_id: snapshot.id,
            node_id: node.node_id,
            group_node_id: node.parent_node_id,
            index: node.index,
            title: snapshot.title,
            actions: actions_from_tree_events(tree_events, node.node_id)
          }
        else
          _ -> nil
        end
      end)

    snapshot_rows ++ current_rows
  end

  defp release_doc_snapshots_before_tree_event(
         %Community{} = community,
         branch,
         %DocTreeEvent{
           event_type: CMS.Const.tree_event(:node_delete),
           node_type: @tree_node_type_group,
           node_id: id
         } = event
       ) do
    community
    |> PublicProjection.public_descendants(branch, id)
    |> Enum.filter(&(&1.type == @tree_node_type_page))
    |> Enum.map(
      &release_article_attrs_from_public_node(community.id, branch.id, &1, [
        Checklist.tree_event_action(event)
      ])
    )
  end

  defp release_doc_snapshots_before_tree_event(
         %Community{} = community,
         branch,
         %DocTreeEvent{
           event_type: CMS.Const.tree_event(:node_delete),
           node_type: @tree_node_type_page
         } = event
       ) do
    event
    |> article_node_ids_from_tree_event()
    |> Enum.map(fn node_id ->
      with %DocTreeNode{} = node <- public_page_by_node_id(community.id, branch.id, node_id) do
        release_article_attrs_from_public_node(community.id, branch.id, node, [
          Checklist.tree_event_action(event)
        ])
      end
    end)
  end

  defp release_doc_snapshots_before_tree_event(_community, _branch, _event), do: []

  defp release_article_attrs_from_public_node(
         community_id,
         branch_id,
         %DocTreeNode{doc_id: doc_id} = node,
         actions
       )
       when not is_nil(doc_id) do
    with %DocSnapshot{} = snapshot <-
           latest_public_doc_snapshot(community_id, branch_id, doc_id) do
      %{
        doc_id: doc_id,
        snapshot_id: snapshot.id,
        node_id: node.node_id,
        group_node_id: node.parent_node_id,
        index: node.index,
        title: snapshot.title,
        actions: actions
      }
    end
  end

  defp release_article_attrs_from_public_node(_community_id, _branch_id, _node, _actions), do: nil

  defp merge_release_article_attrs(rows) do
    rows
    |> Enum.group_by(& &1.doc_id)
    |> Enum.map(fn {_doc_id, grouped_rows} ->
      Enum.reduce(grouped_rows, %{}, fn row, acc ->
        Map.merge(acc, row, fn
          :actions, left, right -> Enum.uniq(left ++ right)
          _key, nil, right -> right
          _key, left, nil -> left
          _key, _left, right -> right
        end)
      end)
    end)
  end

  defp create_release_tree_events(%DocPublishRelease{} = release, tree_events) do
    Result.map_while_ok(tree_events, fn event ->
      ORM.create(DocPublishReleaseTreeEvent, %{
        release_id: release.id,
        doc_tree_event_id: event.id,
        event_type: event.event_type,
        label: Checklist.tree_event_label(event),
        payload: event.payload,
        inverse_payload: event.inverse_payload
      })
    end)
  end

  defp public_page_by_doc_id(community_id, branch_id, doc_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community_id)
    |> where([n], n.branch_id == ^branch_id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.type == @tree_node_type_page)
    |> where([n], n.doc_id == ^doc_id)
    |> Repo.one()
  end

  defp public_page_by_node_id(community_id, branch_id, node_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community_id)
    |> where([n], n.branch_id == ^branch_id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.type == @tree_node_type_page)
    |> where([n], n.node_id == ^node_id)
    |> Repo.one()
  end

  defp latest_public_doc_snapshot(community_id, branch_id, doc_id) do
    DocSnapshot
    |> where([r], r.community_id == ^community_id)
    |> where([r], r.branch_id == ^branch_id)
    |> where([r], r.stage == CMS.Const.stage(:public))
    |> where([r], r.article_hash_id == ^doc_id)
    |> order_by([r], desc: r.revision_number, desc: r.id)
    |> limit(1)
    |> Repo.one()
  end

  defp article_node_ids_from_tree_event(%DocTreeEvent{
         node_type: @tree_node_type_page,
         node_id: id
       })
       when not is_nil(id),
       do: [id]

  defp article_node_ids_from_tree_event(_event), do: []

  defp actions_from_tree_events(tree_events, node_id) do
    tree_events
    |> Enum.filter(&(node_id in article_node_ids_from_tree_event(&1)))
    |> Enum.map(&Checklist.tree_event_action/1)
    |> Enum.uniq()
  end

  defp next_release_number(%Community{} = community, branch) do
    DocPublishRelease
    |> where([r], r.community_id == ^community.id)
    |> where([r], r.branch_id == ^branch.id)
    |> select([r], max(r.release_number))
    |> Repo.one()
    |> case do
      nil -> 1
      number -> number + 1
    end
  end
end
