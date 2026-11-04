defmodule GroupherServer.CMS.Comments.RequestCommunity do
  @moduledoc """
  Resolves Comment operations through a current Article binding.

  Public paths supply the Community. Pathless ordinary Comment operations fail
  closed; internal Doc operations derive their Community from the owning branch.

      Comment request path -> current ArticleBinding -> Community -> Gate
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Comment, DocBranch}

  def resolve(%Comment{request_community_slug: slug} = comment) when is_binary(slug) do
    with {:ok, community} <- CMS.FrontDesk.community(slug, mode: :internal),
         {:ok, _binding} <- CMS.Articles.Bindings.fetch_binding(comment.article_id, community.id) do
      {:ok, community}
    end
  end

  def resolve(%Comment{thread: :doc, branch_id: branch_id, article_id: article_id})
      when is_integer(branch_id) do
    with %DocBranch{community_id: community_id} <- Repo.get(DocBranch, branch_id),
         {:ok, _binding} <- CMS.Articles.Bindings.fetch_binding(article_id, community_id) do
      CMS.FrontDesk.community(community_id, mode: :internal)
    else
      _ -> {:error, CMS.Gate.ErrorCat.scope_context_missing()}
    end
  end

  def resolve(%Comment{}), do: {:error, CMS.Gate.ErrorCat.scope_context_missing()}
end
