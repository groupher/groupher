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

  alias GroupherServer.CMS
  alias CMS.FrontDesk
  alias CMS.Articles.Reader
  alias CMS.Articles.ArticleTransportResult
  alias CMS.Model.{Article, ArticleRevision, Community}

  @doc "Builds a stable Article result from a typed confirmation anchor."
  @spec build(map()) :: {:ok, map()} | {:error, term()}
  def build(confirmation) when is_map(confirmation) do
    with {:ok, article_id} <- required_binary(confirmation, :article_id),
         {:ok, revision_id} <- required_binary(confirmation, :revision_id),
         {:ok, community_id} <- community_id(confirmation, article_id),
         {:ok, %Community{} = community} <- FrontDesk.community(community_id, mode: :internal),
         {:ok, %Article{} = article} <- FrontDesk.article(article_id, mode: :internal),
         {:ok, %ArticleRevision{} = revision} <- Reader.revision(revision_id),
         {:ok, result} <-
           FrontDesk.article_revision(article_id, revision_id, community,
             publication_version: Map.get(confirmation, :publication_version),
             published_at: Map.get(confirmation, :published_at)
           ) do
      {:ok,
       ArticleTransportResult.decorate(
         result,
         %{
           article: article,
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

  def build(_), do: {:error, CMS.ErrorCat.command_result_unavailable()}

  @doc "Builds from publish action data without reloading its Article or Revision roots."
  @spec build_from_action(map(), map(), Community.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def build_from_action(confirmation, action_result, %Community{} = community, opts \\ [])
      when is_map(confirmation) and is_map(action_result) and is_list(opts) do
    with %Article{} = article <- Map.get(action_result, :article),
         %ArticleRevision{} = revision <- Map.get(action_result, :revision),
         {:ok, result} <-
           FrontDesk.article_revision_parts(
             article,
             community,
             revision,
             Keyword.merge(opts,
               publication_version: Map.get(confirmation, :publication_version),
               published_at: Map.get(confirmation, :published_at)
             )
           ) do
      {:ok,
       ArticleTransportResult.decorate(
         result,
         %{
           article: article,
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

  defp community_id(confirmation, article_id) do
    case Map.get(confirmation, :community_id) do
      value when is_integer(value) ->
        {:ok, value}

      _ ->
        with {:ok, %Article{community_id: value}} <-
               FrontDesk.article(article_id, mode: :internal),
             true <- is_integer(value) do
          {:ok, value}
        else
          _ -> {:error, :missing_confirmation_field}
        end
    end
  end

  defp required_binary(map, key) do
    case Map.get(map, key) do
      value when is_binary(value) and value != "" -> {:ok, value}
      _ -> {:error, {:missing_confirmation_field, key}}
    end
  end
end
