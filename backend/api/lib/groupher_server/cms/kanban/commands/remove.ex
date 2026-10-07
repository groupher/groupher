defmodule GroupherServer.CMS.Kanban.Commands.Remove do
  @moduledoc """
  Removes an Article from a Community-local Kanban while preserving its ArticleCommunity relation.

      ArticleCommunity relation
        -> Gate admission
        -> delete KanbanState
"""

  alias GroupherServer.CMS
  alias CMS.Articles.States
  alias CMS.Gate.Access
  alias CMS.Model.{Article, Community}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t(), Article.t(), User.t()) :: T.domain_res(Article.t())
  def execute(%Community{} = community, %Article{} = article, %User{} = actor) do
    Access.with_community_check(actor, :set_status, community, article, fn canonical ->
      States.set_status(canonical, nil, community.id)
    end)
  end
end
