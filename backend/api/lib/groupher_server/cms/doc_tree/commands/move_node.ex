defmodule GroupherServer.CMS.DocTree.Commands.MoveNode do
  @moduledoc """
  Moves one mutable tree node to a new parent or index.

      CMS.DocTree.move_node -> MoveNode.execute -> command support -> Writer.move_node
  """
  alias GroupherServer.CMS.DocTree.{Commands.Support, Writer}

  def execute(community, id, args) do
    Support.run_tree_command(
      community,
      id,
      args,
      Support.actor(args),
      :doc_tree_move_node,
      &Writer.move_node(community, id, &1)
    )
  end
end
