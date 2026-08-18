defmodule GroupherServer.CMS.Gate.Access.Loader.Comment do
  @moduledoc """
  Loads CommentLifecycle together with the parent Article or Doc facts.

      Comment resource -> parent Article/Doc Loader + CommentLifecycle
        -> Access.Comment Context -> Comment Access policy

  `load/4` is an internal Gate seam and is not a business API.
  """

  alias GroupherServer.CMS.Gate.Access.Loader.Article, as: ArticleLoader
  alias GroupherServer.CMS.Gate.Access.Loader.Queries
  alias GroupherServer.CMS.Gate.Context.Access.{Article, Comment, Doc}
  alias GroupherServer.CMS.Model.Comment, as: CommentModel
  alias GroupherServer.CMS.Model.{CommentLifecycle, Community}

  @doc false
  def load(
        %Community{} = community,
        thread,
        article,
        %CommentModel{} = comment
      ) do
    with {:ok, parent_context} <- ArticleLoader.load(community, thread, article),
         %CommentLifecycle{} = comment_lifecycle <- Queries.comment_lifecycle(comment.id) do
      {:ok,
       %Comment{
         comment: comment,
         comment_lifecycle: comment_lifecycle,
         article: parent_resource(parent_context),
         article_lifecycle: parent_lifecycle(parent_context),
         community: parent_context.community,
         community_lifecycle: parent_context.community_lifecycle
       }}
    else
      nil -> {:error, :lifecycle_not_found}
      {:error, _reason} = error -> error
    end
  end

  defp parent_resource(%Article{article: article}), do: article
  defp parent_resource(%Doc{doc: doc}), do: doc

  defp parent_lifecycle(%Article{article_lifecycle: lifecycle}), do: lifecycle
  defp parent_lifecycle(%Doc{doc_lifecycle: lifecycle}), do: lifecycle
end
