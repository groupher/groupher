defmodule GroupherServer.CMS.Communities.Tags.Commands.UnsetTag do
  @moduledoc """
  Unsets one community tag through a one-shot Gate admission.

      GraphQL -> UnsetTag -> Article Gate -> Tags association + stats/effects
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.{FrontDesk, Gate}
  alias CMS.Communities.Tags.Commands.TagSupport
  alias CMS.Articles.Tags.Assignment
  alias CMS.Model.{Article, Community}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Article.t() | map(), T.id(), User.t(), Ecto.UUID.t()) :: T.domain_res(Article.t())
  def execute(article, tag_id, %User{} = actor, command_id) do
    with {:ok, command_id} <- TagSupport.command_id(command_id),
         {:ok, article, branch_id} <- article_resource(article),
         {:ok, tag} <- FrontDesk.community_tag(tag_id),
         {:ok, %Community{} = community} <- TagSupport.community(tag.community_id) do
      with_article_gate(actor, community, article, branch_id, fn canonical ->
        Assignment.remove(canonical, tag.id, command_id: command_id)
      end)
    end
  end

  defp article_resource(%Article{} = article), do: {:ok, article, nil}

  defp article_resource(%{article: %Article{} = article} = resource) do
    {:ok, article, Map.get(resource, :branch_id)}
  end

  defp article_resource(%{article_id: article_id} = resource) do
    case Repo.get(Article, article_id) do
      %Article{} = article -> {:ok, article, Map.get(resource, :branch_id)}
      nil -> {:error, CMS.Gate.ErrorCat.resource_not_found()}
    end
  end

  defp article_resource(_article), do: {:error, CMS.Gate.ErrorCat.resource_not_found()}

  defp with_article_gate(actor, community, article, branch_id, callback)
       when is_integer(branch_id) do
    Gate.with_branch_check(actor, :edit, community, article, branch_id, callback)
  end

  defp with_article_gate(actor, community, article, _branch_id, callback) do
    Gate.with_community_check(actor, :edit, community, article, callback)
  end
end
