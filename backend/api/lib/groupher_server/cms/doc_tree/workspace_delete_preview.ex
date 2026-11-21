defmodule GroupherServer.CMS.DocTree.WorkspaceDeletePreview do
  @moduledoc """
  Reads deletion impact and revision-bound Q discard confirmation under site admission.

      Docs delete preview -> Gate / WorkspaceDeletePreview -> discard confirmation
  """
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.{Publish.Queue, Publish.SiteLock, WorkspaceDelete}
  alias CMS.Model.Community

  @doc "Returns the complete authorized deletion impact without changing the site."
  def read(%Community{} = community, tree_revision, queue_revision, node_id, %User{} = actor) do
    Repo.transact(fn ->
      with {:ok, community} <- CMS.Gate.Access.Check.community(actor, :manage_docs, community),
           {:ok, :acquired} <- SiteLock.acquire(community),
           {:ok, %{id: id} = queue} when not is_nil(id) <- Queue.read(community),
           {:ok, preview} <-
             WorkspaceDelete.preview(
               community,
               queue,
               tree_revision,
               queue_revision,
               node_id,
               actor
             ) do
        documents =
          Enum.map(
            preview.documents,
            &%{article_id: &1["article_id"], exclusive_fields: &1["exclusive_fields"]}
          )

        confirmation =
          case preview.confirmation do
            nil -> nil
            value -> %{format_version: value["format_version"], hash: value["hash"]}
          end

        {:ok, %{preview | documents: documents, confirmation: confirmation}}
      else
        {:ok, _} -> {:error, :tree_node_not_found}
        {:error, _} = error -> error
      end
    end)
  end

  def read(_, _, _, _, _), do: {:error, :invalid_tree_input}
end
