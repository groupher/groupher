defmodule GroupherServer.CMS.Docs.Commands.PublishBranch do
  @moduledoc """
  Publishes one stable Doc branch and runs post-publish effects.

      Doc branch -> atomic publish -> public projection -> effects
  """

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.Publish.{Doc, Effects}
  alias CMS.Docs.Editor
  alias CMS.Model.Author

  @spec execute(Ecto.UUID.t(), pos_integer(), User.t() | Author.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def execute(doc_id, branch_id, actor, opts) when is_binary(doc_id) do
    with {:ok, article} <- Editor.stable_doc(doc_id),
         {:ok, author} <- Editor.target_author(actor),
         {:ok, user} <- Editor.actor_user(actor),
         {:ok, result} <-
           CMS.Gate.Access.with_branch_check(user, :publish, article, branch_id, fn canonical ->
             Doc.publish(canonical, branch_id, author, opts)
           end),
         {:ok, result} <- Effects.run(result) do
      {:ok, result}
    end
  end
end
