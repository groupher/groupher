defmodule GroupherServer.CMS.DocTree do
  @moduledoc """
  CMS docs side-tree facade.

  Docs editing is draft-first. Dashboard/editor APIs always read and mutate the
  draft copy; public site rendering will read the published copy once the publish
  service is added.

      Dashboard editor / preview
              |
              v
      doc_tree_node_drafts  --->  doc_drafts  --->  doc_document_drafts
              |
              | publish, not implemented here
              v
      doc_tree_nodes        --->  docs        --->  doc_documents
              |
              v
      Public docs site

  The preview mode currently uses the same draft read path as the dashboard. It
  is intentionally not a versioned preview snapshot, so there is no branch-like
  state to merge or publish from.
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.DocTree.{Read, Template, Write}
  alias GroupherServer.CMS.Model.Community
  alias Helper.T

  @spec read(Community.t()) :: T.domain_res(map())
  def read(%Community{} = community), do: Read.read(community)

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

  @spec delete_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def delete_node(%Community{} = community, id, args), do: Write.delete_node(community, id, args)

  @spec duplicate_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def duplicate_node(%Community{} = community, id, args),
    do: Write.duplicate_node(community, id, args)

  @spec move_node(Community.t(), T.id(), map()) :: T.domain_res(map())
  def move_node(%Community{} = community, id, args), do: Write.move_node(community, id, args)
end
