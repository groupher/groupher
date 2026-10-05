defmodule GroupherServer.CMS.DocTree.Commands.CreatePage do
  @moduledoc """
  Creates one draft page node and its Draft.

      CMS.DocTree.create_page -> CreatePage.execute -> command support -> Writer.create_page
  """
  alias GroupherServer.CMS.DocTree.{Commands.Support, Writer}

  def execute(community, args, user \\ nil) do
    Support.run_tree_command(
      community,
      Map.get(args, :parent_node_id, "root"),
      args,
      Support.actor(args, user),
      :doc_tree_create_page,
      &Writer.create_page(community, &1, user)
    )
  end
end
