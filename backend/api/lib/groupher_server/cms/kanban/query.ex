defmodule GroupherServer.CMS.Kanban.Query do
  @moduledoc """
    Reads Community-local Kanban membership for Kanban commands.

        Article + Community
          -> ArticleCommunity relation
          -> KanbanState membership
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleCommunity, Community, KanbanState}

  @doc "Returns the existing Kanban state for one ArticleCommunity relation."
  @spec ensure_membership(Article.t(), Community.t()) ::
          {:ok, KanbanState.t()} | {:error, term()}
  def ensure_membership(%Article{} = article, %Community{} = community) do
    case Repo.get_by(ArticleCommunity, article_id: article.id, community_id: community.id) do
      %ArticleCommunity{id: article_community_id} ->
        case Repo.get(KanbanState, article_community_id) do
          %KanbanState{} = state -> {:ok, state}
          nil -> {:error, CMS.Articles.ErrorCat.not_exist("post is not in kanban")}
        end

      nil ->
        {:error, CMS.Articles.ErrorCat.not_exist("post is not in kanban")}
    end
  end
end
