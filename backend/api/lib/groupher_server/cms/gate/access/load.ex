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

  alias GroupherServer.{CMS, Repo}

  alias CMS.Gate.Access.Load.Queries
  alias CMS.Gate.Context.Access.Article, as: ArticleContext
  alias CMS.Gate.Context.Access.Comment, as: CommentContext
  alias CMS.Gate.Context.Access.Community, as: CommunityContext
  alias CMS.Gate.Context.Access.Doc, as: DocContext
  alias CMS.Gate.{ErrorCat, Config}
  alias CMS.Model.Comment

  alias CMS.Model.{
    ArticleLifecycle,
    Article,
    ArticleBinding,
    CommentLifecycle,
    Community,
    CommunityLifecycle,
    DocBranch,
    DocLifecycle,
    PostState
  }

  @article_threads Config.ordinary_article_threads()

  @doc "Loads one stable Doc Article and its branch-scoped lifecycle authority."
  def doc(%Community{} = community, %Article{thread: :doc} = resource, branch_id) do
    with %Article{} = canonical <- Queries.resource(Article, resource.id),
         %ArticleBinding{} <- Queries.article_binding(canonical.id, community.id),
         canonical <- preload_article_author(canonical),
         %CommunityLifecycle{} = community_lifecycle <- Queries.community_lifecycle(community.id),
         %DocBranch{} = doc_branch <- Queries.doc_branch(community.id, branch_id),
         %DocLifecycle{} = doc_lifecycle <- Queries.doc_lifecycle(canonical.id, branch_id),
         %CMS.Model.DocBranchState{} = doc_branch_state <-
           Queries.doc_branch_state(canonical.id, branch_id) do
      {:ok,
       %DocContext{
         doc: canonical,
         community: %{community | lifecycle: community_lifecycle},
         community_lifecycle: community_lifecycle,
         doc_branch: doc_branch,
         doc_lifecycle: doc_lifecycle,
         doc_branch_state: doc_branch_state
       }}
    else
      nil -> {:error, ErrorCat.lifecycle_not_found()}
    end
  end

  def doc(_community, _resource, _branch_id) do
    {:error, ErrorCat.gate_resource_mismatch()}
  end

  @doc """
  Loads the canonical Community lifecycle and builds its typed Access Context.

  The lifecycle row is acquired with the lock mode owned by `Load.Queries`.
  A missing lifecycle returns `lifecycle_not_found` instead of producing a
  partial context.
  """
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

  @doc """
  Reloads an Article or Doc and its authoritative lifecycle facts into a typed
  Access Context.

  The supplied Community, thread and resource identities must agree. Docs also
  require a branch, while unsupported threads and identity mismatches fail
  closed with a declared Gate error.
  """
  def article(
        %Community{} = community,
        thread,
        %Article{thread: thread} = resource
      )
      when thread in @article_threads do
    with %Article{} = canonical <- Queries.resource(Article, resource.id),
         %ArticleBinding{} <- Queries.article_binding(canonical.id, community.id),
         canonical <- preload_article_author(canonical),
         %CommunityLifecycle{} = community_lifecycle <- Queries.community_lifecycle(community.id),
         %ArticleLifecycle{} = article_lifecycle <- Queries.article_lifecycle(canonical.id) do
      {:ok,
       %ArticleContext{
         article: canonical,
         community: %{community | lifecycle: community_lifecycle},
         community_lifecycle: community_lifecycle,
         article_lifecycle: article_lifecycle
       }}
    else
      nil -> {:error, ErrorCat.lifecycle_not_found()}
    end
  end

  def article(%Community{} = community, :doc, %{community_id: community_id})
      when community_id == community.id do
    {:error, ErrorCat.doc_branch_required()}
  end

  def article(_community, _thread, _resource) do
    {:error, ErrorCat.gate_resource_mismatch()}
  end

  @doc "Loads an ordinary Article against an explicit ArticleBinding binding."
  def article_in_community(
        %Community{} = community,
        thread,
        %Article{thread: thread} = resource
      )
      when thread in @article_threads do
    with %Article{} = canonical <- Queries.resource(Article, resource.id),
         %ArticleBinding{} <- Queries.article_binding(canonical.id, community.id),
         canonical <- preload_article_author(canonical),
         %CommunityLifecycle{} = community_lifecycle <- Queries.community_lifecycle(community.id),
         %ArticleLifecycle{} = article_lifecycle <- Queries.article_lifecycle(canonical.id) do
      {:ok,
       %ArticleContext{
         article: canonical,
         community: %{community | lifecycle: community_lifecycle},
         community_lifecycle: community_lifecycle,
         article_lifecycle: article_lifecycle
       }}
    else
      nil -> {:error, ErrorCat.lifecycle_not_found()}
    end
  end

  def article_in_community(_community, _thread, _resource) do
    {:error, ErrorCat.gate_resource_mismatch()}
  end

  @doc """
  Reloads a Comment together with its canonical parent and lifecycle facts.

  The returned context contains the Comment, parent Article or Doc, Community,
  and all lifecycle rows required by Comment policy evaluation. Any identity
  mismatch fails closed rather than authorizing from caller-supplied structs.
  """
  def comment(%Community{} = community, thread, article, %Comment{} = comment) do
    with canonical when not is_nil(canonical) <- Queries.resource(Comment, comment.id),
         true <- same_comment_identity?(canonical, comment, article, community, thread),
         {:ok, parent_context} <- parent_context(community, thread, article, comment.branch_id),
         %CommentLifecycle{} = comment_lifecycle <- Queries.comment_lifecycle(canonical.id) do
      {:ok,
       %CommentContext{
         comment: canonical,
         comment_lifecycle: comment_lifecycle,
         article: parent_resource(parent_context),
         article_lifecycle: parent_lifecycle(parent_context),
         article_author_user_id: article_author_user_id(parent_context),
         article_cat: article_cat(parent_context),
         community: parent_context.community,
         community_lifecycle: parent_context.community_lifecycle
       }}
    else
      nil -> {:error, ErrorCat.lifecycle_not_found()}
      false -> {:error, ErrorCat.gate_resource_mismatch()}
      {:error, _reason} = error -> error
    end
  end

  defp parent_context(community, :doc, %Article{thread: :doc} = article, branch_id)
       when is_integer(branch_id) do
    doc(community, article, branch_id)
  end

  defp parent_context(community, thread, article, _branch_id) do
    article(community, thread, article)
  end

  defp parent_resource(%ArticleContext{article: article}), do: article

  defp parent_resource(%DocContext{doc: doc, doc_branch_state: state}) do
    %{doc | comments_locked: state.comments_locked}
  end

  defp parent_lifecycle(%ArticleContext{article_lifecycle: lifecycle}), do: lifecycle
  defp parent_lifecycle(%DocContext{doc_lifecycle: lifecycle}), do: lifecycle

  defp preload_article_author(resource), do: Repo.preload(resource, author: :user)

  defp article_author_user_id(parent_context) do
    case parent_resource(parent_context) do
      %{author: %{user_id: user_id}} -> user_id
      %{author: %{user: %{id: user_id}}} -> user_id
      _ -> nil
    end
  end

  defp article_cat(parent_context) do
    case parent_resource(parent_context) do
      %Article{id: article_id, thread: :post} ->
        case Repo.get(PostState, article_id) do
          %PostState{cat: cat} -> cat
          nil -> nil
        end

      resource ->
        Map.get(resource, :cat)
    end
  end

  defp same_comment_identity?(canonical, input, article, community, thread) do
    canonical.community_id == community.id and canonical.thread == thread and
      canonical.article_id == article.id and canonical.branch_id == input.branch_id and
      canonical.id == input.id
  end
end
