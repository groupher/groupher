defmodule GroupherServer.CMS.Kanban do
  @moduledoc """
  Community-local Kanban command facade.

      Community + ArticleBinding binding
        -> Gate ArticleBinding scope
        -> KanbanState

  A Kanban row belongs to one `ArticleBinding`; the same Article can therefore
  have independent Kanban membership and status in different Communities.
  """

  alias GroupherServer.CMS
  alias CMS.Kanban.Commands.{Add, Move, Remove, SetStatus}
  alias CMS.Model.{Article, Community}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @doc "Adds a Post to one Community's Kanban with the initial status."
  @spec add_post(Community.t(), Article.t(), atom(), User.t()) :: T.domain_res(Article.t())
  def add_post(%Community{} = community, %Article{} = article, status, %User{} = actor)
      when is_atom(status) do
    Add.execute(community, article, status, actor)
  end

  @doc "Moves a Post between Kanban columns in one Community."
  @spec move_post(Community.t(), Article.t(), atom(), User.t()) :: T.domain_res(Article.t())
  def move_post(%Community{} = community, %Article{} = article, status, %User{} = actor)
      when is_atom(status) do
    Move.execute(community, article, status, actor)
  end

  @doc "Removes a Post from one Community's Kanban without removing its ArticleBinding binding."
  @spec remove_post(Community.t(), Article.t(), User.t()) :: T.domain_res(Article.t())
  def remove_post(%Community{} = community, %Article{} = article, %User{} = actor) do
    Remove.execute(community, article, actor)
  end

  @doc "Updates one Community-local Kanban status by Community id for compatibility callers."
  @spec set_status(Community.t(), Article.t(), atom() | nil, User.t()) ::
          T.domain_res(Article.t())
  def set_status(
        %Community{} = community,
        %Article{} = article,
        status,
        %User{} = actor
      ) do
    SetStatus.execute(community, article, status, actor)
  end
end
