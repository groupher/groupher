defmodule GroupherServer.CMS.DocTree.Commands.CreateLink do
  @moduledoc """
  Creates one draft external-link node.

      CMS.DocTree.create_link -> CreateLink.execute -> command support -> Writer.create_link
  """
  alias GroupherServer.CMS.DocTree.{Commands.Support, Writer}

  def execute(community, args, user \\ nil) do
    Support.run_tree_command(
      community,
      Map.get(args, :parent_node_id, "root"),
      args,
      Support.actor(args, user),
      :doc_tree_create_link,
      &Writer.create_link(community, &1)
    )
  end
end
