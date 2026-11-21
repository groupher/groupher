defmodule GroupherServer.CMS.Gate.Access.Load.Query do
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

  require GroupherServer.CMS.Gate.ErrorCat

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Gate.Access.Load.Queries
  alias CMS.Gate.Context.Access.Article, as: ArticleContext
  alias CMS.Gate.Context.Access.Comment, as: CommentContext
  alias CMS.Gate.Context.Access.Community, as: CommunityContext
  alias CMS.Gate.Context.Access.Doc, as: DocContext
  alias CMS.Gate.{ErrorCat, Config}
  alias CMS.Model.Comment
  alias GroupherServer.{Accounts}
  alias Accounts.Model.User

  alias CMS.Model.{
    ArticleLifecycle,
    Article,
    ArticleBinding,
    CommentLifecycle,
    Community,
    CommunityLifecycle,
    DocsTrashedArticle,
    ArticlePublic,
    PostState
  }

  @article_threads Config.ordinary_article_threads()

  @doc "Loads a branch-free Doc and its current site, lifecycle and review facts."
  def doc_site(actor, %Community{} = community, %Article{thread: :doc} = resource) do
    load_doc_site(actor, community, resource, :locked)
  end

  def doc_site(_, _, _), do: {:error, ErrorCat.gate_resource_mismatch()}

  @doc "Loads the same Doc policy facts without row locks in a read-only snapshot."
  def doc_site_snapshot(actor, %Community{} = community, %Article{thread: :doc} = resource) do
    load_doc_site(actor, community, resource, :snapshot)
  end

  def doc_site_snapshot(_, _, _), do: {:error, ErrorCat.gate_resource_mismatch()}

  defp load_doc_site(actor, community, resource, mode) do
    with %Community{} = community <- Repo.get(Community, community.id),
         %Article{thread: :doc} = canonical <- site_article(resource.id, mode),
         %ArticleBinding{thread: :doc} <- site_binding(canonical.id, community.id, mode),
         canonical <- preload_article_author(canonical),
         {:ok, passport_scopes} <- community_passport_scopes(actor, community),
         {:ok, article_passport_scope} <- article_passport_scope(actor, canonical),
         %CommunityLifecycle{} = community_lifecycle <-
           site_community_lifecycle(community.id, mode),
         %ArticleLifecycle{} = doc_lifecycle <-
           site_doc_lifecycle(canonical.id, community.id, mode),
         review_scope_keys <-
           Queries.article_review_scope_keys_for_article(canonical.id, community.id) do
      {:ok,
       %DocContext{
         doc: canonical,
         community: %{community | lifecycle: community_lifecycle},
         community_lifecycle: community_lifecycle,
         passport_global_scope: passport_scopes.global,
         community_passport_scope: passport_scopes.community,
         article_passport_scope: article_passport_scope,
         doc_lifecycle: doc_lifecycle,
         public_available?:
           Repo.exists?(from(p in ArticlePublic, where: p.article_id == ^canonical.id)),
         trashed?:
           Repo.exists?(from(t in DocsTrashedArticle, where: t.article_id == ^canonical.id)),
         review_scope_keys: review_scope_keys,
         review_restricted?: review_scope_keys != []
       }}
    else
      nil -> {:error, ErrorCat.lifecycle_not_found()}
      %Article{} -> {:error, ErrorCat.gate_resource_mismatch()}
      %ArticleBinding{} -> {:error, ErrorCat.gate_resource_mismatch()}
      {:error, _reason} = error -> error
    end
  end

  defp site_article(id, :locked), do: Queries.resource(Article, id)
  defp site_article(id, :snapshot), do: Queries.resource_snapshot(Article, id)

  defp site_binding(article_id, community_id, :locked) do
    Queries.article_binding(article_id, community_id)
  end

  defp site_binding(article_id, community_id, :snapshot) do
    Queries.article_binding_snapshot(article_id, community_id)
  end

  defp site_community_lifecycle(id, :locked), do: Queries.community_lifecycle(id)
  defp site_community_lifecycle(id, :snapshot), do: Queries.community_lifecycle_snapshot(id)

  defp site_doc_lifecycle(article_id, community_id, :locked) do
    Queries.doc_site_lifecycle(article_id, community_id)
  end

  defp site_doc_lifecycle(article_id, community_id, :snapshot) do
    Queries.doc_site_lifecycle_snapshot(article_id, community_id)
  end

  @doc """
  Loads the canonical Community lifecycle and builds its typed Access Context.

  The lifecycle row is acquired with the lock mode owned by `Load.Queries`.
  A missing lifecycle returns `lifecycle_not_found` instead of producing a
  partial context.

  ## Examples

      Load.Query.community(actor, community)
      #=> {:ok, %Context.Access.Community{}} | {:error, reason}
  """
  @spec community(term(), Community.t()) ::
          {:ok, CommunityContext.t()} | {:error, ErrorCat.error() | term()}
  def community(actor, %Community{} = community) do
    load_community(actor, community, :locked)
  end

  @doc "Loads Community policy facts without row locks in a read-only snapshot."
  def community_snapshot(actor, %Community{} = community) do
    load_community(actor, community, :snapshot)
  end

  defp load_community(actor, community, mode) do
    with %Community{} = community <- Repo.get(Community, community.id),
         {:ok, passport_scopes} <- community_passport_scopes(actor, community),
         %CommunityLifecycle{} = lifecycle <- site_community_lifecycle(community.id, mode) do
      {:ok,
       %CommunityContext{
         community: %{community | lifecycle: lifecycle},
         community_lifecycle: lifecycle,
         passport_global_scope: passport_scopes.global,
         community_passport_scope: passport_scopes.community
       }}
    else
      nil -> {:error, ErrorCat.lifecycle_not_found()}
      {:error, ErrorCat.error_pattern() = error} -> {:error, error}
      {:error, _reason} -> {:error, ErrorCat.permission_denied()}
    end
  end

  defp community_passport_scopes(%User{} = actor, community) do
    with {:ok, global} <- CMS.Passport.load_global_scope(actor),
         {:ok, scoped_community} <- CMS.Passport.load_community_scope(actor, community) do
      {:ok, %{global: global, community: scoped_community}}
    else
      {:error, _reason} -> {:error, ErrorCat.permission_denied()}
    end
  end

  defp community_passport_scopes(_actor, _community) do
    {:ok, %{global: nil, community: nil}}
  end

  defp article_passport_scope(%User{} = actor, %Article{} = article) do
    CMS.Passport.load_article_scope(actor, article)
  end

  defp article_passport_scope(_actor, _article), do: {:ok, nil}

  @doc """
  Reloads an Article or Doc and its authoritative lifecycle facts into a typed
  Access Context.

  The supplied Community, thread and resource identities must agree. Docs also
  require a branch, while unsupported threads and identity mismatches fail
  closed with a declared Gate error.
  """
  def article(
        actor,
        %Community{} = community,
        thread,
        %Article{thread: thread} = resource
      )
      when thread in @article_threads do
    article_in_community(actor, community, thread, resource)
  end

  def article(actor, %Community{} = community, :doc, %Article{thread: :doc} = resource) do
    doc_site(actor, community, resource)
  end

  def article(_actor, _community, _thread, _resource) do
    {:error, ErrorCat.gate_resource_mismatch()}
  end

  @doc "Loads a canonical Article and its owner/co-author scope without a Community binding."
  def article_author_management(actor, %Article{} = resource) do
    with %Article{thread: thread} = canonical <- Queries.resource(Article, resource.id),
         true <- thread in [:post, :blog, :changelog, :doc],
         canonical <- preload_article_author(canonical),
         {:ok, article_passport_scope} <- article_passport_scope(actor, canonical),
         %ArticleLifecycle{} = article_lifecycle <- Queries.article_lifecycle(canonical.id) do
      {:ok,
       %ArticleContext{
         article: canonical,
         community: nil,
         community_lifecycle: nil,
         article_lifecycle: article_lifecycle,
         article_passport_scope: article_passport_scope
       }}
    else
      nil -> {:error, ErrorCat.resource_not_found()}
      false -> {:error, ErrorCat.gate_resource_mismatch()}
      {:error, _reason} = error -> error
    end
  end

  def article_author_management(_actor, _resource) do
    {:error, ErrorCat.gate_resource_mismatch()}
  end

  @doc "Loads an ordinary Article against an explicit ArticleBinding binding."
  def article_in_community(
        actor,
        %Community{} = community,
        thread,
        %Article{thread: thread} = resource
      )
      when thread in @article_threads do
    with %Community{} = community <- Repo.get(Community, community.id),
         %Article{thread: ^thread} = canonical <- Queries.resource(Article, resource.id),
         %ArticleBinding{thread: ^thread} <- Queries.article_binding(canonical.id, community.id),
         canonical <- preload_article_author(canonical),
         {:ok, passport_scopes} <- community_passport_scopes(actor, community),
         {:ok, article_passport_scope} <- article_passport_scope(actor, canonical),
         %CommunityLifecycle{} = community_lifecycle <- Queries.community_lifecycle(community.id),
         %ArticleLifecycle{} = article_lifecycle <- Queries.article_lifecycle(canonical.id),
         review_scope_keys <-
           Queries.article_review_scope_keys(article_lifecycle.id, community.id) do
      {:ok,
       %ArticleContext{
         article: canonical,
         community: %{community | lifecycle: community_lifecycle},
         community_lifecycle: community_lifecycle,
         article_lifecycle: article_lifecycle,
         passport_global_scope: passport_scopes.global,
         community_passport_scope: passport_scopes.community,
         article_passport_scope: article_passport_scope,
         review_scope_keys: review_scope_keys,
         review_restricted?: review_scope_keys != []
       }}
    else
      nil -> {:error, ErrorCat.lifecycle_not_found()}
      %Article{} -> {:error, ErrorCat.gate_resource_mismatch()}
      %ArticleBinding{} -> {:error, ErrorCat.gate_resource_mismatch()}
      {:error, _reason} = error -> error
    end
  end

  def article_in_community(
        actor,
        %Community{} = community,
        :doc,
        %Article{thread: :doc} = resource
      ) do
    doc_site(actor, community, resource)
  end

  def article_in_community(_actor, _community, _thread, _resource) do
    {:error, ErrorCat.gate_resource_mismatch()}
  end

  @doc """
  Reloads a Comment together with its canonical parent and lifecycle facts.

  The returned context contains the Comment, parent Article or Doc, Community,
  and all lifecycle rows required by Comment policy evaluation. Any identity
  mismatch fails closed rather than authorizing from caller-supplied structs.
  """
  def comment(actor, %Community{} = community, thread, article, %Comment{} = comment) do
    with %Community{} = community <- Repo.get(Community, community.id),
         canonical when not is_nil(canonical) <- Queries.resource(Comment, comment.id),
         true <- same_comment_identity?(canonical, comment, article, community, thread),
         {:ok, parent_context} <- parent_context(actor, community, thread, article),
         %CommentLifecycle{} = comment_lifecycle <- Queries.comment_lifecycle(canonical.id) do
      {:ok,
       %CommentContext{
         comment: canonical,
         comment_lifecycle: comment_lifecycle,
         public_readable?: public_comment_reachable?(canonical, community),
         comment_author_user_id: canonical.author_id,
         article: parent_resource(parent_context),
         article_lifecycle: parent_lifecycle(parent_context),
         article_author_user_id: article_author_user_id(parent_context),
         article_cat: article_cat(parent_context),
         community: parent_context.community,
         community_lifecycle: parent_context.community_lifecycle,
         passport_global_scope: parent_passport_scope(parent_context, :global),
         community_passport_scope: parent_passport_scope(parent_context, :community),
         article_passport_scope: parent_passport_scope(parent_context, :article)
       }}
    else
      nil -> {:error, ErrorCat.lifecycle_not_found()}
      false -> {:error, ErrorCat.gate_resource_mismatch()}
      {:error, _reason} = error -> error
    end
  end

  defp public_comment_reachable?(comment, community) do
    context =
      CMS.Gate.Context.Scope.Comment.for_thread(comment.thread, community_id: community.id)

    Comment
    |> CMS.Gate.scope(nil, :read, context)
    |> where([c], c.id == ^comment.id)
    |> Repo.exists?()
  end

  defp parent_context(actor, community, :doc, %Article{thread: :doc} = article) do
    doc_site(actor, community, article)
  end

  defp parent_context(actor, community, thread, article) do
    article(actor, community, thread, article)
  end

  defp parent_resource(%ArticleContext{article: article}), do: article
  defp parent_resource(%DocContext{doc: doc}), do: doc

  defp parent_lifecycle(%ArticleContext{article_lifecycle: lifecycle}), do: lifecycle
  defp parent_lifecycle(%DocContext{doc_lifecycle: lifecycle}), do: lifecycle

  defp parent_passport_scope(%ArticleContext{passport_global_scope: scope}, :global), do: scope
  defp parent_passport_scope(%DocContext{passport_global_scope: scope}, :global), do: scope

  defp parent_passport_scope(%ArticleContext{community_passport_scope: scope}, :community) do
    scope
  end

  defp parent_passport_scope(%DocContext{community_passport_scope: scope}, :community), do: scope
  defp parent_passport_scope(%ArticleContext{article_passport_scope: scope}, :article), do: scope
  defp parent_passport_scope(%DocContext{article_passport_scope: scope}, :article), do: scope

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

  defp same_comment_identity?(canonical, input, article, _community, thread) do
    canonical.thread == thread and canonical.article_id == article.id and canonical.id == input.id
  end
end
