defmodule GroupherServer.CMS.DocTree.Commands.MoveSubtreeToDraft do
  @moduledoc """
  Creates Drafts for every published Page in one subtree.

      CMS.DocTree.move_subtree_to_draft
        -> MoveSubtreeToDraft.execute
        -> command support -> DocTree.Publish -> replay result
  """

  alias GroupherServer.CMS.DocTree.{CommandReplay, Commands.Support, Publish}
  alias GroupherServer.CMS.DocTree.Commands.MoveSubtreeToDraftConfirmation, as: Confirmation

  def execute(community, id, user, opts) do
    Support.run_doc_command(
      community,
      id,
      user,
      :doc_move_subtree_to_draft,
      opts,
      Confirmation,
      fn ->
        with {:ok, result} <- Publish.move_subtree_to_draft(community, id, user, opts) do
          {:ok, %Confirmation{data: CommandReplay.subtree_confirmation(result)}}
        end
      end,
      &CommandReplay.replay_subtree_confirmation/1
    )
  end
end
