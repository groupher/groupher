defmodule GroupherServer.CMS.DocTree.Write do
  @moduledoc """
  Mutation helpers for the dashboard docs tree draft.

  All operations here mutate draft tables only:

      create/update/move/delete
              |
              v
      doc_tree_node_drafts
      |
      +-- page nodes point at article_drafts via article_draft_id
      +-- link nodes store href directly
      +-- group nodes are root-only containers
      +-- pin nodes are root-only pointers to page/link nodes

  Creating a page without an explicit `doc_id` creates a default `ArticleDraft`
  first, then stores that draft id on the tree node. The
  GraphQL input/output field is still called `doc_id`; in this draft path it
  means `article_draft_id`.

  Every successful mutation bumps both the tree draft revision and the docs site
  draft revision through `DocTree.Revision`, so conflict checks and the future
  "has unpublished changes" flag stay in sync.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.Draft
  alias CMS.DocTree.{Events, Read, Revision}

  alias CMS.Model.{
    ArticleDraft,
    Community,
    DocTreeDraftState,
    DocTreeNodeDraft,
    DocTreeNodePublishMapping
  }

  alias Helper.{ORM, T, Transaction}
  alias Helper.Validator.Slug

  @type payload :: map()

  @spec create_group(Community.t(), map()) :: T.domain_res(payload())
  def create_group(%Community{} = community, args) do
    operate(community, args, fn state ->
      attrs =
        args
        |> Map.merge(%{type: :group, community_id: community.id, parent_id: nil})
        |> normalize_title_slug()
        |> unique_create_identity(community, nil)
        |> ensure_index(community, nil)

      with {:ok, node} <- ORM.create(DocTreeNodeDraft, attrs),
           {:ok, event_count} <- record_tree_events(community, args, [Events.create_event(node)]),
           {:ok, state} <- bump_revision(community, state, event_count) do
        {:ok, payload(community, state, node)}
      end
    end)
  end

  @spec create_page(Community.t(), map(), User.t() | nil) :: T.domain_res(payload())
  def create_page(%Community{} = community, args, user \\ nil) do
    operate(community, args, fn state ->
      with {:ok, parent} <- group_parent(community, Map.get(args, :parent_id)) do
        args =
          args
          |> normalize_title_slug()
          |> unique_create_page_identity(community, parent.id)

        with {:ok, args} <- ensure_page_article_draft(community, args, user) do
          attrs =
            args
            |> normalize_article_draft_id()
            |> Map.merge(%{type: :page, community_id: community.id, parent_id: parent.id})
            |> ensure_index(community, parent.id)

          with {:ok, node} <- ORM.create(DocTreeNodeDraft, attrs),
               {:ok, event_count} <-
                 record_tree_events(community, args, [Events.create_event(node)]),
               {:ok, state} <- bump_revision(community, state, event_count) do
            {:ok, payload(community, state, node)}
          end
        end
      end
    end)
  end

  @spec create_link(Community.t(), map()) :: T.domain_res(payload())
  def create_link(%Community{} = community, args) do
    operate(community, args, fn state ->
      with {:ok, parent} <- group_parent(community, Map.get(args, :parent_id)) do
        attrs =
          args
          |> Map.merge(%{type: :link, community_id: community.id, parent_id: parent.id})
          |> normalize_title_slug()
          |> unique_create_identity(community, parent.id)
          |> ensure_index(community, parent.id)

        with {:ok, node} <- ORM.create(DocTreeNodeDraft, attrs),
             {:ok, event_count} <-
               record_tree_events(community, args, [Events.create_event(node)]),
             {:ok, state} <- bump_revision(community, state, event_count) do
          {:ok, payload(community, state, node)}
        end
      end
    end)
  end

  @spec update_node(Community.t(), T.id(), map()) :: T.domain_res(payload())
  def update_node(%Community{} = community, id, args) do
    operate(community, args, fn state ->
      with {:ok, node} <- find_node(community, id),
           :ok <- validate_article_draft(community, Map.get(args, :doc_id)),
           attrs <- args |> normalize_article_draft_id() |> normalize_title_slug(),
           {:ok, updated_node} <- ORM.update(node, attrs),
           events <- Events.update_events(node, updated_node),
           {:ok, event_count} <- record_tree_events(community, args, events),
           {:ok, state} <- bump_revision(community, state, event_count) do
        {:ok, payload(community, state, updated_node)}
      end
    end)
  end

  @doc """
  Updates the staged article draft behind a docs page.

  The docs tree owns only the page-to-draft reference. Content parsing and
  persistence are delegated to `CMS.Articles.Draft`, then the docs site draft
  revision is bumped so publish/status UI can notice the content change.

  ## Examples

      iex> Write.update_draft(community, page.doc_id, %{body: json})
      {:ok, %ArticleDraft{thread: :doc}}
  """
  @spec update_draft(Community.t(), T.id(), map()) :: T.domain_res(ArticleDraft.t())
  def update_draft(%Community{} = community, id, args) do
    with {:ok, _site_state} <- Read.ensure_site_state(community),
         {:ok, draft} <- Draft.update(community, id, args),
         {:ok, _state} <- Revision.bump_site_draft(community) do
      {:ok, draft}
    end
  end

  @spec delete_node(Community.t(), T.id(), map()) :: T.domain_res(payload())
  def delete_node(%Community{} = community, id, args) do
    operate(community, args, fn state ->
      with {:ok, node} <- find_node(community, id),
           parent_id <- node.parent_id,
           node_type <- node.type,
           :ok <- delete_or_tombstone_subtree(community, node),
           :ok <- normalize_sibling_indexes(community, parent_id, node_type),
           {:ok, event_count} <- record_tree_events(community, args, [Events.delete_event(node)]),
           {:ok, state} <- bump_revision(community, state, event_count) do
        {:ok, payload(community, state, nil, affected_nodes(community, parent_id, node_type))}
      end
    end)
  end

  @spec duplicate_node(Community.t(), T.id(), map()) :: T.domain_res(payload())
  def duplicate_node(%Community{} = community, id, args) do
    operate(community, args, fn state ->
      with {:ok, node} <- find_node(community, id),
           false <- node.type in [:group, :pin] do
        attrs =
          node
          |> Map.take([
            :community_id,
            :parent_id,
            :article_draft_id,
            :type,
            :href,
            :marker,
            :badge,
            :hidden
          ])
          |> Map.merge(%{
            title: unique_copy_title(community, node.parent_id, node.title),
            slug: unique_copy_slug(community, node.parent_id, node.slug),
            index: node.index + 1,
            expanded: node.expanded
          })

        with :ok <-
               shift_sibling_indexes(community, node.parent_id, node.index + 1, nil, node.type),
             {:ok, duplicated} <- ORM.create(DocTreeNodeDraft, attrs),
             :ok <- normalize_sibling_indexes(community, node.parent_id, node.type),
             {:ok, event_count} <-
               record_tree_events(community, args, [Events.create_event(duplicated)]),
             {:ok, state} <- bump_revision(community, state, event_count) do
          {:ok,
           payload(
             community,
             state,
             duplicated,
             affected_nodes(community, node.parent_id, node.type)
           )}
        end
      else
        true -> {:error, {:custom, "group or pin nodes can not be duplicated"}}
        error -> error
      end
    end)
  end

  @spec move_node(Community.t(), T.id(), map()) :: T.domain_res(payload())
  def move_node(%Community{} = community, id, args) do
    operate(community, args, fn state ->
      target_parent_id = Map.get(args, :target_parent_id)
      target_index = Map.get(args, :target_index, 0)

      with {:ok, node} <- find_node(community, id),
           {:ok, parent_id} <- validate_target_parent(community, node, target_parent_id),
           old_parent_id <- node.parent_id,
           old_index <- node.index,
           :ok <- shift_sibling_indexes(community, parent_id, target_index, node.id, node.type),
           {:ok, node} <- ORM.update(node, %{parent_id: parent_id, index: target_index}),
           :ok <- normalize_sibling_indexes(community, old_parent_id, node.type),
           :ok <- normalize_sibling_indexes(community, parent_id, node.type),
           {:ok, event_count} <-
             record_tree_events(community, args, [
               Events.move_event(node, old_parent_id, old_index, parent_id, node.index)
             ]),
           {:ok, state} <- bump_revision(community, state, event_count) do
        affected =
          [old_parent_id, parent_id]
          |> Enum.uniq()
          |> Enum.flat_map(&affected_nodes(community, &1, node.type))

        {:ok, payload(community, state, node, affected)}
      end
    end)
  end

  defp operate(%Community{} = community, args, fun) do
    Transaction.lock_global("doc_tree:#{community.id}", fn ->
      with {:ok, _site_state} <- Read.ensure_site_state(community),
           {:ok, state} <- Read.ensure_draft_state(community),
           :ok <- revision_check(state, Map.get(args, :base_revision)) do
        fun.(state)
      else
        {:conflict, state} ->
          {:ok,
           %{
             revision: state.revision,
             tree_state: Read.tree_state(community, state),
             conflict: true,
             affected_nodes: []
           }}

        error ->
          error
      end
    end)
  end

  defp revision_check(%DocTreeDraftState{}, nil),
    do: {:error, {:custom, "base_revision is required"}}

  defp revision_check(%DocTreeDraftState{} = state, revision) when revision == state.revision,
    do: :ok

  defp revision_check(%DocTreeDraftState{} = state, _revision), do: {:conflict, state}

  defp bump_revision(%Community{} = community, %DocTreeDraftState{} = state, event_count),
    do: Revision.bump_draft(community, state, staged_event_delta: event_count)

  defp record_tree_events(%Community{} = community, args, events) do
    with {:ok, events} <- Events.record_staged_many(community, events, Map.get(args, :actor_id)) do
      {:ok, length(events)}
    end
  end

  defp payload(%Community{} = community, %DocTreeDraftState{} = state, node, affected \\ []) do
    %{
      revision: state.revision,
      tree_state: Read.tree_state(community, state),
      node: map_node(node),
      affected_nodes: Enum.map(affected, &Read.to_map/1),
      conflict: false
    }
  end

  defp map_node(nil), do: nil
  defp map_node(%DocTreeNodeDraft{} = node), do: Read.to_map(node)

  defp delete_or_tombstone_subtree(%Community{} = community, %DocTreeNodeDraft{} = node) do
    nodes = subtree_nodes(community, node)
    mapped_ids = mapped_draft_node_ids(community, Enum.map(nodes, & &1.id))
    deleted_at = DateTime.utc_now(:second)

    nodes
    |> Enum.reduce_while(:ok, fn node, :ok ->
      result =
        if MapSet.member?(mapped_ids, node.id) do
          ORM.update(node, %{deleted_at: deleted_at})
        else
          ORM.delete(node)
        end

      case result do
        {:ok, _node} -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  defp subtree_nodes(%Community{} = community, %DocTreeNodeDraft{type: :group} = group) do
    children =
      DocTreeNodeDraft
      |> where([n], n.community_id == ^community.id)
      |> where([n], is_nil(n.deleted_at))
      |> where([n], n.parent_id == ^group.id)
      |> order_by([n], desc: n.index, desc: n.id)
      |> Repo.all()

    children ++ [group]
  end

  defp subtree_nodes(_community, %DocTreeNodeDraft{} = node), do: [node]

  defp mapped_draft_node_ids(_community, []), do: MapSet.new()

  defp mapped_draft_node_ids(%Community{} = community, ids) do
    DocTreeNodePublishMapping
    |> where([m], m.community_id == ^community.id)
    |> where([m], m.draft_node_id in ^ids)
    |> select([m], m.draft_node_id)
    |> Repo.all()
    |> MapSet.new()
  end

  defp normalize_title_slug(args) do
    title = Map.get(args, :title)
    slug = Map.get(args, :slug)

    args =
      if is_binary(title) do
        Map.put(args, :title, String.trim(title))
      else
        args
      end

    cond do
      is_binary(slug) ->
        Map.put(args, :slug, String.trim(slug))

      is_binary(title) ->
        Map.put(args, :slug, Slug.normalize(title))

      true ->
        args
    end
  end

  defp normalize_article_draft_id(%{doc_id: doc_id} = args) do
    args
    |> Map.delete(:doc_id)
    |> Map.put(:article_draft_id, doc_id)
  end

  defp normalize_article_draft_id(args), do: args

  defp ensure_page_article_draft(%Community{} = community, %{doc_id: doc_id} = args, _user)
       when not is_nil(doc_id) do
    with :ok <- validate_article_draft(community, doc_id) do
      {:ok, args}
    end
  end

  defp ensure_page_article_draft(_community, args, nil), do: {:ok, args}

  defp ensure_page_article_draft(%Community{} = community, args, %User{} = user) do
    with {:ok, draft} <- create_default_article_draft(community, args, user) do
      {:ok, Map.put(args, :doc_id, draft.id)}
    end
  end

  defp create_default_article_draft(%Community{} = community, args, %User{} = user) do
    title = Map.get(args, :title, "Untitled")
    slug = Map.get(args, :slug) || normalize_doc_slug(title)

    Draft.create(
      community,
      :doc,
      %{title: title, slug: slug, body: default_page_body(title)},
      user
    )
  end

  defp default_page_body(title) do
    [
      %{
        "type" => "h1",
        "children" => [%{"text" => title}]
      },
      %{
        "type" => "p",
        "children" => [%{"text" => "Start writing your docs draft here."}]
      }
    ]
    |> Jason.encode!()
  end

  defp normalize_doc_slug(slug) do
    case Slug.normalize(slug) do
      "" -> "untitled"
      normalized -> normalized
    end
  end

  defp unique_create_identity(attrs, %Community{} = community, parent_id) do
    title = Map.get(attrs, :title)
    slug = Map.get(attrs, :slug)
    type = Map.get(attrs, :type)

    attrs
    |> Map.put(:title, unique_create_title(community, parent_id, type, title))
    |> Map.put(:slug, unique_create_slug(community, parent_id, type, slug))
  end

  defp unique_create_title(community, parent_id, type, title) do
    unique_value(community, parent_id, type, :title, title, " ")
  end

  defp unique_create_slug(community, parent_id, type, slug) do
    unique_value(community, parent_id, type, :slug, slug, "-")
  end

  defp unique_create_page_identity(attrs, %Community{} = community, parent_id) do
    title = Map.get(attrs, :title)
    slug = Map.get(attrs, :slug)

    type = Map.get(attrs, :type)

    if sibling_value_exists?(community, parent_id, type, :title, title) or
         sibling_value_exists?(community, parent_id, type, :slug, slug) do
      attrs
      |> Map.put(:title, unique_page_copy_title(community, parent_id, type, title))
      |> Map.put(:slug, unique_page_copy_slug(community, parent_id, type, slug))
    else
      attrs
    end
  end

  defp unique_page_copy_title(_community, _parent_id, _type, nil), do: nil

  defp unique_page_copy_title(community, parent_id, type, title) do
    unique_value(community, parent_id, type, :title, "#{title}-copy", "-")
  end

  defp unique_page_copy_slug(_community, _parent_id, _type, nil), do: nil

  defp unique_page_copy_slug(community, parent_id, type, slug) do
    unique_value(community, parent_id, type, :slug, "#{slug}-copy", "-")
  end

  defp ensure_index(attrs, %Community{} = community, parent_id) do
    case Map.get(attrs, :index) do
      nil -> Map.put(attrs, :index, next_index(community, parent_id, Map.get(attrs, :type)))
      _ -> attrs
    end
  end

  defp next_index(%Community{} = community, parent_id, type) do
    DocTreeNodeDraft
    |> where([n], n.community_id == ^community.id)
    |> where([n], is_nil(n.deleted_at))
    |> where_sibling_scope(parent_id, type)
    |> select([n], max(n.index))
    |> Repo.one()
    |> case do
      nil -> 0
      index -> index + 1
    end
  end

  defp find_node(%Community{} = community, id) do
    case Ecto.Type.cast(:id, id) do
      {:ok, id} ->
        DocTreeNodeDraft
        |> where([n], n.community_id == ^community.id)
        |> where([n], n.id == ^id)
        |> where([n], is_nil(n.deleted_at))
        |> Repo.one()
        |> case do
          %DocTreeNodeDraft{} = node -> {:ok, node}
          _ -> {:error, {:custom, "doc tree node not found"}}
        end

      :error ->
        {:error, {:custom, "invalid doc tree node id"}}
    end
  end

  defp group_parent(%Community{} = community, parent_id) do
    with {:ok, parent} <- find_node(community, parent_id),
         true <- parent.type == :group do
      {:ok, parent}
    else
      false -> {:error, {:custom, "doc tree parent must be a group"}}
      error -> error
    end
  end

  defp validate_target_parent(_community, %{type: type}, nil) when type in [:group, :pin],
    do: {:ok, nil}

  defp validate_target_parent(_community, %{type: type}, _parent_id)
       when type in [:group, :pin] do
    {:error, {:custom, "#{type} nodes must be root nodes"}}
  end

  defp validate_target_parent(community, _node, parent_id) do
    with {:ok, parent} <- group_parent(community, parent_id) do
      {:ok, parent.id}
    end
  end

  defp validate_article_draft(_community, nil), do: :ok

  defp validate_article_draft(%Community{} = community, doc_id) do
    case Ecto.Type.cast(:id, doc_id) do
      {:ok, doc_id} ->
        ArticleDraft
        |> where([d], d.community_id == ^community.id)
        |> where([d], d.thread == :doc)
        |> where([d], d.id == ^doc_id)
        |> Repo.exists?()
        |> case do
          true -> :ok
          false -> {:error, {:custom, "article draft not in same community"}}
        end

      :error ->
        {:error, {:custom, "invalid article draft id"}}
    end
  end

  defp shift_sibling_indexes(community, parent_id, from_index, exclude_id, type) do
    query =
      DocTreeNodeDraft
      |> where([n], n.community_id == ^community.id)
      |> where([n], is_nil(n.deleted_at))
      |> where_sibling_scope(parent_id, type)
      |> where([n], n.index >= ^from_index)

    query =
      if is_nil(exclude_id) do
        query
      else
        where(query, [n], n.id != ^exclude_id)
      end

    Repo.update_all(query, inc: [index: 1])
    :ok
  end

  defp normalize_sibling_indexes(%Community{} = community, parent_id, type) do
    DocTreeNodeDraft
    |> where([n], n.community_id == ^community.id)
    |> where([n], is_nil(n.deleted_at))
    |> where_sibling_scope(parent_id, type)
    |> order_by([n], asc: n.index, asc: n.id)
    |> Repo.all()
    |> Enum.with_index()
    |> Enum.each(fn {node, index} ->
      node
      |> Ecto.Changeset.change(%{index: index})
      |> Repo.update!()
    end)

    :ok
  end

  defp affected_nodes(%Community{} = community, parent_id, type) do
    DocTreeNodeDraft
    |> where([n], n.community_id == ^community.id)
    |> where([n], is_nil(n.deleted_at))
    |> where_sibling_scope(parent_id, type)
    |> order_by([n], asc: n.index, asc: n.id)
    |> Repo.all()
  end

  defp unique_copy_title(community, parent_id, title) do
    unique_value(community, parent_id, nil, :title, "#{title} copy", " ")
  end

  defp unique_copy_slug(community, parent_id, slug) do
    unique_value(community, parent_id, nil, :slug, "#{slug}-copy", "-")
  end

  defp sibling_value_exists?(_community, _parent_id, _type, _field, nil), do: false

  defp sibling_value_exists?(community, parent_id, type, field, value) do
    DocTreeNodeDraft
    |> where([n], n.community_id == ^community.id)
    |> where([n], is_nil(n.deleted_at))
    |> where_sibling_scope(parent_id, type)
    |> where([n], field(n, ^field) == ^value)
    |> Repo.exists?()
  end

  defp unique_value(community, parent_id, type, field, base, separator) do
    existing =
      DocTreeNodeDraft
      |> where([n], n.community_id == ^community.id)
      |> where([n], is_nil(n.deleted_at))
      |> where_sibling_scope(parent_id, type)
      |> select([n], field(n, ^field))
      |> Repo.all()
      |> MapSet.new()

    Stream.iterate(0, &(&1 + 1))
    |> Enum.find_value(fn
      0 ->
        if MapSet.member?(existing, base), do: nil, else: base

      index ->
        value = "#{base}#{separator}#{index}"
        if MapSet.member?(existing, value), do: nil, else: value
    end)
  end

  defp where_parent(query, nil), do: where(query, [n], is_nil(n.parent_id))
  defp where_parent(query, parent_id), do: where(query, [n], n.parent_id == ^parent_id)

  defp where_sibling_scope(query, nil, nil), do: where_parent(query, nil)

  defp where_sibling_scope(query, nil, type) do
    query
    |> where_parent(nil)
    |> where([n], n.type == ^type)
  end

  defp where_sibling_scope(query, parent_id, _type), do: where_parent(query, parent_id)
end
