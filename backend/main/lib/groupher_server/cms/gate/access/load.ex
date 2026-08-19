defmodule GroupherServer.CMS.Gate.Access.Load do
  @moduledoc """
  Loads the authoritative facts required by Gate resource policies.

  Each function is named after the resource whose access context it builds.
  Loading happens inside the transaction and lock boundary established by the
  corresponding `Access.Check` function.

  Business position:

      Access.Check resource function
        -> Access.Load resource function
        -> locked canonical facts
        -> typed Access Context
  """

  alias GroupherServer.CMS.Artiment.Matcher
  alias GroupherServer.CMS.Gate.Access.Load.Queries
  alias GroupherServer.CMS.Gate.Context.Access.{Article, Comment, Doc}
  alias GroupherServer.CMS.Gate.Context.Access.Community, as: CommunityContext
  alias GroupherServer.CMS.Gate.ErrorCat
  alias GroupherServer.CMS.Model.Comment, as: CommentModel

  alias GroupherServer.CMS.Model.{
    ArticleLifecycle,
    CommentLifecycle,
    Community,
    CommunityLifecycle,
    DocBranch,
    DocLifecycle
  }

  @doc false
  def community(%Community{} = community) do
    case Queries.community_lifecycle(community.id) do
      %CommunityLifecycle{} = lifecycle ->
        {:ok,
         %CommunityContext{
           community: %{community | lifecycle: lifecycle},
           community_lifecycle: lifecycle
         }}

      nil ->
        {:error, ErrorCat.lifecycle_not_found()}
    end
  end

  @doc false
  def article(
        %Community{} = community,
        :doc,
        %{community_id: community_id, branch_id: branch_id, article_hash_id: hash_id} = resource
      )
      when community_id == community.id and not is_nil(branch_id) do
    with {:ok, %{model: model}} <- Matcher.match_interaction(:doc),
         canonical when not is_nil(canonical) <- Queries.resource(model, resource.id),
         true <- same_doc_identity?(canonical, resource),
         %CommunityLifecycle{} = community_lifecycle <- Queries.community_lifecycle(community.id),
         %DocBranch{} = doc_branch <- Queries.doc_branch(community.id, branch_id),
         %DocLifecycle{} = doc_lifecycle <-
           Queries.doc_lifecycle(community.id, branch_id, hash_id) do
      {:ok,
       %Doc{
         doc: canonical,
         community: %{community | lifecycle: community_lifecycle},
         community_lifecycle: community_lifecycle,
         doc_branch: doc_branch,
         doc_lifecycle: doc_lifecycle
       }}
    else
      nil -> {:error, ErrorCat.lifecycle_not_found()}
      false -> {:error, ErrorCat.gate_resource_mismatch()}
      {:error, _reason} = error -> error
    end
  end

  def article(%Community{} = community, :doc, %{community_id: community_id})
      when community_id == community.id,
      do: {:error, ErrorCat.doc_branch_required()}

  def article(
        %Community{} = community,
        thread,
        %{community_id: community_id, article_hash_id: hash_id} = resource
      )
      when thread in [:post, :blog, :changelog] and community_id == community.id do
    with {:ok, %{model: model}} <- Matcher.match_interaction(thread),
         canonical when not is_nil(canonical) <- Queries.resource(model, resource.id),
         true <- same_article_identity?(canonical, resource),
         %CommunityLifecycle{} = community_lifecycle <- Queries.community_lifecycle(community.id),
         %ArticleLifecycle{} = article_lifecycle <-
           Queries.article_lifecycle(community.id, thread, hash_id) do
      {:ok,
       %Article{
         article: canonical,
         community: %{community | lifecycle: community_lifecycle},
         community_lifecycle: community_lifecycle,
         article_lifecycle: article_lifecycle
       }}
    else
      nil -> {:error, ErrorCat.lifecycle_not_found()}
      false -> {:error, ErrorCat.gate_resource_mismatch()}
      {:error, _reason} = error -> error
    end
  end

  def article(_community, _thread, _resource),
    do: {:error, ErrorCat.gate_resource_mismatch()}

  @doc false
  def comment(%Community{} = community, thread, article, %CommentModel{} = comment) do
    with canonical when not is_nil(canonical) <- Queries.resource(CommentModel, comment.id),
         true <- same_comment_identity?(canonical, comment, article, community, thread),
         {:ok, parent_context} <- article(community, thread, article),
         %CommentLifecycle{} = comment_lifecycle <- Queries.comment_lifecycle(canonical.id) do
      {:ok,
       %Comment{
         comment: canonical,
         comment_lifecycle: comment_lifecycle,
         article: parent_resource(parent_context),
         article_lifecycle: parent_lifecycle(parent_context),
         community: parent_context.community,
         community_lifecycle: parent_context.community_lifecycle
       }}
    else
      nil -> {:error, ErrorCat.lifecycle_not_found()}
      false -> {:error, ErrorCat.gate_resource_mismatch()}
      {:error, _reason} = error -> error
    end
  end

  defp parent_resource(%Article{article: article}), do: article
  defp parent_resource(%Doc{doc: doc}), do: doc

  defp parent_lifecycle(%Article{article_lifecycle: lifecycle}), do: lifecycle
  defp parent_lifecycle(%Doc{doc_lifecycle: lifecycle}), do: lifecycle

  defp same_article_identity?(canonical, input) do
    canonical.community_id == input.community_id and
      canonical.article_hash_id == input.article_hash_id
  end

  defp same_doc_identity?(canonical, input) do
    same_article_identity?(canonical, input) and canonical.branch_id == input.branch_id
  end

  defp same_comment_identity?(canonical, input, article, community, thread) do
    with {:ok, %{foreign_key: foreign_key}} <- Matcher.match_interaction(thread) do
      canonical.community_id == community.id and canonical.thread == thread and
        canonical.article_hash_id == article.article_hash_id and
        Map.get(canonical, foreign_key) == article.id and canonical.id == input.id
    else
      _ -> false
    end
  end
end
