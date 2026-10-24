defmodule GroupherServer.CMS.Articles.PinPersist do
  @moduledoc """
  Persistence primitives for Article pins inside a caller-owned command transaction.

  Business position:

      Articles pin command
        -> PinPersist
        -> Repo / pinned article rows
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.Model.{Article, ArticleBinding, Community, PinnedArticle}

  def lock_community(community_id) do
    Repo.one(
      from(community in Community, where: community.id == ^community_id, lock: "FOR UPDATE")
    )
  end

  def count(community_id, thread) do
    Repo.aggregate(
      from(pin in PinnedArticle,
        where: pin.community_id == ^community_id and pin.thread == ^thread
      ),
      :count,
      :id
    )
  end

  def insert(%Article{} = article, %Community{} = community) do
    case Repo.get_by(ArticleBinding, article_id: article.id, community_id: community.id) do
      %ArticleBinding{} = binding -> upsert(binding, community, article.thread)
      nil -> {:error, ArticleErrorCat.binding_not_found()}
    end
  end

  def delete(article_id, community_id) do
    query =
      from(pin in PinnedArticle,
        join: binding in ArticleBinding,
        on: pin.article_binding_id == binding.id,
        where: binding.article_id == ^article_id and binding.community_id == ^community_id
      )

    case Repo.delete_all(query) do
      {0, _} -> {:error, :pin_not_found}
      {_count, _} -> {:ok, :done}
    end
  end

  defp upsert(binding, community, thread) do
    case Repo.get_by(PinnedArticle, article_binding_id: binding.id) do
      %PinnedArticle{} = pin ->
        {:ok, pin}

      nil ->
        %PinnedArticle{}
        |> PinnedArticle.changeset(%{
          article_binding_id: binding.id,
          community_id: community.id,
          thread: thread
        })
        |> Repo.insert()
    end
  end
end
