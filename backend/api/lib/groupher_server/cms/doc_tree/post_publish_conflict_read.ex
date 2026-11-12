defmodule GroupherServer.CMS.DocTree.PostPublishConflictRead do
  @moduledoc """
  Reads a Doc's post-release conflict and current default revision after edit authorization.

      Docs conflict query -> Gate / site lock -> conflict, Public and default copy
  """

  import Ecto.Query
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.{Commands.QueueAccess, Publish.SiteLock}

  alias CMS.Model.{
    ArticlePublic,
    ArticleWorkingCopy,
    Community,
    DocsLifecycle,
    DocsPostPublishConflict
  }

  @doc "Returns the conflict and current revisions, or nil when no conflict exists."
  def read(%Community{} = community, article_id, %User{} = actor) when is_binary(article_id) do
    Repo.transact(fn ->
      with {:ok, article_id} <- Ecto.UUID.cast(article_id),
           {:ok, community} <- CMS.Gate.Access.Check.community(actor, :manage_docs, community),
           {:ok, :acquired} <- SiteLock.acquire(community),
           {:ok, :pass} <- QueueAccess.authorize(community, article_id, actor) do
        case Repo.one(
               from(c in DocsPostPublishConflict,
                 join: l in DocsLifecycle,
                 on: l.community_id == c.community_id and l.article_id == c.article_id,
                 join: w in ArticleWorkingCopy,
                 on: w.id == l.default_working_copy_id and w.article_id == c.article_id,
                 join: p in ArticlePublic,
                 on: p.article_id == c.article_id and p.snapshot_id == c.published_snapshot_id,
                 where: c.community_id == ^community.id and c.article_id == ^article_id,
                 select: %{
                   public_snapshot_id: c.published_snapshot_id,
                   working_copy_id: w.id,
                   default_revision: w.revision
                 }
               )
             ) do
          nil ->
            if Repo.exists?(
                 from(c in DocsPostPublishConflict,
                   where: c.community_id == ^community.id and c.article_id == ^article_id
                 )
               ) do
              {:error, :invalid_doc_conflict_owner}
            else
              {:ok, nil}
            end

          conflict ->
            {:ok, conflict}
        end
      else
        :error -> {:error, :invalid_doc_identity}
        {:error, _} = error -> error
      end
    end)
  end

  def read(_, _, _), do: {:error, :invalid_doc_identity}
end
