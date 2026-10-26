defmodule GroupherServer.CMS.Gate.Access.Query do
  @moduledoc """
  Internal Access facade for single-resource access checks.

  This module is the internal implementation behind `CMS.Gate`. Resource-specific
  loading and policy evaluation remain in `Access.Check`; aggregate commands enter
  the transaction and lock through the facade's `with_*` callbacks.

      Simple check
        -> access_check -> short transaction -> Decision

      Aggregate command
        -> with_check -> aggregate transaction + lock
             -> canonical load + policy -> command callback
             -> commit / rollback

  Resource policies remain separated by resource type beneath `Access.Check`
  and return only `:ok` or `{:error, reason}`.
  """

  import Ecto.Query

  alias GroupherServer.CommandPipeline
  alias GroupherServer.{CMS, Repo}
  alias CommandPipeline.StageContext

  alias CMS.Gate.Access.Check
  alias CMS.Gate.Access.Policy.Application, as: ApplicationPolicy
  alias CMS.Gate.{Decision, ErrorCat}
  alias CMS.{Articles, FrontDesk}
  alias CMS.Model.{Article, Comment, Community}
  alias CMS.Model.CommunityApplication
  alias CMS.Articles.MutationLock
  alias Helper.ORM.AdvisoryLock

  @article_models [Article]

  @doc """
  Authorizes one resource and returns its canonical loaded representation.

  This compatibility entry is appropriate for a check that does not own a
  larger command callback. Aggregate commands should use `with_check/4`.

  ## Examples

      Gate.Access.access_check(actor, :edit, comment)
      #=> {:ok, canonical_comment} | {:error, %Gate.Decision{}}
  """
  @spec access_check(term(), atom(), term()) ::
          {:ok, term()} | {:error, GroupherServer.CMS.Gate.Decision.t()}
  def access_check(actor, action, %Community{} = resource) do
    Check.community(actor, action, resource)
  end

  def access_check(actor, action, %Comment{} = resource) do
    Check.comment(actor, action, resource)
  end

  def access_check(actor, action, %Article{} = resource) do
    Check.article(actor, action, resource)
  end

  def access_check(actor, action, %model{} = resource)
      when model in @article_models do
    Check.article(actor, action, resource)
  end

  def access_check(
        actor,
        action,
        %{
          id: article_id,
          thread: :doc,
          branch_id: branch_id,
          community: %Community{} = community
        }
      )
      when is_binary(article_id) and is_integer(branch_id) do
    case Repo.get(Article, article_id) do
      %Article{} = article ->
        with_branch_check(actor, action, community, article, branch_id, fn canonical ->
          {:ok, canonical}
        end)

      nil ->
        {:error, Decision.deny(ErrorCat.resource_not_found())}
    end
  end

  def access_check(_actor, _action, %{thread: :doc, branch_id: branch_id})
      when is_integer(branch_id) do
    {:error, ErrorCat.doc_branch_required()}
  end

  def access_check(
        actor,
        action,
        %{id: article_id, thread: thread, community: %Community{} = community}
      )
      when is_binary(article_id) and thread in [:post, :blog, :changelog, :doc] do
    case Repo.get(Article, article_id) do
      %Article{} = article -> Check.article(actor, action, article, community)
      nil -> {:error, Decision.deny(ErrorCat.resource_not_found())}
    end
  end

  def access_check(actor, action, %{id: article_id, thread: thread})
      when is_binary(article_id) and thread in [:post, :blog, :changelog, :doc] do
    case Repo.get(Article, article_id) do
      %Article{} = article -> Check.article(actor, action, article)
      nil -> {:error, Decision.deny(ErrorCat.resource_not_found())}
    end
  end

  def access_check(_actor, _action, _resource) do
    {:error, Decision.deny(ErrorCat.unsupported_resource())}
  end

  @doc """
  Loads and authorizes a resource while joining the caller-owned transaction.

  Unlike `with_check/4`, this API never starts or commits a transaction and
  never accepts a business callback. It is the only Gate entry used by a
  command pipeline runner, and it fails unless the runner is currently
  executing the declared `gate` stage.
  """
  def check_in_transaction(actor, action, resource)

  def check_in_transaction(actor, action, %Community{} = community) do
    with {:ok, :pass} <- require_transaction() do
      query = from(record in Community, where: record.id == ^community.id, lock: "FOR UPDATE")

      case Repo.one(query) do
        %Community{} = canonical ->
          Check.with_authorized_community(actor, action, canonical, fn value -> {:ok, value} end)
          |> normalize_join_decision()

        nil ->
          {:error, ErrorCat.resource_not_found()}
      end
    end
  end

  def check_in_transaction(actor, action, %Comment{} = comment) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, thread} <- FrontDesk.thread_of(comment),
         {:ok, article} <- parent_article(comment),
         %Community{} = community <- Repo.get(Community, comment.community_id),
         {:ok, :pass} <- acquire_comment_parent_lock(community, article, comment) do
      Check.with_authorized(actor, action, {community, thread, article, comment}, fn value ->
        {:ok, value}
      end)
      |> normalize_join_decision()
    else
      nil -> {:error, ErrorCat.resource_not_found()}
      {:error, reason} -> {:error, reason}
    end
  end

  def check_in_transaction(_actor, _action, _resource) do
    {:error, ErrorCat.unsupported_resource()}
  end

  @doc "Checks a Community workflow action within the caller transaction and row lock."
  def check_community_workflow_in_transaction(actor, action, %Community{id: community_id}) do
    query = from(record in Community, where: record.id == ^community_id, lock: "FOR UPDATE")

    with {:ok, :pass} <- require_caller_transaction(),
         %Community{} = canonical <- Repo.one(query) do
      Check.with_authorized_community(actor, action, canonical, fn value -> {:ok, value} end)
      |> normalize_join_decision()
    else
      nil -> {:error, ErrorCat.resource_not_found()}
      {:error, reason} -> {:error, reason}
    end
  end

  def check_community_workflow_in_transaction(_actor, _action, _community) do
    {:error, ErrorCat.unsupported_resource()}
  end

  @doc "Joins the pipeline transaction for one Article or Comment interaction target."
  def check_interaction_in_transaction(actor, action, %Comment{} = comment) do
    check_in_transaction(actor, action, comment)
  end

  def check_interaction_in_transaction(
        actor,
        action,
        %{
          id: article_id,
          thread: :doc,
          branch_id: branch_id,
          community: %Community{} = community
        }
      )
      when is_binary(article_id) and is_integer(branch_id) do
    check_in_transaction(actor, action, %{id: article_id, thread: :doc}, community, branch_id)
  end

  def check_interaction_in_transaction(
        actor,
        action,
        %{id: article_id, thread: thread, community: %Community{} = community}
      )
      when is_binary(article_id) and thread in [:post, :blog, :changelog] do
    check_in_transaction(actor, action, %{id: article_id, thread: thread}, community)
  end

  def check_interaction_in_transaction(_actor, _action, _resource) do
    {:error, ErrorCat.scope_context_missing()}
  end

  @doc "Returns the canonical Comment together with its canonical parent Article."
  def check_comment_in_transaction(actor, action, %Comment{} = comment) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, thread} <- FrontDesk.thread_of(comment),
         {:ok, article} <- parent_article(comment),
         %Community{} = community <- Repo.get(Community, comment.community_id),
         {:ok, :pass} <- acquire_comment_parent_lock(community, article, comment) do
      Check.with_authorized(
        actor,
        action,
        {community, thread, article, comment},
        fn canonical, parent -> {:ok, {canonical, parent}} end
      )
      |> normalize_join_decision()
    else
      nil -> {:error, ErrorCat.resource_not_found()}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Joins the caller transaction for an Article binding check."
  def check_in_transaction(actor, action, resource, community)

  def check_in_transaction(actor, action, %Article{} = article, %Community{} = community) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, :pass} <- acquire_article_lock(community, article) do
      Check.with_authorized_article_binding(actor, action, {community, article}, fn value ->
        {:ok, value}
      end)
      |> normalize_join_decision()
    end
  end

  def check_in_transaction(
        actor,
        action,
        %{id: article_id, thread: thread},
        %Community{} = community
      )
      when is_binary(article_id) and thread in [:post, :blog, :changelog, :doc] do
    case Repo.get(Article, article_id) do
      %Article{thread: :doc} ->
        {:error, ErrorCat.doc_branch_required()}

      %Article{} = article ->
        check_in_transaction(actor, action, article, community)

      nil ->
        {:error, ErrorCat.resource_not_found()}
    end
  end

  @doc "Joins the caller transaction for a branch-scoped Doc check."
  def check_in_transaction(actor, action, resource, community, branch_id)

  def check_in_transaction(
        actor,
        action,
        %Article{thread: :doc} = article,
        %Community{} = community,
        branch_id
      )
      when is_integer(branch_id) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, :pass} <- acquire_doc_lock(community, article, branch_id) do
      Check.with_authorized_doc(actor, action, {community, article, branch_id}, fn value ->
        {:ok, value}
      end)
      |> normalize_join_decision()
    end
  end

  def check_in_transaction(
        actor,
        action,
        %{id: article_id, thread: :doc},
        %Community{} = community,
        branch_id
      )
      when is_binary(article_id) and is_integer(branch_id) do
    case Repo.get(Article, article_id) do
      %Article{thread: :doc} = article ->
        check_in_transaction(actor, action, article, community, branch_id)

      %Article{} ->
        {:error, ErrorCat.doc_branch_required()}

      nil ->
        {:error, ErrorCat.resource_not_found()}
    end
  end

  defp require_transaction do
    cond do
      not Repo.in_transaction?() -> {:error, ErrorCat.gate_transaction_required()}
      StageContext.current() != :gate -> {:error, ErrorCat.gate_stage_required()}
      true -> {:ok, :pass}
    end
  end

  defp require_caller_transaction do
    if Repo.in_transaction?() do
      {:ok, :pass}
    else
      {:error, ErrorCat.gate_transaction_required()}
    end
  end

  defp acquire_article_lock(%Community{} = community, %Article{thread: thread, id: article_id})
       when thread in [:post, :blog, :changelog] do
    AdvisoryLock.acquire!(MutationLock.key(community, thread, article_id))
    {:ok, :pass}
  end

  defp acquire_article_lock(_community, _article), do: {:error, ErrorCat.doc_branch_required()}

  defp acquire_comment_parent_lock(
         %Community{} = community,
         %Article{thread: :doc} = article,
         %Comment{branch_id: branch_id}
       )
       when is_integer(branch_id) do
    acquire_doc_lock(community, article, branch_id)
  end

  defp acquire_comment_parent_lock(%Community{} = community, %Article{} = article, _comment) do
    acquire_article_lock(community, article)
  end

  defp acquire_doc_lock(%Community{} = community, %Article{id: article_id}, branch_id) do
    AdvisoryLock.acquire!(MutationLock.doc_key(community, branch_id, article_id))
    {:ok, :pass}
  end

  @doc """
  Runs authorization and a command callback in one aggregate transaction.

  The callback receives the canonical resource loaded after the advisory lock
  is acquired. It must return `{:ok, result}` or `{:error, reason}`; any other
  shape becomes `unexpected_callback_result`, while raise/throw/exit propagate
  after rollback. An internal arity-2 callback may additionally receive the
  canonical parent aggregate; this keeps parent reuse inside the Gate/Command
  boundary without exposing the Access Context.

  ## Examples

      Gate.Access.with_check(actor, :edit, comment, fn canonical ->
        ORM.update(canonical, attrs)
      end)
  """
  @spec with_check(
          term(),
          atom(),
          struct(),
          (struct(), struct() -> {:ok, term()} | {:error, term()})
          | (struct() -> {:ok, term()} | {:error, term()})
        ) ::
          {:ok, term()} | {:error, term()}
  def with_check(actor, action, %Comment{} = comment, callback)
      when is_function(callback, 1) or is_function(callback, 2) do
    with {:ok, thread} <- FrontDesk.thread_of(comment),
         {:ok, article} <- parent_article(comment),
         %Community{} = community <- Repo.get(Community, comment.community_id) do
      transact_parent(community, article, comment.branch_id, fn ->
        Check.with_authorized(actor, action, {community, thread, article, comment}, callback)
      end)
      |> normalize_decision()
    else
      nil -> {:error, ErrorCat.resource_not_found()}
      {:error, %Decision{} = decision} -> {:error, Decision.primary_error(decision)}
      {:error, reason} -> {:error, reason}
    end
  end

  def with_check(actor, action, %model{} = article, callback)
      when model in @article_models and is_function(callback, 1) do
    _ = {actor, action, article, callback}
    {:error, ErrorCat.scope_context_missing()}
  end

  def with_check(
        actor,
        action,
        %{id: article_id, thread: :doc, branch_id: branch_id},
        callback
      )
      when is_binary(article_id) and is_integer(branch_id) and is_function(callback, 1) do
    _ = {actor, action, article_id, branch_id, callback}
    {:error, ErrorCat.scope_context_missing()}
  end

  def with_check(actor, action, %{id: article_id, thread: thread}, callback)
      when is_binary(article_id) and thread in [:post, :blog, :changelog] and
             is_function(callback, 1) do
    case Repo.get(Article, article_id) do
      %Article{} = article -> with_check(actor, action, article, callback)
      nil -> {:error, ErrorCat.resource_not_found()}
    end
  end

  def with_check(_actor, _action, _resource, _callback) do
    {:error, ErrorCat.unsupported_resource()}
  end

  @doc """
  Runs authorization and a Community callback in one aggregate transaction.

  ## Examples

      Gate.Access.with_community_check(actor, :update, community, fn canonical ->
        {:ok, canonical}
      end)
  """
  @spec with_community_check(
          term(),
          atom(),
          Community.t(),
          (Community.t() -> {:ok, term()} | {:error, term()})
        ) :: {:ok, term()} | {:error, term()}
  def with_community_check(actor, action, %Community{id: community_id}, callback)
      when is_function(callback, 1) do
    query = from(record in Community, where: record.id == ^community_id, lock: "FOR UPDATE")

    Repo.transact(fn ->
      case Repo.one(query) do
        %Community{} = canonical ->
          Check.with_authorized_community(actor, action, canonical, callback)

        nil ->
          {:error, ErrorCat.resource_not_found()}
      end
    end)
    |> normalize_decision()
  end

  @doc "Runs Community Application admission and callback in the application lock."
  def with_application_check(actor, action, %CommunityApplication{id: application_id}, callback)
      when is_function(callback, 1) do
    query =
      from(application in CommunityApplication,
        where: application.id == ^application_id,
        lock: "FOR UPDATE"
      )

    Repo.transact(fn ->
      case Repo.one(query) do
        %CommunityApplication{} = canonical ->
          case ApplicationPolicy.check_access(actor, action, canonical) do
            {:ok, :pass} -> callback.(canonical)
            {:error, reason} -> {:error, reason}
          end

        nil ->
          {:error, ErrorCat.resource_not_found()}
      end
    end)
  end

  @doc "Locks and authorizes a Community Application inside the pipeline transaction."
  def check_application_in_transaction(
        actor,
        action,
        %CommunityApplication{id: application_id}
      ) do
    query =
      from(application in CommunityApplication,
        where: application.id == ^application_id,
        lock: "FOR UPDATE"
      )

    with {:ok, :pass} <- require_transaction(),
         %CommunityApplication{} = canonical <- Repo.one(query),
         {:ok, :pass} <- ApplicationPolicy.check_access(actor, action, canonical) do
      {:ok, canonical}
    else
      nil -> {:error, ErrorCat.resource_not_found()}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Checks Community creation inside the pipeline transaction."
  def check_community_create_in_transaction(actor, target) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, :pass} <- CMS.Gate.Access.Policy.Community.check_create(actor) do
      {:ok, target}
    end
  end

  @doc "Runs an ordinary Article command against an explicit ArticleBinding binding."
  @spec with_community_check(
          term(),
          atom(),
          Community.t(),
          Article.t(),
          (Article.t() -> {:ok, term()} | {:error, term()})
        ) :: {:ok, term()} | {:error, term()}
  def with_community_check(
        actor,
        action,
        %Community{} = community,
        %Article{} = article,
        callback
      )
      when is_function(callback, 1) do
    Articles.MutationLock.transact_article(community, article, fn ->
      Check.with_authorized_article_binding(actor, action, {community, article}, callback)
    end)
    |> normalize_decision()
  end

  @doc "Runs a branch-scoped command with an explicit ArticleBinding Community."
  @spec with_branch_check(
          term(),
          atom(),
          Community.t(),
          Article.t(),
          pos_integer(),
          (Article.t() -> term())
        ) :: {:ok, term()} | {:error, term()}
  def with_branch_check(
        actor,
        action,
        %Community{} = community,
        %Article{thread: :doc} = article,
        branch_id,
        callback
      )
      when is_integer(branch_id) and is_function(callback, 1) do
    Articles.MutationLock.transact_doc(community, article, branch_id, fn ->
      Check.with_authorized_doc(actor, action, {community, article, branch_id}, callback)
    end)
    |> normalize_decision()
  end

  defp normalize_decision({:error, %Decision{} = decision}) do
    {:error, Decision.primary_error(decision)}
  end

  defp normalize_decision(result), do: result

  defp normalize_join_decision(result), do: result

  defp parent_article(%Comment{article_id: article_id}) when is_binary(article_id) do
    case Repo.get(Article, article_id) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, ErrorCat.resource_not_found()}
    end
  end

  defp parent_article(comment), do: FrontDesk.article_of(comment)

  defp transact_parent(community, %Article{thread: :doc} = article, branch_id, fun)
       when is_integer(branch_id) do
    Articles.MutationLock.transact_doc(community, article, branch_id, fun)
  end

  defp transact_parent(community, article, _branch_id, fun) do
    Articles.MutationLock.transact_article(community, article, fun)
  end
end
