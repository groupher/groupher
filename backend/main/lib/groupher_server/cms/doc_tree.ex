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
      doc_cover_groups/items/pinned_items
              |
              v
      Public docs site

  Pins are independent top-level link nodes with `type=pin`. They are published
  and diffed with the Tree, but they do not point at existing page/link nodes.
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.DocTree.{Publish, Read, Template, Trash, Write}
  alias GroupherServer.CMS.Model.{Community, Doc}
  alias Helper.T

  @doc """
  Reads the branch-scoped docs tree for editor/sidebar rendering.
  """
  @spec read(Community.t(), keyword() | map()) :: T.domain_res(map())
  def read(%Community{} = community, opts \\ []), do: Read.read(community, opts)

  @doc """
  Reads one draft docs page by stable doc id or node id.
  """
  @spec read_draft(Community.t(), T.id(), keyword() | map()) :: T.domain_res(map())
  def read_draft(%Community{} = community, id, opts \\ []),
    do: Read.read_draft(community, id, opts)

  @doc """
  Builds the unified docs publish checklist.

  ## Examples

      iex> DocTree.publish_checklist(community).total_count
      2
  """
  @spec publish_checklist(Community.t(), keyword() | map()) :: map()
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
  Moves one docs group and all published page/link children back to draft visibility.
  """
  @spec move_group_to_draft(Community.t(), T.id()) :: T.domain_res(map())
  def move_group_to_draft(%Community{} = community, id),
    do: Publish.move_group_to_draft(community, id)

  @doc """
  Ensures the community has the default docs demo template.
  """
  @spec ensure_demo_template(Community.t(), User.t()) :: T.domain_res(map())
  def ensure_demo_template(%Community{} = community, %User{} = user) do
    Template.ensure_demo_template(community, user)
  end

  @doc """
  Creates the default docs demo template in the draft tree.
  """
  @spec create_demo_template(Community.t(), User.t()) :: T.domain_res(map())
  def create_demo_template(%Community{} = community, %User{} = user) do
    Template.create_demo_template(community, user)
  end

  @doc """
  Deletes the default docs demo template from the draft tree.
  """
  @spec delete_demo_template(Community.t()) :: T.domain_res(map())
  def delete_demo_template(%Community{} = community), do: Template.delete_demo_template(community)

  @doc """
  Recreates the default docs demo template from scratch.
  """
  @spec reset_demo_template(Community.t(), User.t()) :: T.domain_res(map())
  def reset_demo_template(%Community{} = community, %User{} = user) do
    Template.reset_demo_template(community, user)
  end

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
  Duplicates a page or link node in the draft tree.
  """
  @spec duplicate_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def duplicate_node(%Community{} = community, id, args),
    do: Write.duplicate_node(community, id, args)

  @doc """
  Moves a draft tree node to a new group/index.
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
