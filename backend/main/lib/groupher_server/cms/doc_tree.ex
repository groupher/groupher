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
      doc_tree_nodes(stage=public) --->  docs  --->  doc_documents
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
  alias GroupherServer.CMS.DocTree.{Publish, Read, Template, Write}
  alias GroupherServer.CMS.Model.Community
  alias Helper.T

  @spec read(Community.t()) :: T.domain_res(map())
  def read(%Community{} = community), do: Read.read(community)

  @spec read_draft(Community.t(), T.id()) :: T.domain_res(map())
  def read_draft(%Community{} = community, id), do: Read.read_draft(community, id)

  @doc """
  Builds the unified docs publish checklist.

  ## Examples

      iex> DocTree.publish_scope(community).total_count
      2
  """
  @spec publish_scope(Community.t()) :: map()
  def publish_scope(%Community{} = community), do: Publish.scope(community)

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
  @spec move_doc_to_draft(Community.t(), T.id(), User.t()) :: T.domain_res(Doc.t())
  def move_doc_to_draft(%Community{} = community, id, %User{} = user),
    do: Publish.move_doc_to_draft(community, id, user)

  @doc """
  Moves one docs group and all published page/link children back to draft visibility.
  """
  @spec move_group_to_draft(Community.t(), T.id()) :: T.domain_res(map())
  def move_group_to_draft(%Community{} = community, id),
    do: Publish.move_group_to_draft(community, id)

  @spec ensure_demo_template(Community.t(), User.t()) :: T.domain_res(map())
  def ensure_demo_template(%Community{} = community, %User{} = user) do
    Template.ensure_demo_template(community, user)
  end

  @spec create_demo_template(Community.t(), User.t()) :: T.domain_res(map())
  def create_demo_template(%Community{} = community, %User{} = user) do
    Template.create_demo_template(community, user)
  end

  @spec delete_demo_template(Community.t()) :: T.domain_res(map())
  def delete_demo_template(%Community{} = community), do: Template.delete_demo_template(community)

  @spec reset_demo_template(Community.t(), User.t()) :: T.domain_res(map())
  def reset_demo_template(%Community{} = community, %User{} = user) do
    Template.reset_demo_template(community, user)
  end

  @spec create_group(Community.t(), map()) :: T.domain_res(map())
  def create_group(%Community{} = community, args), do: Write.create_group(community, args)

  @spec create_page(Community.t(), map(), User.t() | nil) :: T.domain_res(map())
  def create_page(%Community{} = community, args, user \\ nil) do
    Write.create_page(community, args, user)
  end

  @spec create_link(Community.t(), map()) :: T.domain_res(map())
  def create_link(%Community{} = community, args), do: Write.create_link(community, args)

  @spec create_pin(Community.t(), map()) :: T.domain_res(map())
  def create_pin(%Community{} = community, args), do: Write.create_pin(community, args)

  @spec update_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def update_node(%Community{} = community, id, args), do: Write.update_node(community, id, args)

  @spec update_draft(Community.t(), T.id(), map(), User.t()) :: T.domain_res(map())
  def update_draft(%Community{} = community, id, args, %User{} = user),
    do: Write.update_draft(community, id, args, user)

  @spec delete_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def delete_node(%Community{} = community, id, args), do: Write.delete_node(community, id, args)

  @spec duplicate_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def duplicate_node(%Community{} = community, id, args),
    do: Write.duplicate_node(community, id, args)

  @spec move_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def move_node(%Community{} = community, id, args), do: Write.move_node(community, id, args)
end
