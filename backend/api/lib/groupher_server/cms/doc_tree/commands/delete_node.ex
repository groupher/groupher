defmodule GroupherServer.CMS.DocTree.Commands.DeleteNode do
  @moduledoc """
  Deletes one draft tree node and records recoverable snapshots.

      CMS.DocTree.delete_node -> DeleteNode.execute -> command support -> Writer.delete_node
  """
  alias GroupherServer.CMS.DocTree.{Commands.Support, Writer}

  def execute(community, id, args) do
    Support.run_tree_command(
      community,
      id,
      args,
      Support.actor(args),
      :doc_tree_delete_node,
      &Writer.delete_node(community, id, &1)
    )
  end
end
