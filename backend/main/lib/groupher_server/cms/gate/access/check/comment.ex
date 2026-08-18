defmodule GroupherServer.CMS.Gate.Access.Check.Comment do
  @moduledoc """
  Executes Comment single-resource access checks inside the parent Article lock.

  Comment checks first resolve the parent Article and Community, then load the
  Comment Access Context inside the existing Article lock boundary.

      Comment
        -> FrontDesk parent chain
        -> Articles.Lock.run_for_article
        -> Loader.Comment
        -> Access.Comment policy
        -> Decision
  """

  alias GroupherServer.CMS.Gate.Access.Comment, as: CommentPolicy
  alias GroupherServer.CMS.Gate.Access.Loader
  alias GroupherServer.CMS.Gate.Decision
  alias GroupherServer.CMS.Model.{Comment, Community}
  alias GroupherServer.CMS.{Articles, FrontDesk}

  @doc false
  @spec run(term(), atom(), Comment.t()) ::
          {:ok, Comment.t()} | {:error, Decision.t()}
  def run(actor, action, %Comment{} = comment) do
    with {:ok, thread} <- FrontDesk.thread_of(comment),
         {:ok, article} <- FrontDesk.article_of(comment, preload: :community),
         %Community{} = community <- article.community,
         {:ok, result} <-
           Articles.Lock.run_for_article(community, thread, article, fn ->
             with {:ok, context} <- Loader.comment(community, thread, article, comment),
                  %Decision{allowed: true} <- decision(actor, action, comment, context) do
               {:ok, comment}
             else
               %Decision{} = decision -> {:error, decision}
               {:error, reason} -> {:error, Decision.deny(reason)}
             end
           end) do
      {:ok, result}
    else
      nil -> {:error, Decision.deny(:resource_not_found)}
      {:error, %Decision{} = decision} -> {:error, decision}
      {:error, reason} -> {:error, Decision.deny(reason)}
    end
  end

  defp decision(actor, action, resource, context),
    do:
      Decision.from_result(CommentPolicy.check_access(actor, action, resource, context), context)
end
