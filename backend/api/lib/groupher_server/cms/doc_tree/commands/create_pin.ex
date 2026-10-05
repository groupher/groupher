defmodule GroupherServer.CMS.DocTree.Commands.CreatePin do
  @moduledoc """
  Creates one draft pin node.

      CMS.DocTree.create_pin -> CreatePin.execute -> command support -> Writer.create_pin
  """
  alias GroupherServer.CMS.DocTree.{Commands.Support, Writer}

  def execute(community, args, user \\ nil) do
    Support.run_tree_command(
      community,
      Map.get(args, :parent_node_id, "root"),
      args,
      Support.actor(args, user),
      :doc_tree_create_pin,
      &Writer.create_pin(community, &1)
    )
  end
end
