defmodule GroupherServer.CMS.Gate.Access do
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

  alias GroupherServer.{CMS, Repo}

  alias CMS.Gate.Access.Check
  alias CMS.Gate.Access.Policy.Application, as: ApplicationPolicy
  alias CMS.Gate.{Decision, ErrorCat}
  alias CMS.{Articles, FrontDesk}
  alias CMS.Model.{Article, Comment, Community}
  alias CMS.Model.CommunityApplication

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
    {:error, :article_binding_context_required}
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
    {:error, :article_binding_context_required}
  end

  def with_check(
        actor,
        action,
        %{id: article_id, thread: :doc, branch_id: branch_id},
        callback
      )
      when is_binary(article_id) and is_integer(branch_id) and is_function(callback, 1) do
    _ = {actor, action, article_id, branch_id, callback}
    {:error, :article_binding_context_required}
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

  @doc "Runs the create admission for a new Community Application."
  def with_application_create_check(actor, callback) when is_function(callback, 0) do
    Repo.transact(fn ->
      with {:ok, :pass} <- ApplicationPolicy.check_create(actor) do
        callback.()
      end
    end)
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
