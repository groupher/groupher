defmodule GroupherServer.CMS.DocTree.DefaultCopy do
  @moduledoc """
  Owns the optional default-copy reference of a branch-free Doc.

      admitted Docs transaction -> Article / Lifecycle locks -> create or remove D and its body

  Callers own site locking, admission, content comparison and rollback. Reads never create D.
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.WorkingCopy.{Deleter, Snapshotter}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleLifecycle,
    ArticlePublic,
    ArticleSnapshot,
    ArticleWorkingCopy,
    DocsQueueArticle,
    DocsPostPublishConflict
  }

  @doc "Loads and checks the current default owner and Public under the Article lock."
  def load(community, article_id) do
    with true <- Repo.in_transaction?(),
         %Article{thread: :doc} = article <-
           Repo.one(from(a in Article, where: a.id == ^article_id, lock: "FOR UPDATE")),
         true <-
           Repo.exists?(
             from(b in ArticleBinding,
               where: b.article_id == ^article_id and b.community_id == ^community.id
             )
           ),
         %ArticleLifecycle{state: state} = lifecycle when state not in [:deleted, :destroy] <-
           Repo.one(
             from(l in ArticleLifecycle, where: l.article_id == ^article_id, lock: "FOR UPDATE")
           ) do
      work =
        Repo.one(
          from(w in ArticleWorkingCopy,
            where:
              w.article_id == ^article_id and w.scope_type == :default and
                w.scope_id == ^article_id,
            lock: "FOR UPDATE"
          )
        )

      public =
        Repo.one(from(p in ArticlePublic, where: p.article_id == ^article_id, lock: "FOR UPDATE"))

      valid =
        case work do
          nil ->
            state in [:published, :archived] and not is_nil(public) and
              not blocked?(article_id)

          %ArticleWorkingCopy{} ->
            true
        end

      if valid do
        {:ok, %{article: article, lifecycle: lifecycle, work: work, public: public}}
      else
        {:error, :invalid_doc_lifecycle}
      end
    else
      _ -> {:error, :invalid_doc_lifecycle}
    end
  end

  @doc "Creates D from the current public Snapshot only when absent; also used before deleting Public."
  def ensure(community, article_id, snapshot_id, actor) do
    with {:ok, state} <- load(community, article_id),
         %ArticlePublic{snapshot_id: ^snapshot_id} <- state.public do
      case state.work do
        %ArticleWorkingCopy{} = work ->
          {:ok, work}

        nil ->
          with {:ok, work} <-
                 Snapshotter.fork_snapshot_in_transaction(
                   snapshot_id,
                   %{scope_type: :default, scope_id: article_id, article_id: article_id},
                   actor
                 ) do
            {:ok, work}
          end
      end
    else
      {:error, _} = error -> error
      _ -> {:error, :public_conflict}
    end
  end

  @doc "Deletes a checked clean D after Q and conflict references have been removed."
  def remove(community, %ArticleWorkingCopy{} = work) do
    with {:ok, state} <- load(community, work.article_id),
         true <-
           not is_nil(state.work) and state.work.id == work.id and
             state.work.revision == work.revision,
         true <- not is_nil(state.lifecycle.first_published_at),
         %ArticlePublic{} <- state.public,
         false <- blocked?(work.article_id),
         {:ok, :deleted} <- Deleter.delete_in_transaction(state.article, state.work) do
      {:ok, :deleted}
    else
      {:error, _} = error -> error
      _ -> {:error, :invalid_doc_lifecycle}
    end
  end

  @doc "Returns an authorized editor source without initializing a working copy."
  def read(community, article_id, actor) do
    Repo.transact(fn ->
      with {:ok, _} <- CMS.Gate.Access.Check.community(actor, :manage_docs, community),
           {:ok, :acquired} <- CMS.DocTree.Publish.SiteLock.acquire(community),
           {:ok, :pass} <-
             CMS.DocTree.Commands.QueueAccess.authorize(community, article_id, actor),
           {:ok, state} <- load(community, article_id),
           true <- state.lifecycle.state in [:draft, :published] do
        snapshot = if state.public, do: Repo.get(ArticleSnapshot, state.public.snapshot_id)
        {:ok, %{working_copy: state.work, public_snapshot: snapshot}}
      else
        false -> {:error, :invalid_doc_lifecycle}
        {:error, _} = error -> error
      end
    end)
  end

  defp blocked?(id) do
    Repo.exists?(from(m in DocsQueueArticle, where: m.article_id == ^id)) or
      Repo.exists?(from(c in DocsPostPublishConflict, where: c.article_id == ^id))
  end
end
