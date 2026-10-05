defmodule GroupherServer.CMS.DocTree.Commands.CreateTab do
  @moduledoc """
  Creates one draft tab node.

      CMS.DocTree.create_tab -> CreateTab.execute -> command support -> Writer.create_tab
  """
  alias GroupherServer.CMS.DocTree.{Commands.Support, Writer}

  def execute(community, args, user \\ nil) do
    Support.run_tree_command(
      community,
      Map.get(args, :parent_node_id, "root"),
      args,
      Support.actor(args, user),
      :doc_tree_create_tab,
      &Writer.create_tab(community, &1)
    )
  end
end
