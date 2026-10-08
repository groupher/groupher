defmodule GroupherServer.CMS.Kanban.Commands.Add do
  @moduledoc """
    Adds a canonical Article to a Community-local Kanban.

        Article + Community
          -> ArticleBinding binding
          -> KanbanState
  """

  alias GroupherServer.CMS
  alias CMS.Articles.States
  alias CMS.Gate.Access
  alias CMS.Model.{Article, Community}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t(), Article.t(), atom(), User.t()) :: T.domain_res(Article.t())
  def execute(%Community{} = community, %Article{} = article, status, %User{} = actor)
      when is_atom(status) do
    Access.with_community_check(actor, :set_status, community, article, fn canonical ->
      States.set_status(canonical, status, community.id)
    end)
  end
end
