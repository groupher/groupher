defmodule GroupherServer.CMS.DocTree.Archive do
  @moduledoc """
  Archives inactive published Docs through the shared Article Lifecycle authority.

      maintenance -> ArticleLifecycle candidates -> locked shared transition
  """

  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleLifecycle, ArticlePublic}

  @doc "Archives a bounded batch of old public Docs through the shared lifecycle."
  def before(threshold) do
    candidates =
      Repo.all(
        from(l in ArticleLifecycle,
          join: p in ArticlePublic,
          on: p.article_id == l.article_id,
          where: l.thread == :doc and l.state == :published and p.inserted_at < ^threshold,
          order_by: l.article_id,
          limit: 100,
          select: {l.id, l.article_id}
        )
      )

    Enum.reduce_while(candidates, {:ok, 0}, fn {lifecycle_id, article_id}, {:ok, count} ->
      case archive(lifecycle_id, article_id, threshold) do
        {:ok, archived} -> {:cont, {:ok, count + archived}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp archive(lifecycle_id, article_id, threshold) do
    Repo.transact(fn ->
      _article =
        Repo.one(from(a in Article, where: a.id == ^article_id, lock: "FOR UPDATE"))

      lifecycle =
        Repo.one(
          from(l in ArticleLifecycle,
            where: l.id == ^lifecycle_id and l.article_id == ^article_id,
            lock: "FOR UPDATE"
          )
        )

      public = Repo.get(ArticlePublic, article_id)

      if match?(%ArticleLifecycle{state: :published}, lifecycle) and
           match?(%ArticlePublic{}, public) and
           DateTime.compare(public.inserted_at, threshold) == :lt do
        case CMS.Articles.Lifecycle.transition(lifecycle, :archived) do
          {:ok, _archived} -> {:ok, 1}
          {:error, reason} -> Repo.rollback(reason)
        end
      else
        {:ok, 0}
      end
    end)
  end
end
