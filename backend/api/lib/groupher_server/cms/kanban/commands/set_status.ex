defmodule GroupherServer.CMS.Kanban.Commands.SetStatus do
  @moduledoc """
    Sets the status of an Article in one explicit ArticleBinding binding.

        Article + ArticleBinding binding
          -> Gate admission
          -> KanbanState status update
  """

  alias GroupherServer.CMS
  alias CMS.Articles.States
  alias CMS.Model.{Article, Community}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t(), Article.t(), atom() | nil, User.t()) ::
          T.domain_res(Article.t())
  def execute(%Community{} = community, %Article{} = article, status, %User{} = actor) do
    CMS.Gate.with_community_check(actor, :set_status, community, article, fn canonical ->
      States.set_status(canonical, status, community.id)
    end)
  end
end
