defmodule GroupherServer.CMS.ArtimentMentions.GraphRevision do
  @moduledoc """
  Advances Community public graph revisions in the caller's transaction.

      resource mutation -> affected Article bindings -> Community revision rows
  """

  import Ecto.Query

  alias GroupherServer.Repo
  alias GroupherServer.CMS.Model.ArticleBinding
  alias GroupherServer.CMS.ArtimentMentions.Model.GraphRevision

  @doc "Bumps every current binding of a stable Article, in Community ID order."
  def bump_for_article(article_id) when is_binary(article_id) do
    community_ids =
      ArticleBinding
      |> where([binding], binding.article_id == ^article_id)
      |> select([binding], binding.community_id)
      |> order_by([binding], asc: binding.community_id)
      |> Repo.all()

    bump_many(community_ids)
  end

  @doc "Bumps the current bindings of a Comment's parent Article."
  def bump_for_comment(%{article_id: article_id}) when is_binary(article_id) do
    bump_for_article(article_id)
  end

  @doc "Bumps a set of affected Communities in deterministic lock order."
  def bump_many(community_ids) when is_list(community_ids) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    rows =
      community_ids
      |> Enum.filter(&is_integer/1)
      |> Enum.uniq()
      |> Enum.sort()
      |> Enum.map(&%{community_id: &1, revision: 1, inserted_at: now, updated_at: now})

    if rows != [] do
      Repo.insert_all(GraphRevision, rows,
        conflict_target: [:community_id],
        on_conflict: [inc: [revision: 1], set: [updated_at: now]]
      )
    end

    {:ok, :pass}
  end

  @doc "Returns the current internal revision; GraphQL must HMAC this value."
  def current(community_id) when is_integer(community_id) do
    case Repo.get(GraphRevision, community_id) do
      nil -> {:ok, 0}
      %GraphRevision{revision: revision} -> {:ok, revision}
    end
  end
end
