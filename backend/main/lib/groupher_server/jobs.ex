defmodule GroupherServer.Jobs do
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

  alias GroupherServer.Jobs
  alias GroupherServer.Jobs.Codec
  alias GroupherServer.Jobs.Config

  require Logger

  @type later_job :: {module(), atom(), list()}
  @type safe_resource_ref :: integer() | String.t() | atom() | nil

  @doc """
  Enqueues an optional job without allowing enqueue failure to fail the
  completed business operation.

  The log contains only the finite job name, a caller-supplied safe resource
  reference, and a stable failure kind. The callback result or exception is
  never inspected into logs.

  ## Examples

      Jobs.enqueue_best_effort(:notify_comment, comment.id, fn ->
        Jobs.notify_comment(comment, actor)
      end)

      #=> :ok
  """
  @spec enqueue_best_effort(atom(), safe_resource_ref(), (-> term())) :: :ok
  def enqueue_best_effort(job_name, resource_ref, enqueue)
      when is_atom(job_name) and
             (is_integer(resource_ref) or is_binary(resource_ref) or is_atom(resource_ref) or
                is_nil(resource_ref)) and is_function(enqueue, 0) do
    case enqueue.() do
      {:ok, _job} ->
        :ok

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

  @doc "Enqueues a compatibility job that invokes the encoded module/function/arguments tuple."
  @spec later(later_job()) :: {:ok, :pass}
  def later({mod, func, args} = job) when is_atom(mod) and is_atom(func) and is_list(args) do
    if Config.skip_enqueue?() do
      {:ok, :pass}
    else
      %{job: Codec.encode(job)}
      |> Jobs.Later.new()
      |> insert_pass()
    end
  end

  @doc """
  Enqueues mention reconciliation for one comment-like artiment.

  ## Examples

      Jobs.sync_mentions(comment)
      #=> {:ok, %Oban.Job{}} | {:ok, :pass} | {:error, reason}
  """
  @spec sync_mentions(struct()) :: {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def sync_mentions(artiment), do: comments_job(:sync_mentions, %{artiment: artiment})

  @doc """
  Enqueues content audition for one comment-like artiment.

  ## Examples

      Jobs.audition(comment)
  """
  @spec audition(struct()) :: {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def audition(artiment), do: comments_job(:audition, %{artiment: artiment})

  @doc """
  Enqueues the notification produced by a new top-level comment.

  ## Examples

      Jobs.notify_comment(comment, actor)
  """
  @spec notify_comment(struct(), struct()) :: {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def notify_comment(comment, actor),
    do: comments_job(:notify_comment, %{comment: comment, from_user: actor})

  @doc """
  Enqueues the notification produced by a reply.

  ## Examples

      Jobs.notify_reply(reply_comment, actor)
  """
  @spec notify_reply(struct(), struct()) :: {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def notify_reply(reply_comment, actor),
    do: comments_job(:notify_reply, %{reply_comment: reply_comment, from_user: actor})

  @doc """
  Enqueues community subscription after a successful comment mutation.

  ## Examples

      Jobs.subscribe_community(community, actor)
  """
  @spec subscribe_community(struct(), struct()) ::
          {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def subscribe_community(target, actor),
    do: comments_job(:subscribe_community, %{target: target, user: actor})

  @doc """
  Enqueues repair of an article's persisted comment participant count.

  ## Examples

      Jobs.reconcile_comments_participants(article, 12)
  """
  @spec reconcile_comments_participants(struct(), non_neg_integer()) ::
          {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def reconcile_comments_participants(article, total_count) when is_integer(total_count) do
    comments_job(:reconcile_comments_participants, %{article: article, total_count: total_count})
  end

  @doc "Enqueues an artiment search-index update unless job insertion is disabled."
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

  @doc "Enqueues a snapshot refresh for the supplied resource kind and references."
  @spec snapshot_refresh(atom(), term(), keyword()) ::
          {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def snapshot_refresh(kind, refs, opts) when is_atom(kind) and is_list(opts) do
    if Config.skip_enqueue?() do
      {:ok, :pass}
    else
      %{kind: Atom.to_string(kind), refs: Codec.encode(refs), opts: Codec.encode(opts)}
      |> Jobs.SnapshotRefresh.new()
      |> Oban.insert()
    end
  end

  @doc "Enqueues a durable Artiment view projection by its idempotency key."
  @spec view_projection(Ecto.UUID.t()) :: {:ok, Oban.Job.t() | :pass} | {:error, term()}
  def view_projection(event_id) do
    if Config.skip_enqueue?() do
      {:ok, :pass}
    else
      %{event_id: event_id}
      |> Jobs.ViewProjection.new()
      |> Oban.insert()
    end
  end

  defp insert_pass(changeset) do
    case Oban.insert(changeset) do
      {:ok, _job} -> {:ok, :pass}
      {:error, _reason} -> {:ok, :pass}
    end
  rescue
    _ -> {:ok, :pass}
  end

  defp comments_job(kind, payload) do
    if Config.skip_enqueue?() do
      {:ok, :pass}
    else
      %{kind: Atom.to_string(kind), payload: Codec.encode(payload)}
      |> Jobs.Comments.new()
      |> Oban.insert()
    end
  end

  defp log_best_effort_failure(job_name, resource_ref, failure_kind) do
    Logger.warning(
      "optional job enqueue failed job=#{job_name} resource_ref=#{resource_ref || "none"} failure=#{failure_kind}"
    )

    :ok
  end
end
