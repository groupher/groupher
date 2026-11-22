defmodule GroupherServer.CMS.DocTree.Publish.Queue.DequeuePreview do
  @moduledoc """
  Reads a discard confirmation under Queue preview and write authorization.

      Docs preview query -> DequeuePreview -> Gate / discard confirmation
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.Publish.{Queue, SiteLock}
  alias CMS.DocTree.Publish.Queue.DequeueBatch
  alias CMS.Model.Community

  @doc "Returns the revision-bound discard requirements without changing Queue state."
  def read(%Community{} = community, revision, ids, %User{} = actor) do
    Repo.transact(fn ->
      with {:ok, community} <-
             CMS.Gate.Access.Check.community(actor, :docs_queue_preview, community),
           {:ok, community} <-
             CMS.Gate.Access.Check.community(actor, :docs_queue_write, community),
           {:ok, :acquired} <- SiteLock.acquire(community),
           {:ok, %{id: queue_id} = queue} when not is_nil(queue_id) <- Queue.read(community),
           {:ok, preview} <- DequeueBatch.preview(community, queue, revision, ids, actor) do
        documents =
          Enum.map(preview.documents, fn item ->
            %{article_id: item["article_id"], exclusive_fields: item["exclusive_fields"]}
          end)

        confirmation =
          case preview.confirmation do
            nil -> nil
            value -> %{format_version: value["format_version"], hash: value["hash"]}
          end

        {:ok, %{preview | documents: documents, confirmation: confirmation}}
      else
        {:ok, _} -> {:error, :queue_member_not_found}
        {:error, _reason} = error -> error
      end
    end)
  end

  def read(_, _, _, _), do: {:error, :invalid_queue_members}
end
