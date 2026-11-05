defmodule GroupherServer.CMS.Comments.RequestCommunity do
  @moduledoc """
  Resolves Comment operations through a current Article binding.

  Public paths supply the Community. Pathless ordinary Comment operations fail
  closed; internal Doc operations resolve the unique stable Article owner.

      Comment request path -> current ArticleBinding -> Community -> Gate
  """

  alias GroupherServer.CMS
  alias CMS.Model.Comment

  def resolve(%Comment{request_community_slug: slug} = comment) when is_binary(slug) do
    with {:ok, community} <- CMS.FrontDesk.community(slug, mode: :internal),
         {:ok, _binding} <- CMS.Articles.Bindings.fetch_binding(comment.article_id, community.id) do
      {:ok, community}
    end
  end

  def resolve(%Comment{thread: :doc, article_id: article_id}) do
    CMS.Articles.Bindings.doc_owner(article_id)
  end

  def resolve(%Comment{}), do: {:error, CMS.Gate.ErrorCat.scope_context_missing()}

  @doc "Constructs a public discussion context; unknown Community paths fail closed."
  def scope_context(thread, community_slug) do
    community_id =
      case CMS.FrontDesk.community(community_slug, mode: :internal) do
        {:ok, community} -> community.id
        _ -> -1
      end

    CMS.Gate.Context.Scope.Comment.for_thread(thread, community_id: community_id)
  end
end
