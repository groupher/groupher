defmodule GroupherServer.CMS.Articles.Numbering do
  @moduledoc """
  Allocates Community/thread-scoped public Article numbers.

      locked stable Article
        -> locked ArticleInnerIdCounter
        -> Article.inner_id

  Callers run this inside the Publish or Move transaction so no cache/search
  side effect can observe a public Article without an `inner_id`.
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleInnerIdCounter}

  @doc "Assigns the next public inner id, or returns the Article unchanged when already assigned."
  @spec assign_public_inner_id(Article.t()) :: {:ok, Article.t()} | {:error, term()}
  def assign_public_inner_id(%Article{inner_id: inner_id} = article) when not is_nil(inner_id) do
    {:ok, article}
  end

  def assign_public_inner_id(%Article{} = article) do
    with {:ok, _counter} <- ensure_counter(article),
         %ArticleInnerIdCounter{} = counter <- lock_counter(article),
         inner_id <- counter.next_inner_id,
         {:ok, _counter} <- advance(counter),
         {:ok, article} <- article |> Article.changeset(%{inner_id: inner_id}) |> Repo.update() do
      {:ok, article}
    else
      nil -> {:error, :article_inner_id_counter_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp ensure_counter(article) do
    %ArticleInnerIdCounter{}
    |> ArticleInnerIdCounter.changeset(%{
      community_id: article.community_id,
      thread: article.thread,
      next_inner_id: 1
    })
    |> Repo.insert(
      on_conflict: :nothing,
      conflict_target: [:community_id, :thread]
    )
  end

  defp lock_counter(article) do
    ArticleInnerIdCounter
    |> where(
      [counter],
      counter.community_id == ^article.community_id and counter.thread == ^article.thread
    )
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp advance(counter) do
    counter
    |> ArticleInnerIdCounter.changeset(%{next_inner_id: counter.next_inner_id + 1})
    |> Repo.update()
  end
end
