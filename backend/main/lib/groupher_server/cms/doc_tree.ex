defmodule GroupherServer.CMS.DocTree do
  @moduledoc """
  CMS docs side-tree facade.

  Docs editing is draft-first. Dashboard/editor APIs always read and mutate the
  draft copy; public docs cover rendering reads independently curated cover rows
  that point at the published tree.

      Dashboard editor / preview
              |
              v
      doc_tree_node_drafts  --->  article_drafts(thread=doc)
              |
              | DocTree.Publish
              v
      doc_tree_nodes        --->  docs        --->  doc_documents
              |
              v
      doc_cover_groups/items/pinned_items
              |
              v
      Public docs site

  The preview mode currently uses the same draft read path as the dashboard. It
  is intentionally not a versioned preview snapshot, so there is no branch-like
  state to merge or publish from.
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
  Publishes one docs draft page and its public side-tree node.

  Pass `sync_cover: false` for the publish-menu option that should publish the
  doc without adding/syncing it into the docs cover.
  """
  @spec publish_doc(Community.t(), T.id(), User.t(), keyword()) :: T.domain_res(map())
  def publish_doc(%Community{} = community, id, %User{} = user, opts \\ []) do
    Publish.publish_doc(community, id, user, opts)
  end

  @doc """
  Publishes all docs pages with a draft-only state or newer draft edits.
  """
  @spec publish_all_unpublished_docs(Community.t(), User.t(), keyword()) :: T.domain_res(map())
  def publish_all_unpublished_docs(%Community{} = community, %User{} = user, opts \\ []) do
    Publish.publish_all_unpublished_docs(community, user, opts)
  end

  @doc """
  Publishes one docs group and its page/link children.
  """
  @spec publish_group(Community.t(), T.id(), User.t(), keyword()) :: T.domain_res(map())
  def publish_group(%Community{} = community, id, %User{} = user, opts \\ []) do
    Publish.publish_group(community, id, user, opts)
  end

  @doc """
  Publishes only Tree-scope changes into a Tree revision.
  """
  @spec publish_tree(Community.t(), User.t(), keyword()) :: T.domain_res(map())
  def publish_tree(%Community{} = community, %User{} = user, opts \\ []) do
    Publish.publish_tree(community, user, opts)
  end

  @doc """
  Moves one public docs page back to draft visibility.
  """
  @spec move_doc_to_draft(Community.t(), T.id()) :: T.domain_res(map())
  def move_doc_to_draft(%Community{} = community, id),
    do: Publish.move_doc_to_draft(community, id)

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

  @spec update_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def update_node(%Community{} = community, id, args), do: Write.update_node(community, id, args)

  @spec update_draft(Community.t(), T.id(), map()) :: T.domain_res(map())
  def update_draft(%Community{} = community, id, args),
    do: Write.update_draft(community, id, args)

  @spec delete_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def delete_node(%Community{} = community, id, args), do: Write.delete_node(community, id, args)

  @spec duplicate_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def duplicate_node(%Community{} = community, id, args),
    do: Write.duplicate_node(community, id, args)

  @spec move_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def move_node(%Community{} = community, id, args), do: Write.move_node(community, id, args)
end
