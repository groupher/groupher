defmodule GroupherServer.CMS.DocTree.Commands.UpdateNode do
  @moduledoc """
  Updates mutable metadata for one draft tree node.

      CMS.DocTree.update_node -> UpdateNode.execute -> command support -> Writer.update_node
  """
  alias GroupherServer.CMS.DocTree.{Commands.Support, Writer}

  def execute(community, id, args) do
    Support.run_tree_command(
      community,
      id,
      args,
      Support.actor(args),
      :doc_tree_update_node,
      &Writer.update_node(community, id, &1)
    )
  end
end
