defmodule GroupherServer.CMS.Kanban.Query do
  @moduledoc """
    Reads Community-local Kanban membership for Kanban commands.

        Article + Community
          -> ArticleBinding binding
          -> KanbanState membership
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Kanban.ErrorCat
  alias CMS.Model.{Article, ArticleBinding, Community, KanbanState}

  @doc "Returns the existing Kanban state for one ArticleBinding binding."
  @spec ensure_membership(Article.t(), Community.t()) ::
          {:ok, KanbanState.t()} | {:error, term()}
  def ensure_membership(%Article{} = article, %Community{} = community) do
    case Repo.get_by(ArticleBinding, article_id: article.id, community_id: community.id) do
      %ArticleBinding{id: article_binding_id} ->
        case Repo.get(KanbanState, article_binding_id) do
          %KanbanState{} = state -> {:ok, state}
          nil -> {:error, ErrorCat.not_in_kanban()}
        end

      nil ->
        {:error, ErrorCat.not_in_kanban()}
    end
  end
end
