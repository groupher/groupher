defmodule GroupherServer.CMS.DocTree.Writer do
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

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Artiment.BodyBag
  alias CMS.Articles.{Draft, Lock}
  alias CMS.DocTree.{Events, Reader}

  alias CMS.DocTree.Writer.{
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
      attrs =
        args
        |> Map.merge(%{
          type: :tab,
          community_id: community.id,
          branch_id: branch.id,
          stage: CMS.Const.stage(:draft),
          parent_node_id: nil
        })
        |> Node.put_new_node_id()
        |> Identity.normalize_title_slug()
        |> Identity.unique_create_identity(community, branch, nil)
        |> Index.ensure_index(community, branch, nil)

      with {:ok, node} <- ORM.create(DocTreeNode, attrs),
           {:ok, event_count} <-
             EventRecorder.record_tree_events(community, branch, args, [
               Events.create_event(node)
             ]),
           {:ok, state} <- Operation.bump_revision(community, state, event_count) do
        {:ok, Operation.payload(community, state, node)}
      end
    end)
  end

  @doc """
  Creates a normal group in the draft tree.

  ## Examples

      iex> Writer.create_group(community, %{title: "Guide", base_revision: 1})
      {:ok, %{node: %{type: :group}}}
  """
  @spec create_group(Community.t(), map()) :: T.domain_res(payload())
  def create_group(%Community{} = community, args) do
    Operation.run(community, args, fn branch, state ->
      with {:ok, parent} <-
             Node.navigation_parent(community, branch, Map.get(args, :parent_node_id)) do
        attrs =
          args
          |> Map.merge(%{
            type: :group,
            community_id: community.id,
            branch_id: branch.id,
            stage: CMS.Const.stage(:draft),
            parent_node_id: parent.node_id
          })
          |> Node.put_new_node_id()
          |> Identity.normalize_title_slug()
          |> Identity.unique_create_identity(community, branch, parent.node_id)
          |> Index.ensure_index(community, branch, parent.node_id)

        with {:ok, node} <- ORM.create(DocTreeNode, attrs),
             {:ok, event_count} <-
               EventRecorder.record_tree_events(
                 community,
                 branch,
                 args,
                 [Events.create_event(node)]
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

      iex> Writer.create_page(community, %{parent_node_id: group.node_id, title: "Intro"}, user)
      {:ok, %{node: %{type: :page}}}
  """
  @spec create_page(Community.t(), map(), User.t() | nil) :: T.domain_res(payload())
  def create_page(%Community{} = community, args, user \\ nil) do
    Operation.run(community, args, fn branch, state ->
      with {:ok, parent} <-
             Node.group_parent(community, branch, Map.get(args, :parent_node_id)),
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
            parent_node_id: parent.node_id
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

      iex> Writer.create_link(community, %{parent_node_id: group.node_id, href: "https://example.com"})
      {:ok, %{node: %{type: :link}}}
  """
  @spec create_link(Community.t(), map()) :: T.domain_res(payload())
  def create_link(%Community{} = community, args) do
    Operation.run(community, args, fn branch, state ->
      with {:ok, parent} <-
             Node.group_parent(community, branch, Map.get(args, :parent_node_id)) do
        attrs =
          args
          |> Map.merge(%{
            type: :link,
            community_id: community.id,
            branch_id: branch.id,
            stage: CMS.Const.stage(:draft),
            parent_node_id: parent.node_id
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

      iex> Writer.create_pin(community, %{title: "GitHub", href: "https://github.com"})
      {:ok, %{node: %{type: :pin}}}
  """
  @spec create_pin(Community.t(), map()) :: T.domain_res(payload())
  def create_pin(%Community{} = community, args) do
    Operation.run(community, args, fn branch, state ->
      with {:ok, tab} <- Node.pin_parent(community, branch, Map.get(args, :parent_node_id)) do
        attrs =
          args
          |> Map.merge(%{
            type: :pin,
            community_id: community.id,
            branch_id: branch.id,
            stage: CMS.Const.stage(:draft),
            parent_node_id: tab.node_id
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
                 [Events.create_event(node)]
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

      iex> Writer.update_node(community, node.node_id, %{title: "Next"})
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

      iex> Writer.update_draft(community, page.doc_id, %{body_bag: body_bag})
      {:ok, %Doc{stage: CMS.Const.stage(:draft)}}
  """
  @spec update_draft(Community.t(), String.t(), map(), User.t()) :: T.domain_res(Doc.t())
  def update_draft(%Community{} = community, doc_id, args, %User{} = user) do
    with {:ok, branch} <- CMS.Articles.Branch.resolve(community, :doc, args) do
      DraftDoc.update(community, branch, doc_id, args, user)
    end
  end

  @doc """
  Moves one logical Docs subtree into Trash immediately.

  Draft/public Tree placement snapshots are stored together, while every page
  Doc joins the shared Article Trash without copying its content.

  ## Examples

      iex> Writer.delete_node(community, page.node_id, %{base_revision: 1})
      {:ok, %{affected_nodes: [_]}}
  """
  @spec delete_node(Community.t(), T.id(), map()) :: T.domain_res(payload())
  def delete_node(%Community{} = community, node_id, args) do
    Operation.run(community, args, fn branch, state ->
      with {:ok, node} <- Node.find(community, branch, node_id),
           :ok <- validate_delete_node(community, branch, node),
           {:ok, actor} <- load_actor(args, "Docs Trash requires an authenticated actor"),
           parent_id <- node.parent_node_id,
           {:ok, trash_result} <- Trash.trash_subtree(community, branch, node, actor),
           :ok <- Index.normalize_sibling_indexes(community, branch, parent_id, node.type),
           event_delta <- -trash_result.discarded_tree_events,
           {:ok, state} <- Operation.bump_revision(community, state, event_delta) do
        {:ok,
         Operation.payload(
           community,
           state,
           nil,
           Index.affected_nodes(community, branch, parent_id, node.type)
         )}
      else
        error -> error
      end
    end)
  end

  @doc """
  Duplicates a Group subtree, Page, or Link.

  ## Examples

      iex> Writer.duplicate_node(community, page.node_id, %{base_revision: 1})
      {:ok, %{node: %{title: "Intro copy"}}}
  """
  @spec duplicate_node(Community.t(), T.id(), map()) :: T.domain_res(payload())
  def duplicate_node(%Community{} = community, node_id, args) do
    Operation.run(community, args, fn branch, state ->
      with {:ok, node} <- Node.find(community, branch, node_id),
           true <- node.type in [:group, :page, :link],
           {:ok, duplicated_nodes} <- duplicate_nodes(community, branch, node, args),
           duplicated <- List.first(duplicated_nodes),
           :ok <-
             Index.normalize_sibling_indexes(
               community,
               branch,
               node.parent_node_id,
               node.type
             ),
           {:ok, event_count} <-
             EventRecorder.record_tree_events(
               community,
               branch,
               args,
               Enum.map(duplicated_nodes, &duplicate_create_event/1)
             ),
           {:ok, state} <- Operation.bump_revision(community, state, event_count) do
        {:ok,
         Operation.payload(
           community,
           state,
           duplicated,
           Index.affected_nodes(community, branch, node.parent_node_id, node.type)
         )}
      else
        false -> {:error, {:custom, "only Group, Page, and Link nodes can be duplicated"}}
        error -> error
      end
    end)
  end

  defp duplicate_nodes(community, branch, %DocTreeNode{type: :group} = root, args) do
    nodes = Reader.tree_nodes!(community, [branch_id: branch.id], CMS.Const.stage(:draft))
    children_by_parent = Enum.group_by(nodes, & &1.parent_node_id)

    with {:ok, duplicated_root} <- duplicate_tree_node(community, branch, root, args, nil),
         {:ok, descendants} <-
           duplicate_descendants(
             community,
             branch,
             children_by_parent,
             root.node_id,
             duplicated_root.node_id,
             args
           ) do
      {:ok, [duplicated_root | descendants]}
    end
  end

  defp duplicate_nodes(community, branch, node, args) do
    with {:ok, duplicated} <- duplicate_node_and_content(community, branch, node, args) do
      {:ok, [duplicated]}
    end
  end

  defp duplicate_descendants(
         community,
         branch,
         children_by_parent,
         source_parent_node_id,
         target_parent_node_id,
         args
       ) do
    children_by_parent
    |> Map.get(source_parent_node_id, [])
    |> Enum.sort_by(& &1.index)
    |> Enum.reduce_while({:ok, []}, fn child, {:ok, duplicated} ->
      child_args =
        args
        |> Map.put(:duplicate_parent_node_id, target_parent_node_id)
        |> Map.put(:duplicate_index, child.index)
        |> Map.put(:duplicate_title, child.title)

      with {:ok, duplicated_child} <-
             duplicate_node_and_content(community, branch, child, child_args),
           {:ok, nested} <-
             duplicate_descendants(
               community,
               branch,
               children_by_parent,
               child.node_id,
               duplicated_child.node_id,
               args
             ) do
        {:cont, {:ok, duplicated ++ [duplicated_child | nested]}}
      else
        error -> {:halt, error}
      end
    end)
  end

  defp duplicate_node_and_content(community, branch, %DocTreeNode{type: :group} = node, args) do
    duplicate_tree_node(community, branch, node, args, nil,
      title: Map.get(args, :duplicate_title)
    )
  end

  defp duplicate_node_and_content(community, branch, %DocTreeNode{type: :link} = node, args) do
    duplicate_tree_node(community, branch, node, args, nil)
  end

  defp duplicate_node_and_content(
         community,
         branch,
         %DocTreeNode{type: :page} = node,
         args
       ) do
    with %User{} = actor <- Repo.get(User, Map.get(args, :actor_id)) do
      Lock.run(community, :doc, node.doc_id, fn ->
        with {:ok, source} <- CMS.Articles.read_editor(community, :doc, node.doc_id, branch),
             source <- Repo.preload(source, :document),
             %{json: json} = document when is_binary(json) <- source.document,
             {:ok, body_bag} <- BodyBag.from_document(document),
             title <-
               Map.get(args, :duplicate_title) ||
                 Identity.unique_copy_title(
                   community,
                   branch,
                   node.parent_node_id,
                   node.title
                 ),
             slug <- Identity.unique_doc_slug(community, branch, source.slug),
             {:ok, draft} <-
               Draft.create(
                 community,
                 :doc,
                 %{
                   branch_id: branch.id,
                   title: title,
                   slug: slug,
                   subtitle: source.subtitle,
                   body_bag: body_bag
                 },
                 actor
               ),
             {:ok, _mentions} <- CMS.ArtimentMentions.sync(draft) do
          duplicate_tree_node(community, branch, node, args, draft.article_hash_id,
            title: title,
            slug: slug
          )
        else
          nil -> {:error, {:custom, "Source Doc content is missing"}}
          error -> error
        end
      end)
    else
      nil -> {:error, {:custom, "Duplicate Page requires an authenticated actor"}}
    end
  end

  defp duplicate_tree_node(community, branch, node, args, doc_id, overrides \\ []) do
    title =
      Keyword.get(overrides, :title) ||
        Identity.unique_copy_title(community, branch, node.parent_node_id, node.title)

    parent_node_id = Map.get(args, :duplicate_parent_node_id, node.parent_node_id)
    index = Map.get(args, :duplicate_index, node.index + 1)

    attrs =
      node
      |> Map.take([
        :community_id,
        :branch_id,
        :stage,
        :type,
        :href,
        :marker,
        :badge,
        :hidden
      ])
      |> Map.merge(%{
        node_id: Node.new_node_id(),
        doc_id: doc_id,
        title: title,
        parent_node_id: parent_node_id,
        index: index
      })

    with :ok <-
           Index.shift_sibling_indexes(
             community,
             branch,
             parent_node_id,
             node.type,
             index,
             node.node_id
           ) do
      ORM.create(DocTreeNode, attrs)
    end
  end

  defp duplicate_create_event(%DocTreeNode{type: :page} = node),
    do: EventRecorder.doc_owned_create_event(node)

  defp duplicate_create_event(%DocTreeNode{} = node), do: Events.create_event(node)

  @doc """
  Moves one node inside an allowed draft tree group.

  Pin policy is enforced here: pins stay top-level, and normal page/link nodes
  can not be dragged into the top pin area.

  ## Examples

      iex> Writer.move_node(community, page.node_id, %{target_parent_node_id: group.node_id, target_index: 0})
      {:ok, %{affected_nodes: [_]}}
  """
  @spec move_node(Community.t(), T.id(), map()) :: T.domain_res(payload())
  def move_node(%Community{} = community, node_id, args) do
    Operation.run(community, args, fn branch, state ->
      target_parent_node_id = Map.get(args, :target_parent_node_id)
      target_index = Map.get(args, :target_index, 0)

      with {:ok, node} <- Node.find(community, branch, node_id),
           {:ok, parent_node_id} <-
             Node.validate_target(community, branch, node, target_parent_node_id),
           old_parent_id <- node.parent_node_id,
           old_index <- node.index,
           :ok <- Index.move_node(community, branch, node, parent_node_id, target_index),
           {:ok, node} <- Node.find(community, branch, node.node_id),
           {:ok, event_count} <-
             EventRecorder.record_tree_events(community, branch, args, [
               Events.move_event(node, old_parent_id, old_index, parent_node_id, node.index)
             ]),
           {:ok, state} <- Operation.bump_revision(community, state, event_count) do
        affected =
          [old_parent_id, parent_node_id]
          |> Enum.uniq()
          |> Enum.flat_map(&Index.affected_nodes(community, branch, &1, node.type))

        {:ok, Operation.payload(community, state, node, affected)}
      end
    end)
  end

  defp validate_delete_node(_community, _branch, _node), do: :ok

  defp load_actor(args, error_message) do
    case Map.get(args, :actor_id) do
      nil ->
        {:error, {:custom, error_message}}

      actor_id ->
        case Repo.get(User, actor_id) do
          %User{} = actor -> {:ok, actor}
          nil -> {:error, {:custom, error_message}}
        end
    end
  end
end
