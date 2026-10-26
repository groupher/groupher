defmodule GroupherServer.Jobs.Workflow do
  @moduledoc """
  Application-facing facade for background jobs.

  Business modules should call this facade instead of `Oban.insert/2` directly.

  Business position:

      mutation transaction
        -> required named Jobs API
        -> Oban insert result participates in commit / rollback

      committed mutation or successful read
        -> enqueue_best_effort
        -> optional named Jobs API
        -> log safely on enqueue failure, preserve caller result
  """

  require Logger

  alias GroupherServer.Jobs
  alias Jobs.Config

  @type safe_resource_ref :: integer() | String.t() | atom() | nil

  @doc """
  Enqueues one typed Accounts event using only stable user ids.

  ## Examples

      Workflow.account_event(:follow, target_user_id, follower_id)
  """
  def account_event(type, target_user_id, actor_user_id) when type in [:follow, :undo_follow] do
    if Config.skip_enqueue?() do
      {:ok, :pass}
    else
      %{
        type: Atom.to_string(type),
        version: 1,
        user_id: target_user_id,
        from_user_id: actor_user_id
      }
      |> Jobs.AccountEvent.new()
      |> Oban.insert()
    end
  end

  @doc """
  Enqueues a typed Community contribution-cache rebuild.

  ## Examples

      Workflow.contribution_cache(community_id)
  """
  def contribution_cache(community_id) when is_integer(community_id) do
    if Config.skip_enqueue?() do
      {:ok, :pass}
    else
      %{type: "community_contribution_cache", version: 1, community_id: community_id}
      |> Jobs.ContributionCache.new()
      |> Oban.insert()
    end
  end

  @doc """
  Builds the Oban changeset for one PublicCache invalidation delivery.

  ## Examples

      Workflow.public_cache_purge_job(Ecto.UUID.generate())
  """
  @spec public_cache_purge_job(Ecto.UUID.t()) :: Ecto.Changeset.t()
  def public_cache_purge_job(invalidation_id) do
    Jobs.PublicCachePurge.new(%{invalidation_id: invalidation_id})
  end

  @doc """
  Enqueues an optional job without allowing enqueue failure to fail the
  completed business operation.

  The log contains only the finite job name, a caller-supplied safe resource
  reference, and a stable failure type. The callback result or exception is
  never inspected into logs.

  ## Examples

      Jobs.enqueue_best_effort(:optional_effect, comment.id, fn ->
        {:ok, :queued}
      end)

      #=> {:ok, :pass}
  """
  @spec enqueue_best_effort(atom(), safe_resource_ref(), (-> term())) :: {:ok, :pass}
  def enqueue_best_effort(job_name, resource_ref, enqueue)
      when is_atom(job_name) and
             (is_integer(resource_ref) or is_binary(resource_ref) or is_atom(resource_ref) or
                is_nil(resource_ref)) and is_function(enqueue, 0) do
    case enqueue.() do
      {:ok, _job} ->
        {:ok, :pass}

      {:error, _reason} ->
        log_best_effort_failure(job_name, resource_ref, :error_result)

      _other ->
        log_best_effort_failure(job_name, resource_ref, :unexpected_result)
    end
  rescue
    _exception ->
      log_best_effort_failure(job_name, resource_ref, :exception)
  catch
    :throw, _reason ->
      log_best_effort_failure(job_name, resource_ref, :throw)

    :exit, _reason ->
      log_best_effort_failure(job_name, resource_ref, :exit)
  end

  @doc """
  Enqueues mention reconciliation for one comment-like artiment.

  ## Examples

      Jobs.sync_mentions(comment)
      #=> {:ok, %Oban.Job{}} | {:ok, :pass} | {:error, reason}
  """
  @spec sync_mentions(struct()) :: {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def sync_mentions(%{id: id}), do: comments_job(:sync_mentions, %{comment_id: id})

  @doc """
  Enqueues community subscription after a successful comment mutation.

  ## Examples

      Jobs.subscribe_community(community, actor)
  """
  @spec subscribe_community(struct(), struct()) ::
          {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def subscribe_community(target, actor) do
    comments_job(:subscribe_community, %{community_id: target.id, actor_id: actor.id})
  end

  @doc """
  Enqueues repair of an article's persisted comment participant count.

  ## Examples

      Jobs.reconcile_comments_participants(:post, article_id, 12)
  """
  @spec reconcile_comments_participants(atom(), Ecto.UUID.t(), non_neg_integer()) ::
          {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def reconcile_comments_participants(thread, article_id, total_count)
      when is_atom(thread) and is_binary(article_id) and is_integer(total_count) and
             total_count >= 0 do
    comments_job(:reconcile_comments_participants, %{
      thread: thread,
      article_id: article_id,
      total_count: total_count
    })
  end

  @doc """
  Enqueues an artiment search-index update unless job insertion is disabled.

  ## Examples

      Jobs.search_index(:updated, :post, article_ref)
  """
  @spec search_index(atom(), atom(), term()) :: {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def search_index(action, thread, ref) when is_atom(action) and is_atom(thread) do
    if Config.skip_enqueue?() do
      {:ok, :pass}
    else
      %{action: Atom.to_string(action), thread: Atom.to_string(thread), ref: ref}
      |> Jobs.SearchIndex.new()
      |> Oban.insert()
    end
  end

  @doc """
  Enqueues a snapshot refresh for the supplied resource type and references.

  ## Examples

      Jobs.snapshot_refresh(:article, %{thread: :post, ids: [article_ref]}, [])
  """
  @spec snapshot_refresh(atom(), term(), keyword()) ::
          {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def snapshot_refresh(type, refs, opts) when is_atom(type) and is_list(opts) do
    if Config.skip_enqueue?() do
      {:ok, :pass}
    else
      %{
        type: Atom.to_string(type),
        version: 1,
        refs: snapshot_refs(type, refs),
        opts: Map.new(opts)
      }
      |> Jobs.SnapshotRefresh.new()
      |> Oban.insert()
    end
  end

  defp comments_job(type, payload) do
    if Config.skip_enqueue?() do
      {:ok, :pass}
    else
      %{type: Atom.to_string(type), version: 1, payload: payload}
      |> Jobs.Comments.new()
      |> Oban.insert()
    end
  end

  defp snapshot_refs(:user, ids) when is_list(ids), do: ids

  defp snapshot_refs(type, %{thread: thread, ids: ids}) when type in [:article, :comment] do
    %{thread: Atom.to_string(thread), ids: ids}
  end

  defp log_best_effort_failure(job_name, resource_ref, failure_type) do
    Logger.warning(
      "optional job enqueue failed job=#{job_name} resource_ref=#{resource_ref || "none"} failure=#{failure_type}"
    )

    {:ok, :pass}
  end

  @doc """
  Delegates GroupherServer.Jobs.Comments.new/1 through the Jobs Context boundary.

  ## Examples

      Workflow.comments_new(%{"type" => "sync_mentions", "version" => 1, "payload" => %{}})
  """
  defdelegate comments_new(arg1), to: GroupherServer.Jobs.Comments, as: :new

  @doc """
  Delegates GroupherServer.Jobs.Comments.new/2 through the Jobs Context boundary.

  ## Examples

      Workflow.comments_new(%{"type" => "sync_mentions"}, [queue: :default])
  """
  defdelegate comments_new(arg1, arg2), to: GroupherServer.Jobs.Comments, as: :new

  @doc """
  Delegates GroupherServer.Jobs.Config.skip_enqueue?/0 through the Jobs Context boundary.

  ## Examples

      Workflow.config_skip_enqueue?()
  """
  defdelegate config_skip_enqueue?(), to: GroupherServer.Jobs.Config, as: :skip_enqueue?

  @doc """
  Delegates GroupherServer.Jobs.PublicCachePurge.new/1 through the Jobs Context boundary.

  ## Examples

      Workflow.public_cache_purge_new(%{invalidation_id: Ecto.UUID.generate()})
  """
  defdelegate public_cache_purge_new(arg1), to: GroupherServer.Jobs.PublicCachePurge, as: :new

  @doc """
  Delegates GroupherServer.Jobs.PublicCachePurge.new/2 through the Jobs Context boundary.

  ## Examples

      Workflow.public_cache_purge_new(%{invalidation_id: Ecto.UUID.generate()}, [queue: :public_cache])
  """
  defdelegate public_cache_purge_new(arg1, arg2),
    to: GroupherServer.Jobs.PublicCachePurge,
    as: :new

  @doc """
  Delegates GroupherServer.Jobs.SearchIndex.new/1 through the Jobs Context boundary.

  ## Examples

      Workflow.search_index_new(%{action: "upsert_article", thread: "post", ref: Ecto.UUID.generate()})
  """
  defdelegate search_index_new(arg1), to: GroupherServer.Jobs.SearchIndex, as: :new

  @doc """
  Delegates GroupherServer.Jobs.SearchIndex.new/2 through the Jobs Context boundary.

  ## Examples

      Workflow.search_index_new(%{action: "upsert_article"}, [queue: :search])
  """
  defdelegate search_index_new(arg1, arg2), to: GroupherServer.Jobs.SearchIndex, as: :new

  @doc """
  Delegates GroupherServer.Jobs.SnapshotRefresh.new/1 through the Jobs Context boundary.

  ## Examples

      Workflow.snapshot_refresh_new(%{type: "article", version: 1, refs: %{}})
  """
  defdelegate snapshot_refresh_new(arg1), to: GroupherServer.Jobs.SnapshotRefresh, as: :new

  @doc """
  Delegates GroupherServer.Jobs.SnapshotRefresh.new/2 through the Jobs Context boundary.

  ## Examples

      Workflow.snapshot_refresh_new(%{type: "article"}, [queue: :snapshot])
  """
  defdelegate snapshot_refresh_new(arg1, arg2), to: GroupherServer.Jobs.SnapshotRefresh, as: :new
end
