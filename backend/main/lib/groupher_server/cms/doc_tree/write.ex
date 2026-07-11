defmodule GroupherServer.CMS.DocTree.Write do
  @moduledoc """
  Mutation helpers for the docs tree draft stage.

  Every write targets `doc_tree_nodes(stage=draft)`. Explicit tree edits append
  `owner=tree` events for the Tree SavingBar. Creating a docs page appends an
  `owner=doc` event bound to the draft doc so the node is published with the
  document content instead of through Tree publish.

      group/link/pin rename/sort/delete
                    |
                    v
      doc_tree_events(owner=tree)  ->  Tree SavingBar / Tree publish

      page create
                    |
                    v
      doc_tree_events(owner=doc, doc_id)  ->  Doc publish
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.DocTree.{Events, Read}

  alias CMS.DocTree.Write.{
    DraftDoc,
    EventRecorder,
    Identity,
    Index,
    Node,
    Operation,
    Trash
  }

  alias CMS.Model.{
    Doc,
    Community,
    DocTreeNode
  }

  alias Helper.{ORM, T}

  require CMS.Const

  @type payload :: map()

  @doc "Creates a top-level docs tab."
  @spec create_tab(Community.t(), map()) :: T.domain_res(payload())
  def create_tab(%Community{} = community, args) do
    Operation.run(community, args, fn branch, state ->
      with {:ok, default_tab, default_events} <- ensure_group_tab(community, branch, nil) do
        attrs =
          args
          |> Map.delete(:index)
          |> Map.merge(%{
            type: :tab,
            community_id: community.id,
            branch_id: branch.id,
            stage: CMS.Const.stage(:draft),
            tab_id: nil,
            group_id: nil
          })
          |> Node.put_new_node_id()
          |> Identity.normalize_title_slug()
          |> Identity.unique_create_identity(community, branch, nil)
          |> Index.ensure_index(community, branch, nil)

        with {:ok, node} <- ORM.create(DocTreeNode, attrs),
             group_attrs <-
               %{
                 type: :group,
                 community_id: community.id,
                 branch_id: branch.id,
                 stage: CMS.Const.stage(:draft),
                 tab_id: node.node_id,
                 group_id: nil,
                 title: "Untitled",
                 slug: "untitled",
                 index: 0
               }
               |> Node.put_new_node_id()
               |> Identity.unique_create_identity(community, branch, node.node_id),
             {:ok, group} <- ORM.create(DocTreeNode, group_attrs),
             {:ok, event_count} <-
               EventRecorder.record_tree_events(
                 community,
                 branch,
                 args,
                 default_events ++ [Events.create_event(node), Events.create_event(group)]
               ),
             {:ok, state} <- Operation.bump_revision(community, state, event_count) do
          affected = if default_events == [], do: [group], else: [default_tab, group]

          {:ok, Operation.payload(community, state, node, affected)}
        end
      end
    end)
  end

  @doc """
  Creates a normal group in the draft tree.

  ## Examples

      iex> Write.create_group(community, %{title: "Guide", base_revision: 1})
      {:ok, %{node: %{type: :group}}}
  """
  @spec create_group(Community.t(), map()) :: T.domain_res(payload())
  def create_group(%Community{} = community, args) do
    Operation.run(community, args, fn branch, state ->
      with {:ok, tab, tab_events} <- ensure_group_tab(community, branch, Map.get(args, :tab_id)) do
        attrs =
          args
          |> Map.merge(%{
            type: :group,
            community_id: community.id,
            branch_id: branch.id,
            stage: CMS.Const.stage(:draft),
            tab_id: tab.node_id,
            group_id: nil
          })
          |> Node.put_new_node_id()
          |> Identity.normalize_title_slug()
          |> Identity.unique_create_identity(community, branch, tab.node_id)
          |> Index.ensure_index(community, branch, tab.node_id)

        with {:ok, node} <- ORM.create(DocTreeNode, attrs),
             {:ok, event_count} <-
               EventRecorder.record_tree_events(
                 community,
                 branch,
                 args,
                 tab_events ++ [Events.create_event(node)]
               ),
             {:ok, state} <- Operation.bump_revision(community, state, event_count) do
          {:ok, Operation.payload(community, state, node)}
        end
      end
    end)
  end

  @doc """
  Creates a page node and its default doc draft when needed.

  ## Examples

      iex> Write.create_page(community, %{group_id: group.node_id, title: "Intro"}, user)
      {:ok, %{node: %{type: :page}}}
  """
  @spec create_page(Community.t(), map(), User.t() | nil) :: T.domain_res(payload())
  def create_page(%Community{} = community, args, user \\ nil) do
    Operation.run(community, args, fn branch, state ->
      with {:ok, parent} <- Node.group_parent(community, branch, Map.get(args, :group_id)),
           args <-
             args
             |> Identity.normalize_title_slug()
             |> Identity.unique_create_page_identity(community, branch, parent.node_id),
           {:ok, args} <- DraftDoc.ensure(community, branch, args, user) do
        attrs =
          args
          |> Map.merge(%{
            type: :page,
            community_id: community.id,
            branch_id: branch.id,
            stage: CMS.Const.stage(:draft),
            group_id: parent.node_id
          })
          |> Node.put_new_node_id()
          |> Index.ensure_index(community, branch, parent.node_id)

        with {:ok, node} <- ORM.create(DocTreeNode, attrs),
             {:ok, event_count} <-
               EventRecorder.record_tree_events(community, branch, args, [
                 EventRecorder.doc_owned_create_event(node)
               ]),
             {:ok, state} <- Operation.bump_revision(community, state, event_count) do
          {:ok, Operation.payload(community, state, node)}
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
    Operation.run(community, args, fn branch, state ->
      with {:ok, parent} <- Node.group_parent(community, branch, Map.get(args, :group_id)) do
        attrs =
          args
          |> Map.merge(%{
            type: :link,
            community_id: community.id,
            branch_id: branch.id,
            stage: CMS.Const.stage(:draft),
            group_id: parent.node_id
          })
          |> Node.put_new_node_id()
          |> Identity.normalize_title_slug()
          |> Identity.unique_create_identity(community, branch, parent.node_id)
          |> Index.ensure_index(community, branch, parent.node_id)

        with {:ok, node} <- ORM.create(DocTreeNode, attrs),
             {:ok, event_count} <-
               EventRecorder.record_tree_events(community, branch, args, [
                 Events.create_event(node)
               ]),
             {:ok, state} <- Operation.bump_revision(community, state, event_count) do
          {:ok, Operation.payload(community, state, node)}
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
    Operation.run(community, args, fn branch, state ->
      with {:ok, tab, tab_events} <- ensure_group_tab(community, branch, Map.get(args, :tab_id)) do
        attrs =
          args
          |> Map.merge(%{
            type: :pin,
            community_id: community.id,
            branch_id: branch.id,
            stage: CMS.Const.stage(:draft),
            tab_id: tab.node_id,
            group_id: nil
          })
          |> Node.put_new_node_id()
          |> Identity.normalize_title_slug()
          |> Identity.unique_create_identity(community, branch, tab.node_id)
          |> Index.ensure_index(community, branch, tab.node_id)

        with {:ok, node} <- ORM.create(DocTreeNode, attrs),
             {:ok, event_count} <-
               EventRecorder.record_tree_events(
                 community,
                 branch,
                 args,
                 tab_events ++ [Events.create_event(node)]
               ),
             {:ok, state} <- Operation.bump_revision(community, state, event_count) do
          {:ok, Operation.payload(community, state, node)}
        end
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
    Operation.run(community, args, fn branch, state ->
      with {:ok, node} <- Node.find(community, branch, node_id),
           :ok <- DraftDoc.validate(community, branch, Map.get(args, :doc_id)),
           attrs <- Identity.normalize_title_slug(args),
           :ok <- Identity.validate_pending_deleted_identity(community, branch, node, attrs),
           {:ok, updated_node} <- ORM.update(node, attrs),
           events <- Events.update_events(node, updated_node),
           {:ok, event_count} <- EventRecorder.record_tree_events(community, branch, args, events),
           {:ok, state} <- Operation.bump_revision(community, state, event_count) do
        {:ok, Operation.payload(community, state, updated_node)}
      end
    end)
  end

  @doc """
  Updates the staged doc version behind a docs page.

  ## Examples

      iex> Write.update_draft(community, page.doc_id, %{body: json})
      {:ok, %Doc{stage: CMS.Const.stage(:draft)}}
  """
  @spec update_draft(Community.t(), String.t(), map(), User.t()) :: T.domain_res(Doc.t())
  def update_draft(%Community{} = community, doc_id, args, %User{} = user) do
    with {:ok, branch} <- CMS.DocTree.Branch.resolve(community, args) do
      DraftDoc.update(community, branch, doc_id, args, user)
    end
  end

  @doc """
  Deletes a draft tree node into docs trash.

  The trash snapshot is docs-specific because it stores Tree placement together
  with the staged doc version. Other article threads use their own
  mark-delete flow.

  ## Examples

      iex> Write.delete_node(community, page.node_id, %{base_revision: 1})
      {:ok, %{affected_nodes: [_]}}
  """
  @spec delete_node(Community.t(), T.id(), map()) :: T.domain_res(payload())
  def delete_node(%Community{} = community, node_id, args) do
    Operation.run(community, args, fn branch, state ->
      with {:ok, node} <- Node.find(community, branch, node_id),
           :ok <- validate_delete_node(community, branch, node),
           parent_id <- node.tab_id || node.group_id,
           subtree <- Trash.subtree_nodes(community, branch, node),
           {:ok, _trash_items} <-
             Trash.trash_subtree(community, branch, subtree, Map.get(args, :actor_id)),
           :ok <- Trash.delete_subtree_doc_drafts(community, branch, subtree),
           :ok <- Trash.delete_subtree(subtree),
           :ok <- Index.normalize_sibling_indexes(community, branch, parent_id, node.type),
           {:ok, event_delta} <-
             EventRecorder.record_delete_or_discard_tree_events(
               community,
               branch,
               args,
               node,
               subtree
             ),
           {:ok, state} <- Operation.bump_revision(community, state, event_delta) do
        {:ok,
         Operation.payload(
           community,
           state,
           nil,
           Index.affected_nodes(community, branch, parent_id, node.type)
         )}
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
    Operation.run(community, args, fn branch, state ->
      with {:ok, node} <- Node.find(community, branch, node_id),
           false <- node.type in [:group, :pin] do
        attrs =
          node
          |> Map.take([
            :community_id,
            :branch_id,
            :stage,
            :group_id,
            :doc_id,
            :type,
            :href,
            :marker,
            :badge,
            :hidden
          ])
          |> Map.merge(%{
            node_id: Node.new_node_id(),
            title: Identity.unique_copy_title(community, branch, node.group_id, node.title),
            slug: Identity.unique_copy_slug(community, branch, node.group_id, node.slug),
            index: node.index + 1
          })

        with :ok <-
               Index.shift_sibling_indexes(
                 community,
                 branch,
                 node.group_id,
                 node.type,
                 node.index + 1,
                 node.node_id
               ),
             {:ok, duplicated} <- ORM.create(DocTreeNode, attrs),
             :ok <- Index.normalize_sibling_indexes(community, branch, node.group_id, node.type),
             {:ok, event_count} <-
               EventRecorder.record_tree_events(community, branch, args, [
                 Events.create_event(duplicated)
               ]),
             {:ok, state} <- Operation.bump_revision(community, state, event_count) do
          {:ok,
           Operation.payload(
             community,
             state,
             duplicated,
             Index.affected_nodes(community, branch, node.group_id, node.type)
           )}
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
    Operation.run(community, args, fn branch, state ->
      target_tab_id = Map.get(args, :target_tab_id) || Map.get(args, :tab_id)
      target_group_id = Map.get(args, :target_group_id) || Map.get(args, :group_id)
      target_index = Map.get(args, :target_index, 0)

      with {:ok, node} <- Node.find(community, branch, node_id),
           {:ok, {tab_id, group_id}} <-
             Node.validate_target(
               community,
               branch,
               node,
               target_tab_id || node.tab_id,
               target_group_id
             ),
           old_parent_id <- node.tab_id || node.group_id,
           parent_id <- tab_id || group_id,
           old_index <- node.index,
           :ok <-
             Index.shift_sibling_indexes(
               community,
               branch,
               parent_id,
               node.type,
               target_index,
               node.node_id
             ),
           {:ok, node} <-
             ORM.update(node, %{tab_id: tab_id, group_id: group_id, index: target_index}),
           :ok <- Index.normalize_sibling_indexes(community, branch, old_parent_id, node.type),
           :ok <- Index.normalize_sibling_indexes(community, branch, parent_id, node.type),
           {:ok, node} <- Node.find(community, branch, node.node_id),
           {:ok, event_count} <-
             EventRecorder.record_tree_events(community, branch, args, [
               Events.move_event(node, old_parent_id, old_index, parent_id, node.index)
             ]),
           {:ok, state} <- Operation.bump_revision(community, state, event_count) do
        affected =
          [old_parent_id, parent_id]
          |> Enum.uniq()
          |> Enum.flat_map(&Index.affected_nodes(community, branch, &1, node.type))

        {:ok, Operation.payload(community, state, node, affected)}
      end
    end)
  end

  defp ensure_group_tab(%Community{} = community, branch, tab_id) when not is_nil(tab_id) do
    with {:ok, tab} <- Node.tab_parent(community, branch, tab_id), do: {:ok, tab, []}
  end

  defp ensure_group_tab(%Community{} = community, branch, nil) do
    case Node.first_tab(community, branch) do
      %DocTreeNode{} = tab ->
        {:ok, tab, []}

      nil ->
        attrs = %{
          type: :tab,
          community_id: community.id,
          branch_id: branch.id,
          stage: CMS.Const.stage(:draft),
          tab_id: nil,
          group_id: nil,
          title: "Introduction",
          slug: "introduction",
          index: 0,
          node_id: Node.new_node_id()
        }

        with {:ok, tab} <- ORM.create(DocTreeNode, attrs),
             do: {:ok, tab, [Events.create_event(tab)]}
    end
  end

  defp validate_delete_node(%Community{} = community, branch, %DocTreeNode{type: :tab}) do
    case Node.first_tab(community, branch) do
      nil ->
        {:error, {:custom, "docs tree must keep one tab"}}

      _ ->
        tab_count =
          Read.tree_nodes!(community, [branch_id: branch.id], CMS.Const.stage(:draft))
          |> Enum.count(&(&1.type == :tab))

        if tab_count > 1,
          do: :ok,
          else: {:error, {:custom, "the last docs tab can not be deleted"}}
    end
  end

  defp validate_delete_node(_community, _branch, _node), do: :ok
end
