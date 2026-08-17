defmodule GroupherServer.CMS.Gate.Access do
  @moduledoc """
  Internal resource access composition for Gate actions.

  This module is an implementation seam, not a product-facing Gate API.
  Business code must call `CMS.Gate.access_check/3`; the `evaluate/3-4`,
  `evaluate_result/3-4` and `decision/4` functions are reserved for Gate's
  internal control flow and focused seam tests.

  Business position:

      CMS operation
        -> CMS.Gate
        -> Access
        -> allow / deny
        -> domain context
  """

  alias GroupherServer.CMS.Model.Comment, as: CommentModel
  alias GroupherServer.CMS.Model.Community, as: CommunityModel
  alias __MODULE__.{Article, Comment, Community}
  import Ecto.Query, warn: false

  alias GroupherServer.CMS.Gate.Decision
  alias GroupherServer.CMS.Gate.Scope
  alias GroupherServer.CMS.{FrontDesk, Articles}
  alias GroupherServer.Repo

  alias GroupherServer.CMS.Model.{
    ArticleLifecycle,
    CommentLifecycle,
    CommunityLifecycle,
    DocBranch,
    DocLifecycle
  }

  @doc false
  def evaluate(user, action, community), do: Community.evaluate(user, action, community)

  @doc false
  def evaluate_result(user, action, community),
    do: Community.evaluate_result(user, action, community)

  @doc false
  defp load_context(:community, %CommunityModel{} = community) do
    case lock_community_lifecycle(community.id) do
      %CommunityLifecycle{} = lifecycle ->
        {:ok,
         %{
           community: %{community | lifecycle: lifecycle},
           community_lifecycle: lifecycle
         }}

      nil ->
        {:error, :lifecycle_not_found}
    end
  end

  @doc false
  defp load_context(
         :article,
         %CommunityModel{} = community,
         :doc,
         %{community_id: community_id, branch_id: branch_id, article_hash_id: hash_id} = article
       )
       when community_id == community.id and not is_nil(branch_id) do
    with %CommunityLifecycle{} = community_lifecycle <- lock_community_lifecycle(community.id),
         %DocBranch{} = doc_branch <- lock_doc_branch(community.id, branch_id),
         %DocLifecycle{} = article_lifecycle <-
           lock_doc_lifecycle(community.id, branch_id, hash_id) do
      {:ok,
       %{
         article: article,
         community: %{community | lifecycle: community_lifecycle},
         community_lifecycle: community_lifecycle,
         doc_branch: doc_branch,
         article_lifecycle: article_lifecycle
       }}
    else
      nil -> {:error, :lifecycle_not_found}
    end
  end

  defp load_context(
         :article,
         %CommunityModel{} = community,
         :doc,
         %{community_id: community_id}
       )
       when community_id == community.id,
       do: {:error, :doc_branch_required}

  defp load_context(
         :article,
         %CommunityModel{} = community,
         thread,
         %{community_id: community_id, article_hash_id: hash_id} = article
       )
       when thread in [:post, :blog, :changelog] and community_id == community.id do
    with %CommunityLifecycle{} = community_lifecycle <- lock_community_lifecycle(community.id),
         %ArticleLifecycle{} = article_lifecycle <-
           lock_article_lifecycle(community.id, thread, hash_id) do
      {:ok,
       %{
         article: article,
         community: %{community | lifecycle: community_lifecycle},
         community_lifecycle: community_lifecycle,
         article_lifecycle: article_lifecycle
       }}
    else
      nil -> {:error, :lifecycle_not_found}
    end
  end

  defp load_context(:article, _community, _thread, _article),
    do: {:error, :gate_resource_mismatch}

  @doc false
  defp load_context(
         :comment,
         %CommunityModel{} = community,
         thread,
         article,
         %CommentModel{} = comment
       ) do
    with {:ok, context} <- load_context(:article, community, thread, article),
         %CommentLifecycle{} = comment_lifecycle <- lock_comment_lifecycle(comment.id) do
      {:ok, Map.put(context, :comment_lifecycle, comment_lifecycle)}
    else
      nil -> {:error, :lifecycle_not_found}
      {:error, _reason} = error -> error
    end
  end

  @doc "Loads and locks a Community, then returns it only when the action is allowed."
  @spec access_check(term(), atom(), CommunityModel.t()) ::
          {:ok, CommunityModel.t()} | {:error, Decision.t()}
  def access_check(user, action, %CommunityModel{} = community) do
    with {:ok, context} <- load_context(:community, community),
         %Decision{allowed: true} <- decision(user, action, context.community, context) do
      {:ok, context.community}
    else
      %Decision{} = decision -> {:error, decision}
      {:error, reason} -> {:error, Decision.deny(reason)}
    end
  end

  def access_check(user, action, %CommentModel{} = comment) do
    with {:ok, thread} <- FrontDesk.thread_of(comment),
         {:ok, article} <- FrontDesk.article_of(comment, preload: :community),
         %CommunityModel{} = community <- article.community,
         {:ok, result} <-
           Articles.Lock.run_for_article(community, thread, article, fn ->
             with {:ok, context} <- load_context(:comment, community, thread, article, comment),
                  %Decision{allowed: true} <- decision(user, action, comment, context) do
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

  def access_check(user, :read_draft, article) do
    access_check(user, :read_draft, article, %{policy_mode: :owner_management})
  end

  def access_check(user, action, %{community_id: community_id} = article) do
    with %CommunityModel{} = community <- Repo.get(CommunityModel, community_id),
         {:ok, thread} <- article_thread(article),
         {:ok, result} <-
           Articles.Lock.run_for_article(community, thread, article, fn ->
             with {:ok, context} <- load_context(:article, community, thread, article),
                  %Decision{allowed: true} <- decision(user, action, article, context) do
               {:ok, canonical_article(context.article, context.community)}
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

  def access_check(user, :read_draft, %{community_id: community_id} = article, context)
      when is_map(context) do
    with %CommunityModel{} <- Repo.get(CommunityModel, community_id),
         {:ok, thread} <- article_thread(article),
         %{__struct__: schema} <- article,
         %Ecto.Query{} = query <-
           Scope.scope(
             schema,
             user,
             :read_draft,
             Map.merge(
               %{thread: thread, stage: :draft, policy_mode: :owner_management},
               context
             )
             |> maybe_put_doc_branch(article, thread)
           ),
         true <- Repo.exists?(where(query, [candidate], candidate.id == ^article.id)) do
      {:ok, article}
    else
      nil -> {:error, Decision.deny(:resource_not_found)}
      false -> {:error, Decision.deny(:permission_denied)}
      {:error, %Decision{} = decision} -> {:error, decision}
      {:error, reason} -> {:error, Decision.deny(reason)}
    end
  end

  @doc false
  def evaluate(user, action, %CommunityModel{} = community, context),
    do: Community.evaluate(user, action, community, context)

  def evaluate(user, action, %CommentModel{} = comment, context),
    do: Comment.evaluate(user, action, comment, context)

  def evaluate(user, action, article, context),
    do: Article.evaluate(user, action, article, context)

  @doc false
  def evaluate_result(user, action, %CommunityModel{} = community, context),
    do: Community.evaluate_result(user, action, community, context)

  def evaluate_result(user, action, %CommentModel{} = comment, context),
    do: Comment.evaluate_result(user, action, comment, context)

  def evaluate_result(user, action, article, context),
    do: Article.evaluate_result(user, action, article, context)

  @doc false
  @spec decision(term(), atom(), map(), map()) :: GroupherServer.CMS.Gate.Decision.t()
  def decision(user, action, resource, context) do
    evaluate_result(user, action, resource, context)
    |> GroupherServer.CMS.Gate.Decision.from_result(context)
  end

  defp maybe_put_doc_branch(context, %{branch_id: branch_id}, :doc),
    do: Map.put_new(context, :branch_id, branch_id)

  defp maybe_put_doc_branch(context, _article, _thread), do: context

  defp canonical_article(article, community), do: Map.put(article, :community, community)

  defp article_thread(%{thread: thread}) when thread in [:post, :blog, :changelog, :doc],
    do: {:ok, thread}

  defp article_thread(article), do: FrontDesk.thread_of(article)

  defp lock_community_lifecycle(community_id) do
    CommunityLifecycle
    |> where([lifecycle], lifecycle.community_id == ^community_id)
    |> lock("FOR SHARE")
    |> Repo.one()
  end

  defp lock_article_lifecycle(community_id, thread, article_hash_id) do
    ArticleLifecycle
    |> where(
      [lifecycle],
      lifecycle.community_id == ^community_id and lifecycle.thread == ^thread and
        lifecycle.article_hash_id == ^article_hash_id
    )
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp lock_doc_lifecycle(community_id, branch_id, article_hash_id) do
    DocLifecycle
    |> where(
      [lifecycle],
      lifecycle.community_id == ^community_id and lifecycle.branch_id == ^branch_id and
        lifecycle.article_hash_id == ^article_hash_id
    )
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp lock_doc_branch(community_id, branch_id) do
    DocBranch
    |> where([branch], branch.community_id == ^community_id and branch.id == ^branch_id)
    |> lock("FOR SHARE")
    |> Repo.one()
  end

  defp lock_comment_lifecycle(comment_id) do
    CommentLifecycle
    |> where([lifecycle], lifecycle.comment_id == ^comment_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end
end
