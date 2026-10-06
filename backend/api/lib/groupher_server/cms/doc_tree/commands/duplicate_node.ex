defmodule GroupherServer.CMS.DocTree.Commands.DuplicateNode do
  @moduledoc """
  Duplicates one mutable tree subtree.

      CMS.DocTree.duplicate_node
        -> DuplicateNode.execute
        -> command support -> Writer.duplicate_node
  """
  alias GroupherServer.CMS.DocTree.{Commands.Support, Writer}

  def execute(community, id, args) do
    Support.run_tree_command(
      community,
      id,
      args,
      Support.actor(args),
      :doc_tree_duplicate_node,
      &Writer.duplicate_node(community, id, &1)
    )
  end
end
