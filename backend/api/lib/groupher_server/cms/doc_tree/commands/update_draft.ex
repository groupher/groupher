defmodule GroupherServer.CMS.DocTree.Commands.UpdateDraft do
  @moduledoc """
  Updates the Draft content associated with one Docs page.

      CMS.DocTree.update_draft
        -> UpdateDraft.execute
        -> command support -> Writer.update_draft -> DraftResult
  """

  alias GroupherServer.CMS
  alias CMS.DocTree.{Commands.Support, Writer}
  alias CMS.DocTree.Commands.NodeDraftConfirmation, as: Confirmation
  alias CMS.Model.Article

  def execute(community, %Article{thread: :doc} = article, args, user) do
    execute(community, article.id, args, user)
  end

  def execute(community, id, args, user) do
    Support.run_doc_command(
      community,
      id,
      user,
      :doc_update_draft,
      args,
      Confirmation,
      fn ->
        with {:ok, draft} <-
               Writer.update_draft(community, id, Support.drop_command_id(args), user) do
          {:ok, %Confirmation{data: confirmation_data(draft, Support.option(args, :command_id))}}
        end
      end,
      &present_confirmation/1
    )
  end

  defp present_confirmation(%Confirmation{} = confirmation) do
    CMS.Docs.DraftResult.build(confirmation)
  end

  defp confirmation_data(draft, command_id) do
    %{
      "article_id" => draft.article_id,
      "community_id" => draft.community_id,
      "branch_id" => draft.branch_id,
      "version" => draft.version,
      "title" => draft.title,
      "subtitle" => draft.subtitle,
      "slug" => draft.slug,
      "digest" => draft.digest,
      "content_hash" => draft.content_hash,
      "updated_at" => DateTime.to_iso8601(draft.updated_at),
      "command_id" => command_id
    }
  end
end
