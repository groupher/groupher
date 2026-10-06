defmodule GroupherServer.CMS.DocTree do
  @moduledoc """
  Public CMS boundary for draft and published docs navigation trees.

  Docs editing owns a staged tree and a public tree in the same table. Dashboard
  APIs mutate only the staged rows; publish copies the staged snapshot into
  public rows and records a tree snapshot.

      Dashboard editor / preview
              |
              v
      doc_tree_nodes(stage=draft)  --->  docs(stage=draft)
              |
              | publish article / publish tree
              v
      doc_tree_nodes(stage=public) ---> DocPublic ---> ArticleBodySnapshot
              |
              v
      doc_cover_cards/items/pinned_docs
              |
              v
      Public docs site

  Tabs are roots. Groups can recursively own Groups, Pages, and Links. Pages and
  Links can also live directly under a Tab. Pins belong to a Tab but use their
  own display lane. Every node uses the same staged Tree workflow.
  """

  require GroupherServer.CMS.Const

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.DocTree.{Commands, Publish, Query, State, Trash}
  alias CMS.Model.{Article, Community}
  alias Helper.T

  @doc """
  Initializes the branch-scoped Docs state without creating navigation or content.

  Community creation calls this so a new Docs site has an empty, writable tree.
  Product templates are deliberately outside this lifecycle.
  """
  @spec initialize(Community.t(), keyword() | map()) :: T.domain_res(map())
  def initialize(%Community{} = community, opts \\ []) do
    State.ensure_site_state(community, opts)
  end

  @doc """
  Reads the branch-scoped docs tree for editor/sidebar rendering.
  """
  @spec read(Community.t(), keyword() | map()) :: T.domain_res(map())
  def read(%Community{} = community, opts \\ []) do
    with {:ok, _state} <- State.ensure_site_state(community, opts) do
      Query.read(community, opts)
    end
  end

  @doc """
  Reads the published docs tree for public docs pages.
  """
  @spec read_public(Community.t(), keyword() | map()) :: T.domain_res(map())
  def read_public(%Community{} = community, opts \\ []), do: Query.read_public(community, opts)

  @doc """
  Reads one draft docs page by stable doc id or node id.
  """
  @spec read_draft(Community.t(), T.id(), keyword() | map()) :: T.domain_res(map())
  def read_draft(%Community{} = community, id, opts \\ []) do
    Query.read_draft(community, id, opts)
  end

  @doc "Creates one recursive navigation node using its declared node type."
  @spec create_node(Community.t(), map(), User.t() | nil) :: T.domain_res(map())
  def create_node(%Community{} = community, args, user \\ nil) do
    Commands.CreateNode.execute(community, with_actor(args, user), user)
  end

  @doc """
  Builds the unified docs publish checklist.

  ## Examples

      iex> DocTree.publish_checklist(community).total_count
      2
  """
  @spec publish_checklist(Community.t(), keyword() | map()) :: map() | {:error, term()}
  def publish_checklist(%Community{} = community, opts \\ []) do
    Publish.checklist(community, opts)
  end

  @doc """
  Publishes selected docs changes and creates one release checkpoint.

  ## Examples

      iex> DocTree.publish_changes(community, %{doc_change_ids: ["doc:1"]}, user)
      {:ok, %{done: true}}
  """
  @spec publish_changes(Community.t(), map(), User.t(), keyword()) :: T.domain_res(map())
  def publish_changes(%Community{} = community, args, %User{} = user, opts \\ []) do
    Commands.PublishChanges.execute(community, args, user, opts)
  end

  @doc """
  Moves one public docs page back to draft visibility.
  """
  @spec move_doc_to_draft(Community.t(), T.id(), User.t(), keyword() | map()) ::
          T.domain_res(CMS.Model.DocDraft.t())
  def move_doc_to_draft(%Community{} = community, id, %User{} = user, opts \\ []) do
    Commands.MoveDocToDraft.execute(community, id, user, opts)
  end

  @doc "Moves one public Docs page to Draft and returns its stable mutation payload."
  @spec move_doc_to_draft_result(Community.t(), T.id(), User.t(), keyword() | map()) ::
          T.domain_res(map())
  def move_doc_to_draft_result(%Community{} = community, id, %User{} = user, opts \\ []) do
    with {:ok, draft} <- move_doc_to_draft(community, id, user, opts) do
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

  @doc """
  Creates missing article drafts for every published Page in one Tab/Group subtree.
  """
  @spec move_subtree_to_draft(Community.t(), T.id(), User.t(), keyword() | map()) ::
          T.domain_res(map())
  def move_subtree_to_draft(%Community{} = community, id, %User{} = user, opts \\ []) do
    Commands.MoveSubtreeToDraft.execute(community, id, user, opts)
  end

  @doc """
  Creates a draft tab node.
  """
  @spec create_tab(Community.t(), map()) :: T.domain_res(map())
  def create_tab(%Community{} = community, args) do
    Commands.CreateTab.execute(community, args)
  end

  @doc """
  Creates a draft group node.
  """
  @spec create_group(Community.t(), map()) :: T.domain_res(map())
  def create_group(%Community{} = community, args) do
    Commands.CreateGroup.execute(community, args)
  end

  @doc """
  Creates a draft page node and its draft doc when `doc_id` is absent.
  """
  @spec create_page(Community.t(), map(), User.t() | nil) :: T.domain_res(map())
  def create_page(%Community{} = community, args, user \\ nil) do
    Commands.CreatePage.execute(community, args, user)
  end

  @doc """
  Creates a draft external-link node.
  """
  @spec create_link(Community.t(), map()) :: T.domain_res(map())
  def create_link(%Community{} = community, args) do
    Commands.CreateLink.execute(community, args)
  end

  @doc """
  Creates a draft pin node.
  """
  @spec create_pin(Community.t(), map()) :: T.domain_res(map())
  def create_pin(%Community{} = community, args) do
    Commands.CreatePin.execute(community, args)
  end

  @doc """
  Updates mutable metadata for a draft tree node.
  """
  @spec update_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def update_node(%Community{} = community, id, args) do
    Commands.UpdateNode.execute(community, id, args)
  end

  def update_node(%Community{} = community, id, args, %User{} = actor) do
    Commands.UpdateNode.execute(community, id, with_actor(args, actor))
  end

  @doc """
  Updates the draft content associated with a docs page.
  """
  @spec update_draft(Community.t(), Article.t(), map(), User.t()) :: T.domain_res(map())
  def update_draft(
        %Community{} = community,
        %Article{thread: :doc} = article,
        args,
        %User{} = user
      ) do
    Commands.UpdateDraft.execute(community, article, args, user)
  end

  @spec update_draft(Community.t(), T.id(), map(), User.t()) :: T.domain_res(map())
  def update_draft(%Community{} = community, id, args, %User{} = user) do
    Commands.UpdateDraft.execute(community, id, args, user)
  end

  @doc """
  Deletes a draft tree node and writes recoverable trash snapshots.
  """
  @spec delete_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def delete_node(%Community{} = community, id, args) do
    Commands.DeleteNode.execute(community, id, args)
  end

  def delete_node(%Community{} = community, id, args, %User{} = actor) do
    Commands.DeleteNode.execute(community, id, with_actor(args, actor))
  end

  @doc """
  Duplicates a Group subtree, Page, or Link in the draft tree.
  """
  @spec duplicate_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def duplicate_node(%Community{} = community, id, args) do
    Commands.DuplicateNode.execute(community, id, args)
  end

  def duplicate_node(%Community{} = community, id, args, %User{} = actor) do
    Commands.DuplicateNode.execute(community, id, with_actor(args, actor))
  end

  @doc """
  Moves a draft tree node to a new parent/index.
  """
  @spec move_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def move_node(%Community{} = community, id, args) do
    Commands.MoveNode.execute(community, id, args)
  end

  def move_node(%Community{} = community, id, args, %User{} = actor) do
    Commands.MoveNode.execute(community, id, with_actor(args, actor))
  end

  @doc """
  Lists visible product Trash drawer items for the resolved docs branch.
  """
  @spec trash_items(Community.t(), keyword() | map()) :: T.domain_res(list(map()))
  def trash_items(%Community{} = community, opts \\ []), do: Trash.list(community, opts)

  @doc """
  Restores one product Trash drawer item into the draft tree.
  """
  @spec restore_trash_item(Community.t(), T.id(), map()) :: T.domain_res(map())
  def restore_trash_item(%Community{} = community, id, args) do
    Commands.RestoreTrashItem.execute(community, id, args)
  end

  def restore_trash_item(%Community{} = community, id, args, %User{} = actor) do
    Commands.RestoreTrashItem.execute(community, id, with_actor(args, actor))
  end

  defp with_actor(attrs, %User{} = actor) do
    attrs |> Map.put(:actor_id, actor.id) |> Map.put(:actor, actor)
  end

  defp with_actor(attrs, _actor), do: attrs
end
