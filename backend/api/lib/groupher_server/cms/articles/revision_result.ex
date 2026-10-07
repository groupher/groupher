defmodule GroupherServer.CMS.Articles.RevisionResult do
  @moduledoc """
  Builds the public Article result from the immutable revision named by a
  Command Confirmation.

  Command recovery must not read the current ArticlePublic head.  This module
  owns the one revision-rooted read and leaves viewer-specific decoration to
  the GraphQL/read layers.

      Confirmation
        -> ArticleRevision + BodySnapshot
        -> stable Article projection
        -> transport decoration
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.FrontDesk
  alias CMS.Articles.Store
  alias CMS.Articles.RevisionProjection
  alias CMS.Articles.ArticleTransportResult
  alias CMS.Model.{Article, ArticleCommunity, ArticleRevision, Community}

  @doc "Builds a stable Article result from a typed confirmation and loaded Community."
  @spec build(map() | struct(), Community.t()) :: {:ok, map()} | {:error, term()}
  def build(confirmation, %Community{} = community) when is_map(confirmation) do
    with {:ok, article_id} <- required_binary(confirmation, :article_id),
         {:ok, revision_id} <- required_binary(confirmation, :revision_id),
         {:ok, %Article{} = article} <- FrontDesk.article(article_id, mode: :internal),
         true <- article.community_id == community.id,
         %ArticleCommunity{inner_id: inner_id} when is_integer(inner_id) <-
           Repo.get_by(ArticleCommunity, article_id: article.id, community_id: community.id),
         article = %{article | inner_id: inner_id},
         {:ok, %ArticleRevision{} = revision} <- Store.revision(revision_id),
         {:ok, result} <-
           RevisionProjection.build(article, community, revision,
             publication_version: Map.get(confirmation, :publication_version),
             published_at: Map.get(confirmation, :published_at)
           ) do
      {:ok,
       ArticleTransportResult.decorate(
         result,
         %{
           article: %{article | inner_id: inner_id},
           revision: revision,
           community: community,
           confirmation: confirmation
         },
         nil
       )}
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  def build(_confirmation, _community) do
    {:error, CMS.ErrorCat.command_result_unavailable()}
  end

  defp required_binary(map, key) do
    case Map.get(map, key) do
      value when is_binary(value) and value != "" -> {:ok, value}
      _ -> {:error, {:missing_confirmation_field, key}}
    end
  end
end
