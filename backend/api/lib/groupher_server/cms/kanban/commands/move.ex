defmodule GroupherServer.CMS.Kanban.Commands.Move do
  @moduledoc """
    Moves an existing Community-local Kanban Article between statuses.

        ArticleBinding binding
          -> Gate admission
          -> KanbanState status update
  """

  alias GroupherServer.CMS
  alias CMS.Articles.States
  alias CMS.Gate.Access
  alias CMS.Kanban.Query
  alias CMS.Model.{Article, Community}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Community.t(), Article.t(), atom(), User.t()) :: T.domain_res(Article.t())
  def execute(%Community{} = community, %Article{} = article, status, %User{} = actor)
      when is_atom(status) do
    with {:ok, _state} <- Query.ensure_membership(article, community) do
      Access.with_community_check(actor, :set_status, community, article, fn canonical ->
        States.set_status(canonical, status, community.id)
      end)
    end
  end
end
