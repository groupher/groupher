defmodule GroupherServer.CMS.DocTree do
  @moduledoc """
  CMS docs side-tree facade.

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
      doc_tree_nodes(stage=public) --->  docs  --->  article_documents
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

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.DocTree.{Publish, Read, Trash, Write}
  alias GroupherServer.CMS.Model.{Community, Doc}
  alias Helper.T

  @doc """
  Initializes the branch-scoped Docs state without creating navigation or content.

  Community creation calls this so a new Docs site has an empty, writable tree.
  Product templates are deliberately outside this lifecycle.
  """
  @spec initialize(Community.t(), keyword() | map()) :: T.domain_res(map())
  def initialize(%Community{} = community, opts \\ []),
    do: Read.ensure_site_state(community, opts)

  @doc """
  Reads the branch-scoped docs tree for editor/sidebar rendering.
  """
  @spec read(Community.t(), keyword() | map()) :: T.domain_res(map())
  def read(%Community{} = community, opts \\ []), do: Read.read(community, opts)

  @doc """
  Reads the published docs tree for public docs pages.
  """
  @spec read_public(Community.t(), keyword() | map()) :: T.domain_res(map())
  def read_public(%Community{} = community, opts \\ []), do: Read.read_public(community, opts)

  @doc """
  Reads one draft docs page by stable doc id or node id.
  """
  @spec read_draft(Community.t(), T.id(), keyword() | map()) :: T.domain_res(map())
  def read_draft(%Community{} = community, id, opts \\ []),
    do: Read.read_draft(community, id, opts)

  @doc "Creates one recursive navigation node using its declared node type."
  @spec create_node(Community.t(), map(), User.t() | nil) :: T.domain_res(map())
  def create_node(%Community{} = community, %{type: type} = args, user \\ nil) do
    case type do
      :tab -> Write.create_tab(community, args)
      :group -> Write.create_group(community, args)
      :page -> Write.create_page(community, args, user)
      :link -> Write.create_link(community, args)
      :pin -> Write.create_pin(community, args)
      _ -> {:error, {:custom, "unsupported docs tree node type"}}
    end
  end

  @doc """
  Builds the unified docs publish checklist.

  ## Examples

      iex> DocTree.publish_checklist(community).total_count
      2
  """
  @spec publish_checklist(Community.t(), keyword() | map()) :: map() | {:error, term()}
  def publish_checklist(%Community{} = community, opts \\ []),
    do: Publish.checklist(community, opts)

  @doc """
  Publishes selected docs changes and creates one release checkpoint.

  ## Examples

      iex> DocTree.publish_changes(community, %{doc_change_ids: ["doc:1"]}, user)
      {:ok, %{done: true}}
  """
  @spec publish_changes(Community.t(), map(), User.t(), keyword()) :: T.domain_res(map())
  def publish_changes(%Community{} = community, args, %User{} = user, opts \\ []) do
    Publish.publish_changes(community, args, user, opts)
  end

  @doc """
  Moves one public docs page back to draft visibility.
  """
  @spec move_doc_to_draft(Community.t(), T.id(), User.t(), keyword() | map()) ::
          T.domain_res(Doc.t())
  def move_doc_to_draft(%Community{} = community, id, %User{} = user, opts \\ []),
    do: Publish.move_doc_to_draft(community, id, user, opts)

  @doc """
  Creates missing article drafts for every published Page in one Tab/Group subtree.
  """
  @spec move_subtree_to_draft(Community.t(), T.id(), User.t(), keyword() | map()) ::
          T.domain_res(map())
  def move_subtree_to_draft(%Community{} = community, id, %User{} = user, opts \\ []),
    do: Publish.move_subtree_to_draft(community, id, user, opts)

  @doc """
  Creates a draft tab node.
  """
  @spec create_tab(Community.t(), map()) :: T.domain_res(map())
  def create_tab(%Community{} = community, args), do: Write.create_tab(community, args)

  @doc """
  Creates a draft group node.
  """
  @spec create_group(Community.t(), map()) :: T.domain_res(map())
  def create_group(%Community{} = community, args), do: Write.create_group(community, args)

  @doc """
  Creates a draft page node and its draft doc when `doc_id` is absent.
  """
  @spec create_page(Community.t(), map(), User.t() | nil) :: T.domain_res(map())
  def create_page(%Community{} = community, args, user \\ nil) do
    Write.create_page(community, args, user)
  end

  @doc """
  Creates a draft external-link node.
  """
  @spec create_link(Community.t(), map()) :: T.domain_res(map())
  def create_link(%Community{} = community, args), do: Write.create_link(community, args)

  @doc """
  Creates a draft pin node.
  """
  @spec create_pin(Community.t(), map()) :: T.domain_res(map())
  def create_pin(%Community{} = community, args), do: Write.create_pin(community, args)

  @doc """
  Updates mutable metadata for a draft tree node.
  """
  @spec update_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def update_node(%Community{} = community, id, args), do: Write.update_node(community, id, args)

  @doc """
  Updates the draft content associated with a docs page.
  """
  @spec update_draft(Community.t(), T.id(), map(), User.t()) :: T.domain_res(map())
  def update_draft(%Community{} = community, id, args, %User{} = user),
    do: Write.update_draft(community, id, args, user)

  @doc """
  Deletes a draft tree node and writes recoverable trash snapshots.
  """
  @spec delete_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def delete_node(%Community{} = community, id, args), do: Write.delete_node(community, id, args)

  @doc """
  Duplicates a Group subtree, Page, or Link in the draft tree.
  """
  @spec duplicate_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def duplicate_node(%Community{} = community, id, args),
    do: Write.duplicate_node(community, id, args)

  @doc """
  Moves a draft tree node to a new parent/index.
  """
  @spec move_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def move_node(%Community{} = community, id, args), do: Write.move_node(community, id, args)

  @doc """
  Lists visible product Trash drawer items for the resolved docs branch.
  """
  @spec trash_items(Community.t(), keyword() | map()) :: T.domain_res(list(map()))
  def trash_items(%Community{} = community, opts \\ []), do: Trash.list(community, opts)

  @doc """
  Restores one product Trash drawer item into the draft tree.
  """
  @spec restore_trash_item(Community.t(), T.id(), map()) :: T.domain_res(map())
  def restore_trash_item(%Community{} = community, id, args),
    do: Trash.restore(community, id, args)
end
