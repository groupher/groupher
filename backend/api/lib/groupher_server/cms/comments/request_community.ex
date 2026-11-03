defmodule GroupherServer.CMS.Comments.RequestCommunity do
  @moduledoc """
  Resolves Comment operations through a current Article binding.

  Public paths supply the Community. Legacy direct calls use an existing
  binding in stable order, never the Comment's creation origin.

      Comment request path -> current ArticleBinding -> Community -> Gate
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Comment, DocBranch}

  def resolve(%Comment{request_community_slug: slug} = comment) when is_binary(slug) do
    with {:ok, community} <- CMS.FrontDesk.community(slug),
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

  def resolve(%Comment{article_id: article_id}) do
    with {:ok, [binding | _]} <- CMS.Articles.Bindings.all(%{article_id: article_id}) do
      {:ok, binding.community}
    else
      _ -> {:error, CMS.Gate.ErrorCat.scope_context_missing()}
    end
  end
end
