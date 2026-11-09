defmodule GroupherServer.CMS.Tickets.PublicPosts do
  @moduledoc """
  Builds the canonical public Post id query used by Ticket reads and writes.

  Ticket relationships must follow the same Article lifecycle, selected public
  head, community and review-block rules as ordinary public Post reads.

      Ticket/Post relationship
        -> Article Gate public Post scope
        -> visible Post ids for the Community
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Model.Article

  @doc "Returns Post ids public in the supplied Community using Article Gate scope."
  def ids_query(community_id) when is_integer(community_id) do
    case CMS.Gate.scope(Article, nil, :read, ArticleContext.public(:post)) do
      %Ecto.Query{} = scope ->
        {:ok,
         from(article in scope,
           where: as(:gate_community).id == ^community_id,
           select: article.id
         )}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def ids_query(_community_id), do: {:error, CMS.Gate.ErrorCat.scope_context_missing()}

  @doc "Answers whether a Post is in the canonical Article Gate public scope."
  def public?(community_id, post_id)
      when is_integer(community_id) and is_binary(post_id) do
    case CMS.Gate.scope(Article, nil, :read, ArticleContext.public(:post)) do
      %Ecto.Query{} = scope ->
        {:ok,
         Repo.exists?(
           from(article in scope,
             where: article.id == ^post_id and as(:gate_community).id == ^community_id
           )
         )}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def public?(_community_id, _post_id), do: {:error, CMS.Gate.ErrorCat.scope_context_missing()}
end
