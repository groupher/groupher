defmodule GroupherServer.CMS.Comments.CommandResult do
  @moduledoc """
  Builds the stable result of a Comment aggregate command after commit or
  receipt recovery.

      Comment command result
        -> ArticleStats public projection
        -> stable Comment mutation result

  The builder performs no writes and never reconstructs a missing ArticleStats
  projection from the mutation input.
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Comment, Community}

  @doc "Builds one Comment mutation result from its canonical command result."
  @spec build({:ok, map()} | {:error, term()}) :: {:ok, map()} | {:error, term()}
  def build(
        {:ok,
         %{comment: %Comment{community_id: community_id} = comment, article: article} = result}
      ) do
    with %Community{} = community <- Repo.get(Community, community_id),
         {:ok, article_stats} <- CMS.ArticleStats.for_article(article, community) do
      {:ok,
       %{
         command_id: Map.fetch!(result, :command_id),
         comment: comment,
         article_stats: article_stats
       }}
    else
      nil -> {:error, :article_binding_context_required}
      {:error, _reason} = error -> error
    end
  end

  def build({:error, _reason} = error), do: error
end
