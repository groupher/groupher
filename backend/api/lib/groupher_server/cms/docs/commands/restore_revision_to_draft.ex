defmodule GroupherServer.CMS.Docs.Commands.RestoreRevisionToDraft do
  @moduledoc """
  Restores one published Doc revision into the mutable branch workspace.

      published revision -> branch workspace -> tagged Draft result
  """

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User
  alias CMS.Docs.{BranchVersions, Editor}
  alias CMS.Model.Author

  @spec execute(Ecto.UUID.t(), pos_integer(), Ecto.UUID.t(), User.t() | Author.t(), keyword()) ::
          {:ok, CMS.Model.DocDraft.t()} | {:error, term()}
  def execute(doc_id, branch_id, revision_id, actor, opts)
      when is_binary(doc_id) and is_binary(revision_id) do
    with {:ok, article} <- Editor.stable_doc(doc_id),
         {:ok, author} <- Editor.target_author(actor),
         {:ok, user} <- Editor.actor_user(actor) do
      CMS.Gate.Access.with_branch_check(
        user,
        :restore_revision_to_draft,
        article,
        branch_id,
        fn canonical ->
          BranchVersions.restore_revision_to_draft(
            canonical,
            branch_id,
            revision_id,
            author,
            opts
          )
        end
      )
    end
  end
end
