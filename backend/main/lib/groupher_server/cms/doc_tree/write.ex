defmodule GroupherServer.CMS.DocTree.Write do
  @moduledoc """
  Mutation helpers for the docs tree draft stage.

  Every write targets `doc_tree_nodes(stage=draft)`. Explicit tree edits append
  `owner=tree` events for the Tree SavingBar. Creating a docs page appends an
  `owner=doc` event bound to the draft article so the node is published with the
  document content instead of through Tree publish.

      group/link/pin rename/sort/delete
                    |
                    v
      doc_tree_events(owner=tree)  ->  Tree SavingBar / Tree publish

      page create
                    |
                    v
      doc_tree_events(owner=doc, workspace_id)  ->  Doc publish
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.Draft
  alias CMS.DocTree.{Events, Read, Revision}
  alias CMS.Model.{ArticleWorkspace, Community, DocsSiteState, DocTreeNode, DocTreeTrashItem}
  alias Helper.{ORM, T, Transaction}
  alias Helper.Validator.Slug

  @type payload :: map()

  @doc """
  Creates a normal group in the draft tree.

  ## Examples

      iex> Write.create_group(community, %{title: "Guide", base_revision: 1})
      {:ok, %{node: %{type: :group}}}
  """
  @spec create_group(Community.t(), map()) :: T.domain_res(payload())
  def create_group(%Community{} = community, args) do
    operate(community, args, fn state ->
      attrs =
        args
        |> Map.merge(%{type: :group, community_id: community.id, stage: :draft, group_id: nil})
        |> put_new_node_id()
        |> normalize_title_slug()
        |> unique_create_identity(community, nil)
        |> ensure_index(community, nil)

      with {:ok, node} <- ORM.create(DocTreeNode, attrs),
           {:ok, event_count} <- record_tree_events(community, args, [Events.create_event(node)]),
           {:ok, state} <- bump_revision(community, state, event_count) do
        {:ok, payload(community, state, node)}
      end
    end)
  end

  @doc """
  Creates a page node and its default article draft when needed.

  ## Examples

      iex> Write.create_page(community, %{group_id: group.node_id, title: "Intro"}, user)
      {:ok, %{node: %{type: :page}}}
  """
  @spec create_page(Community.t(), map(), User.t() | nil) :: T.domain_res(payload())
  def create_page(%Community{} = community, args, user \\ nil) do
    operate(community, args, fn state ->
      with {:ok, parent} <- group_parent(community, Map.get(args, :group_id)),
           args <-
             args
             |> normalize_title_slug()
             |> unique_create_page_identity(community, parent.node_id),
           {:ok, args} <- ensure_page_article_workspace(community, args, user) do
        attrs =
          args
          |> Map.merge(%{
            type: :page,
            community_id: community.id,
            stage: :draft,
            group_id: parent.node_id
          })
          |> put_new_node_id()
          |> ensure_index(community, parent.node_id)

        with {:ok, node} <- ORM.create(DocTreeNode, attrs),
             {:ok, event_count} <-
               record_tree_events(community, args, [doc_owned_create_event(node)]),
             {:ok, state} <- bump_revision(community, state, event_count) do
          {:ok, payload(community, state, node)}
        end
      end
    end)
  end

  @doc """
  Creates a link node under a group.

  ## Examples

      iex> Write.create_link(community, %{group_id: group.node_id, href: "https://example.com"})
      {:ok, %{node: %{type: :link}}}
  """
  @spec create_link(Community.t(), map()) :: T.domain_res(payload())
  def create_link(%Community{} = community, args) do
    operate(community, args, fn state ->
      with {:ok, parent} <- group_parent(community, Map.get(args, :group_id)) do
        attrs =
          args
          |> Map.merge(%{
            type: :link,
            community_id: community.id,
            stage: :draft,
            group_id: parent.node_id
          })
          |> put_new_node_id()
          |> normalize_title_slug()
          |> unique_create_identity(community, parent.node_id)
          |> ensure_index(community, parent.node_id)

        with {:ok, node} <- ORM.create(DocTreeNode, attrs),
             {:ok, event_count} <-
               record_tree_events(community, args, [Events.create_event(node)]),
             {:ok, state} <- bump_revision(community, state, event_count) do
          {:ok, payload(community, state, node)}
        end
      end
    end)
  end

  @doc """
  Creates an independent top pin link.

  Pins are top-level link nodes. They do not point at existing tree pages, so
  deleting or publishing docs never changes pin identity.

  ## Examples

      iex> Write.create_pin(community, %{title: "GitHub", href: "https://github.com"})
      {:ok, %{node: %{type: :pin}}}
  """
  @spec create_pin(Community.t(), map()) :: T.domain_res(payload())
  def create_pin(%Community{} = community, args) do
    operate(community, args, fn state ->
      attrs =
        args
        |> Map.merge(%{
          type: :pin,
          community_id: community.id,
          stage: :draft,
          group_id: nil
        })
        |> put_new_node_id()
        |> normalize_title_slug()
        |> unique_create_identity(community, nil)
        |> ensure_index(community, nil)

      with {:ok, node} <- ORM.create(DocTreeNode, attrs),
           {:ok, event_count} <- record_tree_events(community, args, [Events.create_event(node)]),
           {:ok, state} <- bump_revision(community, state, event_count) do
        {:ok, payload(community, state, node)}
      end
    end)
  end

  @doc """
  Updates a draft tree node.

  ## Examples

      iex> Write.update_node(community, node.node_id, %{title: "Next"})
      {:ok, %{node: %{title: "Next"}}}
  """
  @spec update_node(Community.t(), T.id(), map()) :: T.domain_res(payload())
  def update_node(%Community{} = community, node_id, args) do
    operate(community, args, fn state ->
      with {:ok, node} <- find_node(community, node_id),
           :ok <- validate_article_workspace(community, Map.get(args, :workspace_id)),
           attrs <- normalize_title_slug(args),
           {:ok, updated_node} <- ORM.update(node, attrs),
           events <- Events.update_events(node, updated_node),
           {:ok, event_count} <- record_tree_events(community, args, events),
           {:ok, state} <- bump_revision(community, state, event_count) do
        {:ok, payload(community, state, updated_node)}
      end
    end)
  end

  @doc """
  Updates the staged article version behind a docs page.

  ## Examples

      iex> Write.update_draft(community, page.workspace_id, %{body: json})
      {:ok, %ArticleWorkspace{stage: :draft}}
  """
  @spec update_draft(Community.t(), T.id(), map()) :: T.domain_res(ArticleWorkspace.t())
  def update_draft(%Community{} = community, id, args) do
    with {:ok, _site_state} <- Read.ensure_site_state(community),
         {:ok, draft} <- Draft.update(community, id, args),
         {:ok, _state} <- Revision.bump_site_draft(community) do
      {:ok, draft}
    end
  end

  @doc """
  Deletes a draft tree node into docs trash.

  The trash snapshot is docs-specific because it stores Tree placement together
  with the staged article version. Other article threads use their own
  mark-delete flow.

  ## Examples

      iex> Write.delete_node(community, page.node_id, %{base_revision: 1})
      {:ok, %{affected_nodes: [_]}}
  """
  @spec delete_node(Community.t(), T.id(), map()) :: T.domain_res(payload())
  def delete_node(%Community{} = community, node_id, args) do
    operate(community, args, fn state ->
      with {:ok, node} <- find_node(community, node_id),
           group_id <- node.group_id,
           {:ok, _trash_items} <- trash_subtree(community, node, Map.get(args, :actor_id)),
           :ok <- delete_subtree(community, node),
           :ok <- normalize_sibling_indexes(community, group_id),
           {:ok, event_count} <- record_tree_events(community, args, [Events.delete_event(node)]),
           {:ok, state} <- bump_revision(community, state, event_count) do
        {:ok, payload(community, state, nil, affected_nodes(community, group_id))}
      end
    end)
  end

  @doc """
  Duplicates a page or link node.

  ## Examples

      iex> Write.duplicate_node(community, page.node_id, %{base_revision: 1})
      {:ok, %{node: %{title: "Intro copy"}}}
  """
  @spec duplicate_node(Community.t(), T.id(), map()) :: T.domain_res(payload())
  def duplicate_node(%Community{} = community, node_id, args) do
    operate(community, args, fn state ->
      with {:ok, node} <- find_node(community, node_id),
           false <- node.type in [:group, :pin] do
        attrs =
          node
          |> Map.take([
            :community_id,
            :stage,
            :group_id,
            :workspace_id,
            :type,
            :href,
            :marker,
            :badge,
            :hidden
          ])
          |> Map.merge(%{
            node_id: new_node_id(),
            title: unique_copy_title(community, node.group_id, node.title),
            slug: unique_copy_slug(community, node.group_id, node.slug),
            index: node.index + 1
          })

        with :ok <- shift_sibling_indexes(community, node.group_id, node.index + 1, node.node_id),
             {:ok, duplicated} <- ORM.create(DocTreeNode, attrs),
             :ok <- normalize_sibling_indexes(community, node.group_id),
             {:ok, event_count} <-
               record_tree_events(community, args, [Events.create_event(duplicated)]),
             {:ok, state} <- bump_revision(community, state, event_count) do
          {:ok, payload(community, state, duplicated, affected_nodes(community, node.group_id))}
        end
      else
        true -> {:error, {:custom, "group or pin nodes can not be duplicated"}}
        error -> error
      end
    end)
  end

  @doc """
  Moves one node inside an allowed draft tree group.

  Pin policy is enforced here: pins stay top-level, and normal page/link nodes
  can not be dragged into the top pin area.

  ## Examples

      iex> Write.move_node(community, page.node_id, %{target_group_id: group.node_id, target_index: 0})
      {:ok, %{affected_nodes: [_]}}
  """
  @spec move_node(Community.t(), T.id(), map()) :: T.domain_res(payload())
  def move_node(%Community{} = community, node_id, args) do
    operate(community, args, fn state ->
      target_group_id = Map.get(args, :target_group_id) || Map.get(args, :group_id)
      target_index = Map.get(args, :target_index, 0)

      with {:ok, node} <- find_node(community, node_id),
           {:ok, group_id} <- validate_target_group(community, node, target_group_id),
           old_group_id <- node.group_id,
           old_index <- node.index,
           :ok <- shift_sibling_indexes(community, group_id, target_index, node.node_id),
           {:ok, node} <- ORM.update(node, %{group_id: group_id, index: target_index}),
           :ok <- normalize_sibling_indexes(community, old_group_id),
           :ok <- normalize_sibling_indexes(community, group_id),
           {:ok, node} <- find_node(community, node.node_id),
           {:ok, event_count} <-
             record_tree_events(community, args, [
               Events.move_event(node, old_group_id, old_index, group_id, node.index)
             ]),
           {:ok, state} <- bump_revision(community, state, event_count) do
        affected =
          [old_group_id, group_id]
          |> Enum.uniq()
          |> Enum.flat_map(&affected_nodes(community, &1))

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
             revision: state.tree_lock_version,
             tree_state: Read.tree_state(community, state),
             conflict: true,
             affected_nodes: []
           }}

        error ->
          error
      end
    end)
  end

  defp revision_check(%DocsSiteState{}, nil),
    do: {:error, {:custom, "base_revision is required"}}

  defp revision_check(%DocsSiteState{} = state, revision)
       when revision == state.tree_lock_version,
       do: :ok

  defp revision_check(%DocsSiteState{} = state, _revision), do: {:conflict, state}

  defp bump_revision(%Community{} = community, %DocsSiteState{} = state, event_count),
    do: Revision.bump_tree_draft(community, state, staged_event_delta: event_count)

  defp record_tree_events(%Community{} = community, args, events) do
    with {:ok, events} <- Events.record_staged_many(community, events, Map.get(args, :actor_id)) do
      {:ok, Enum.count(events, &(&1.owner == :tree))}
    end
  end

  defp doc_owned_create_event(%DocTreeNode{} = node) do
    node
    |> Events.create_event()
    |> Map.merge(%{owner: :doc, workspace_id: node.workspace_id})
  end

  defp payload(%Community{} = community, %DocsSiteState{} = state, node, affected \\ []) do
    %{
      revision: state.tree_lock_version,
      tree_state: Read.tree_state(community, state),
      node: map_node(node),
      affected_nodes: Enum.map(affected, &Read.to_map/1),
      conflict: false
    }
  end

  defp map_node(nil), do: nil
  defp map_node(%DocTreeNode{} = node), do: Read.to_map(node)

  defp trash_subtree(%Community{} = community, %DocTreeNode{} = node, actor_id) do
    nodes = subtree_nodes(community, node)

    nodes
    |> Enum.reduce_while({:ok, []}, fn node, {:ok, acc} ->
      attrs = trash_attrs(community, node, actor_id)

      case ORM.create(DocTreeTrashItem, attrs) do
        {:ok, item} -> {:cont, {:ok, [item | acc]}}
        error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, items} -> {:ok, Enum.reverse(items)}
      error -> error
    end
  end

  defp trash_attrs(%Community{} = community, %DocTreeNode{} = node, actor_id) do
    %{
      community_id: community.id,
      node_id: node.node_id,
      article_id: node.doc_id,
      workspace_id: node.workspace_id,
      node_snapshot: Read.to_map(node),
      deleted_from_group_id: node.group_id,
      deleted_from_index: node.index,
      deleted_at: DateTime.utc_now(:second),
      deleted_by_id: actor_id
    }
  end

  defp delete_subtree(%Community{} = community, %DocTreeNode{} = node) do
    nodes = subtree_nodes(community, node)

    nodes
    |> Enum.reduce_while(:ok, fn node, :ok ->
      case ORM.delete(node) do
        {:ok, _node} -> {:cont, :ok}
        error -> {:halt, error}
      end
    end)
  end

  defp subtree_nodes(%Community{} = community, %DocTreeNode{type: :group} = group) do
    children =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.stage == :draft)
      |> where([n], n.group_id == ^group.node_id)
      |> order_by([n], desc: n.index, desc: n.id)
      |> Repo.all()

    children ++ [group]
  end

  defp subtree_nodes(_community, %DocTreeNode{} = node), do: [node]

  defp normalize_title_slug(args) do
    title = Map.get(args, :title)
    slug = Map.get(args, :slug)

    args = if is_binary(title), do: Map.put(args, :title, String.trim(title)), else: args

    cond do
      is_binary(slug) -> Map.put(args, :slug, String.trim(slug))
      is_binary(title) -> Map.put(args, :slug, Slug.normalize(title))
      true -> args
    end
  end

  defp ensure_page_article_workspace(
         %Community{} = community,
         %{workspace_id: workspace_id} = args,
         _user
       )
       when not is_nil(workspace_id) do
    with :ok <- validate_article_workspace(community, workspace_id), do: {:ok, args}
  end

  defp ensure_page_article_workspace(_community, args, nil), do: {:ok, args}

  defp ensure_page_article_workspace(%Community{} = community, args, %User{} = user) do
    with {:ok, draft} <- create_default_article_workspace(community, args, user) do
      {:ok, Map.put(args, :workspace_id, draft.id)}
    end
  end

  defp create_default_article_workspace(%Community{} = community, args, %User{} = user) do
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
      %{"type" => "h1", "children" => [%{"text" => title}]},
      %{"type" => "p", "children" => [%{"text" => "Start writing your docs draft here."}]}
    ]
    |> Jason.encode!()
  end

  defp normalize_doc_slug(slug) do
    case Slug.normalize(slug) do
      "" -> "untitled"
      normalized -> normalized
    end
  end

  defp put_new_node_id(attrs), do: Map.put_new(attrs, :node_id, new_node_id())
  defp new_node_id, do: Ecto.UUID.generate()

  defp unique_create_identity(attrs, %Community{} = community, group_id) do
    title = Map.get(attrs, :title)
    slug = Map.get(attrs, :slug)
    type = Map.get(attrs, :type)

    attrs
    |> Map.put(:title, unique_value(community, group_id, type, :title, title, " "))
    |> Map.put(:slug, unique_value(community, group_id, type, :slug, slug, "-"))
  end

  defp unique_create_page_identity(attrs, %Community{} = community, group_id) do
    title = Map.get(attrs, :title)
    slug = Map.get(attrs, :slug)
    type = Map.get(attrs, :type)

    if sibling_value_exists?(community, group_id, type, :title, title) or
         sibling_value_exists?(community, group_id, type, :slug, slug) do
      attrs
      |> Map.put(:title, unique_value(community, group_id, type, :title, "#{title}-copy", "-"))
      |> Map.put(:slug, unique_value(community, group_id, type, :slug, "#{slug}-copy", "-"))
    else
      attrs
    end
  end

  defp ensure_index(attrs, %Community{} = community, group_id) do
    case Map.get(attrs, :index) do
      nil -> Map.put(attrs, :index, next_index(community, group_id, Map.get(attrs, :type)))
      _ -> attrs
    end
  end

  defp next_index(%Community{} = community, group_id, type) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.stage == :draft)
    |> where_sibling_scope(group_id, type)
    |> select([n], max(n.index))
    |> Repo.one()
    |> case do
      nil -> 0
      index -> index + 1
    end
  end

  defp find_node(%Community{} = community, node_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.stage == :draft)
    |> where([n], n.node_id == ^to_string(node_id))
    |> Repo.one()
    |> case do
      %DocTreeNode{} = node -> {:ok, node}
      _ -> {:error, {:custom, "doc tree node not found"}}
    end
  end

  defp group_parent(%Community{} = community, group_id) do
    with {:ok, parent} <- find_node(community, group_id),
         true <- parent.type == :group do
      {:ok, parent}
    else
      false -> {:error, {:custom, "doc tree parent must be a group"}}
      error -> error
    end
  end

  defp validate_target_group(_community, %{type: :group}, nil), do: {:ok, nil}

  defp validate_target_group(_community, %{type: :group}, _),
    do: {:error, {:custom, "group nodes must be root nodes"}}

  defp validate_target_group(_community, %{type: :pin}, nil), do: {:ok, nil}

  defp validate_target_group(_community, %{type: :pin}, _),
    do: {:error, {:custom, "pin nodes can only move inside top pins"}}

  defp validate_target_group(_community, %{type: type}, "pin") when type in [:page, :link],
    do: {:error, {:custom, "docs can not be dragged into top pins"}}

  defp validate_target_group(community, _node, group_id) do
    with {:ok, parent} <- group_parent(community, group_id), do: {:ok, parent.node_id}
  end

  defp validate_article_workspace(_community, nil), do: :ok

  defp validate_article_workspace(%Community{} = community, workspace_id) do
    ArticleWorkspace
    |> where([d], d.community_id == ^community.id)
    |> where([d], d.article_thread == :doc)
    |> where([d], d.stage == :draft)
    |> where([d], d.id == ^workspace_id)
    |> Repo.exists?()
    |> case do
      true -> :ok
      false -> {:error, {:custom, "article draft not in same community"}}
    end
  end

  defp shift_sibling_indexes(community, group_id, from_index, exclude_node_id) do
    query =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.stage == :draft)
      |> where_sibling_scope(group_id, nil)
      |> where([n], n.index >= ^from_index)

    query =
      if is_nil(exclude_node_id),
        do: query,
        else: where(query, [n], n.node_id != ^exclude_node_id)

    Repo.update_all(query, inc: [index: 1])
    :ok
  end

  defp normalize_sibling_indexes(%Community{} = community, group_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.stage == :draft)
    |> where_sibling_scope(group_id, nil)
    |> order_by([n], asc: n.index, asc: n.id)
    |> Repo.all()
    |> Enum.with_index()
    |> Enum.each(fn {node, index} ->
      node |> Ecto.Changeset.change(%{index: index}) |> Repo.update!()
    end)

    :ok
  end

  defp affected_nodes(%Community{} = community, group_id) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.stage == :draft)
    |> where_sibling_scope(group_id, nil)
    |> order_by([n], asc: n.index, asc: n.id)
    |> Repo.all()
  end

  defp unique_copy_title(community, group_id, title),
    do: unique_value(community, group_id, nil, :title, "#{title} copy", " ")

  defp unique_copy_slug(community, group_id, slug),
    do: unique_value(community, group_id, nil, :slug, "#{slug}-copy", "-")

  defp sibling_value_exists?(_community, _group_id, _type, _field, nil), do: false

  defp sibling_value_exists?(community, group_id, type, field, value) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.stage == :draft)
    |> where_sibling_scope(group_id, type)
    |> where([n], field(n, ^field) == ^value)
    |> Repo.exists?()
  end

  defp unique_value(_community, _group_id, _type, _field, nil, _separator), do: nil

  defp unique_value(community, group_id, type, field, base, separator) do
    existing =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.stage == :draft)
      |> where_sibling_scope(group_id, type)
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

  defp where_group(query, nil), do: where(query, [n], is_nil(n.group_id))
  defp where_group(query, group_id), do: where(query, [n], n.group_id == ^group_id)

  defp where_sibling_scope(query, nil, nil), do: where_group(query, nil)

  defp where_sibling_scope(query, nil, type) do
    query |> where_group(nil) |> where([n], n.type == ^type)
  end

  defp where_sibling_scope(query, group_id, _type), do: where_group(query, group_id)
end
