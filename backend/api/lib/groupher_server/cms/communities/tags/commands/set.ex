defmodule GroupherServer.CMS.Communities.Tags.Commands.Set do
  @moduledoc """
  Sets one community tag through a Gate-admitted `direct_pipeline`.

      GraphQL -> Set -> Article Gate -> Tags association + stats/effects
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.Tags.Assignment
  alias CMS.{FrontDesk, Gate}
  alias CMS.Communities.Tags.Commands.TagSupport
  alias CMS.Model.{Article, Community}
  alias Helper.T

  @spec execute(Article.t() | map(), T.id(), User.t(), Ecto.UUID.t()) :: T.domain_res(Article.t())
  def execute(article, tag_id, %User{} = actor, command_id) do
    with {:ok, command_id} <- TagSupport.command_id(command_id),
         {:ok, article, branch_id} <- article_resource(article),
         {:ok, tag} <- FrontDesk.community_tag(tag_id),
         {:ok, %Community{} = community} <- TagSupport.community(tag.community_id) do
      execute_pipeline(article, tag, community, branch_id, actor, command_id)
    end
  end

  @pipeline operation: :article_tag_set, target: :article
  direct_pipeline execute_pipeline(article, tag, community, branch_id, actor, command_id) do
    gate(fn candidate -> check_article_gate(actor, community, candidate, branch_id) end)
    change(fn canonical -> Assignment.add(canonical, tag.id, command_id: command_id) end)
  end

  defp article_resource(%Article{} = article), do: {:ok, article, nil}

  defp article_resource(%{article: %Article{} = article} = resource) do
    {:ok, article, Map.get(resource, :branch_id)}
  end

  defp article_resource(%{article_id: article_id} = resource) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article, Map.get(resource, :branch_id)}
      {:error, _reason} -> {:error, CMS.Gate.ErrorCat.resource_not_found()}
    end
  end

  defp article_resource(_article), do: {:error, CMS.Gate.ErrorCat.resource_not_found()}

  defp check_article_gate(actor, community, article, branch_id) when is_integer(branch_id) do
    Gate.check_in_transaction(actor, :community_tag_set, article, community, branch_id)
  end

  defp check_article_gate(actor, community, article, _branch_id) do
    Gate.check_in_transaction(actor, :community_tag_set, article, community)
  end
end
