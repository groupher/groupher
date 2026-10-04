defmodule GroupherServer.CMS.Docs.DraftResult do
  @moduledoc """
  Builds the editor result from a decoded Doc Draft Confirmation.

  The builder accepts only the committed confirmation anchor. Transport fields
  such as `actor`, `cur_user`, and `command_id` are never passed to the Docs
  reader as options.

      DraftConfirmation
        -> branch-scoped editor read
        -> confirmed draft result
        -> GraphQL response
  """

  alias GroupherServer.CMS
  alias CMS.DocTree.Commands.NodeDraftConfirmation, as: DraftConfirmation
  alias CMS.FrontDesk
  alias CMS.Model.Community

  @doc "Builds one recovered or first-execution editor result."
  @spec build(struct()) :: {:ok, map()} | {:error, term()}
  def build(%DraftConfirmation{data: data} = confirmation) do
    with community_id when is_integer(community_id) <- data["community_id"],
         {:ok, %Community{} = community} <- FrontDesk.community(community_id, mode: :internal) do
      build(community, confirmation)
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  @spec build(Community.t(), struct()) :: {:ok, map()} | {:error, term()}
  defp build(%Community{} = community, %DraftConfirmation{data: data}) do
    with article_id when is_binary(article_id) <- data["article_id"],
         branch_id when is_integer(branch_id) <- data["branch_id"],
         {:ok, draft} <- CMS.Docs.read_editor_head(community, article_id, branch_id: branch_id),
         {:ok, updated_at, 0} <- DateTime.from_iso8601(data["updated_at"]) do
      {:ok,
       Map.merge(draft, %{
         version: data["version"],
         title: data["title"],
         subtitle: data["subtitle"],
         slug: data["slug"],
         digest: data["digest"],
         content_hash: data["content_hash"],
         document: Map.get(draft, :document),
         updated_at: updated_at,
         command_id: data["command_id"]
       })}
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp build(_, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
