defmodule GroupherServer.CMS.Communities.Commands.SetTag do
  @moduledoc """
  Sets one community tag through a one-shot Gate admission.

      GraphQL -> SetTag -> Article Gate -> Tags association + stats/effects
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.{FrontDesk, Gate}
  alias CMS.Communities.Commands.TagSupport
  alias CMS.Communities.Tags
  alias CMS.Model.{Article, Community}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T

  @spec execute(Article.t() | map(), T.id(), User.t(), Ecto.UUID.t()) :: T.domain_res(Article.t())
  def execute(article, tag_id, %User{} = actor, command_id) do
    with {:ok, command_id} <- TagSupport.command_id(command_id),
         {:ok, article} <- article_resource(article),
         {:ok, tag} <- FrontDesk.community_tag(tag_id),
         {:ok, %Community{} = community} <- TagSupport.community(tag.community_id) do
      Gate.with_community_check(actor, :edit, community, article, fn canonical ->
        Tags.add(canonical, tag.id, command_id: command_id)
      end)
    end
  end

  defp article_resource(%Article{} = article), do: {:ok, article}

  defp article_resource(%{article: %Article{} = article}), do: {:ok, article}

  defp article_resource(%{article_id: article_id}) do
    case Repo.get(Article, article_id) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, CMS.Gate.ErrorCat.resource_not_found()}
    end
  end

  defp article_resource(_article), do: {:error, CMS.Gate.ErrorCat.resource_not_found()}
end
