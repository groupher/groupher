defmodule GroupherServer.CMS.Articles.MutationLock do
  @moduledoc """
  Serializes commands that mutate the same logical Article aggregate.

      ordinary Article: article_id (shared across all Community bindings)
      Doc Article:      community + article_id
                                  |
                                  v
                    advisory transaction lock

  MutationLock owns only lock identity and deterministic acquisition order. It
  does not load resources, authorize actors, transition Lifecycle, or write
  business data.

      Aggregate command
        -> transact_article -> Repo.transact
             -> advisory lock -> callback -> commit / rollback
  """

  import Ecto.Query, except: [lock: 2]

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{Article, Community}
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias Helper.{T, Transaction}
  alias Helper.ORM.AdvisoryLock

  @article_threads CMS.Artiment.Config.threads() -- [:doc]

  @observer_key {__MODULE__, :transaction_observer}

  @doc """
  Runs a callback while collecting lock-hold telemetry for its transaction.

  This is an internal observability helper and does not acquire a lock itself.

  ## Examples

      MutationLock.observe_transaction(fn -> command.() end)
  """
  @spec observe_transaction((-> term())) :: term()
  def observe_transaction(fun) when is_function(fun, 0) do
    previous = Process.get(@observer_key)
    Process.put(@observer_key, [])

    try do
      fun.()
    after
      completed_at = System.monotonic_time()
      observations = Process.get(@observer_key, [])

      if is_nil(previous) do
        Process.delete(@observer_key)
      else
        Process.put(@observer_key, previous)
      end

      Enum.each(observations, fn {acquired_at, metadata} ->
        emit_hold(completed_at - acquired_at, metadata)
      end)
    end
  end

  @doc "Locks current binding Communities and explicit entry Communities in stable order."
  def lock_community_plan(article_ids, entry_ids)
      when is_list(article_ids) and is_list(entry_ids) do
    if Repo.in_transaction?() do
      do_lock_community_plan(article_ids, entry_ids)
    else
      {:error, :transaction_required}
    end
  end

  defp do_lock_community_plan(article_ids, entry_ids) do
    bindings = binding_community_ids(article_ids)
    ids = Enum.sort(Enum.uniq(Enum.map(bindings, &elem(&1, 1)) ++ entry_ids))

    locked =
      Repo.all(
        from(lifecycle in CMS.Model.CommunityLifecycle,
          where: lifecycle.community_id in ^ids,
          order_by: lifecycle.community_id,
          lock: "FOR SHARE",
          select: lifecycle.community_id
        )
      )

    if locked == ids do
      {:ok, %{article_ids: article_ids, binding_ids: bindings, transaction_id: transaction_id()}}
    else
      {:error, :community_admission_missing}
    end
  end

  @doc "Locks the planned Article rows in stable order before validating the Binding set."
  def lock_article_rows(article_ids) when is_list(article_ids) do
    if Repo.in_transaction?() do
      do_lock_article_rows(article_ids)
    else
      {:error, :transaction_required}
    end
  end

  defp do_lock_article_rows(article_ids) do
    ids = article_ids |> Enum.uniq() |> Enum.sort()

    locked =
      Repo.all(
        from(article in Article,
          where: article.id in ^ids,
          order_by: article.id,
          lock: "FOR UPDATE",
          select: article.id
        )
      )

    if locked == ids, do: {:ok, :pass}, else: {:error, :article_not_found}
  end

  @doc "Rejects a changed Binding set after Article serialization; callers must retry the transaction."
  def verify_community_plan(%{
        article_ids: ids,
        binding_ids: expected,
        transaction_id: transaction_id
      }) do
    cond do
      not Repo.in_transaction?() ->
        {:error, :transaction_required}

      transaction_id != transaction_id() ->
        {:error, :invalid_lock_plan}

      binding_community_ids(ids) != expected ->
        {:error, GateErrorCat.community_admission_changed()}

      true ->
        {:ok, :pass}
    end
  end

  defp transaction_id do
    %{rows: [[id]]} = Repo.query!("SELECT txid_current()")
    id
  end

  defp binding_community_ids(article_ids) do
    Repo.all(
      from(binding in CMS.Model.ArticleBinding,
        where: binding.article_id in ^article_ids,
        distinct: true,
        order_by: [asc: binding.article_id, asc: binding.community_id],
        select: {binding.article_id, binding.community_id}
      )
    )
  end

  @doc "Locks all binding Communities before a global Article mutation acquires its Article lock."
  def lock_community_admission(article_id) do
    with {:ok, plan} <- lock_community_plan([article_id], []),
         {:ok, :pass} <- lock_article_rows([article_id]),
         {:ok, :pass} <- verify_community_plan(plan) do
      {:ok, :pass}
    end
  end

  @doc "Uses an already-loaded Article struct to select its aggregate lock identity."
  @spec with_article(Community.t(), struct(), (-> term())) ::
          {:ok, term()} | {:error, term()}
  def with_article(%Community{} = community, %Article{thread: thread, id: article_id}, fun)
      when thread in @article_threads and is_function(fun, 0) do
    ordered_lock(community, [article_id], [key(community, thread, article_id)], fun)
  end

  def with_article(%Community{} = community, %Article{thread: :doc, id: article_id}, fun)
      when is_function(fun, 0) do
    ordered_lock(community, [article_id], [key(community, :doc, article_id)], fun)
  end

  @doc """
  Starts the strict aggregate transaction used by canonical commands.

  The advisory transaction lock is acquired after `Repo.transact/2` starts.
  The callback must return `{:ok, result}` or `{:error, reason}`.

  ## Examples

      MutationLock.transact_article(community, article, fn ->
        {:ok, result}
      end)
  """
  @spec transact_article(Community.t(), struct(), (-> {:ok, term()} | {:error, term()})) ::
          {:ok, term()} | {:error, term()}
  def transact_article(%Community{} = community, %Article{thread: thread, id: article_id}, fun)
      when thread in @article_threads and is_function(fun, 0) do
    transact_lock(community, article_id, key(community, thread, article_id), fun)
  end

  def transact_article(%Community{} = community, %Article{thread: :doc, id: article_id}, fun)
      when is_function(fun, 0) do
    transact_lock(community, article_id, key(community, :doc, article_id), fun)
  end

  @doc "Locks one ordinary Article by its stable logical identity."
  @spec with_article(Community.t(), T.thread(), Ecto.UUID.t(), (-> term())) ::
          {:ok, term()} | {:error, term()}
  def with_article(%Community{} = community, thread, article_id, fun)
      when thread in [:doc | @article_threads] and is_binary(article_id) and
             is_function(fun, 0) do
    ordered_lock(community, [article_id], [key(community, thread, article_id)], fun)
  end

  @doc "Locks several ordinary Articles using stable key ordering."
  @spec with_articles(Community.t(), T.thread(), [Ecto.UUID.t()], (-> term())) ::
          {:ok, term()} | {:error, term()}
  def with_articles(%Community{} = community, thread, article_ids, fun)
      when thread in [:doc | @article_threads] and is_list(article_ids) and
             is_function(fun, 0) do
    article_ids = clean_identities(article_ids)
    keys = Enum.map(article_ids, &key(community, thread, &1))
    ordered_lock(community, article_ids, keys, fun)
  end

  @doc "Returns the logical lock key for one ordinary Article."
  @spec key(Community.t(), T.thread(), Ecto.UUID.t()) :: String.t()
  def key(%Community{}, thread, article_id) when thread in @article_threads do
    "article_lifecycle:#{article_id}"
  end

  def key(%Community{} = community, thread, article_id) do
    "article_lifecycle:#{community.id}:#{thread}:#{article_id}"
  end

  defp clean_identities(identities) do
    identities
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
    |> Enum.sort()
  end

  defp ordered_lock(community, article_ids, keys, fun) do
    Repo.transaction(fn ->
      with {:ok, plan} <- lock_community_plan(article_ids, [community.id]),
           {:ok, result} <-
             lock_keys_in_order(keys, fn ->
               with {:ok, :pass} <- lock_article_rows(article_ids),
                    {:ok, :pass} <- verify_community_plan(plan) do
                 fun.()
               end
             end) do
        result
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp lock_keys_in_order([], fun), do: fun.()

  defp lock_keys_in_order([lock_key | rest], fun) do
    lock(lock_key, fn -> lock_keys_in_order(rest, fun) end)
  end

  defp lock(lock_key, fun) do
    started_at = System.monotonic_time()
    metadata = lock_metadata(lock_key)

    Transaction.lock_global(lock_key, fn ->
      acquired_at = System.monotonic_time()

      :telemetry.execute(
        [:groupher, :cms, :articles, :mutation_lock, :wait],
        %{duration: acquired_at - started_at},
        metadata
      )

      try do
        fun.()
      after
        observe_hold(acquired_at, metadata)
      end
    end)
  end

  # This strict transaction entry is intentionally private to aggregate
  # commands. The advisory xact lock is acquired after Repo.transact/2 starts,
  # so authorization and writes use the same checked-out connection.
  defp transact_lock(community, article_id, lock_key, fun) do
    started_at = System.monotonic_time()
    metadata = lock_metadata(lock_key)

    Repo.transact(fn ->
      with {:ok, plan} <- lock_community_plan([article_id], [community.id]),
           {:ok, :acquired} <- AdvisoryLock.acquire!(lock_key),
           {:ok, :pass} <- lock_article_rows([article_id]),
           {:ok, :pass} <- verify_community_plan(plan) do
        transact_locked(lock_key, fun, started_at, metadata)
      end
    end)
  end

  defp transact_locked(_lock_key, fun, started_at, metadata) do
    acquired_at = System.monotonic_time()

    :telemetry.execute(
      [:groupher, :cms, :articles, :mutation_lock, :wait],
      %{duration: acquired_at - started_at},
      metadata
    )

    try do
      fun.()
    after
      observe_hold(acquired_at, metadata)
    end
  end

  defp observe_hold(acquired_at, metadata) do
    case Process.get(@observer_key) do
      observations when is_list(observations) ->
        Process.put(@observer_key, [{acquired_at, metadata} | observations])

      _ ->
        emit_hold(System.monotonic_time() - acquired_at, metadata)
    end
  end

  defp emit_hold(duration, metadata) do
    :telemetry.execute(
      [:groupher, :cms, :articles, :mutation_lock, :hold],
      %{duration: duration},
      metadata
    )
  end

  defp lock_metadata(lock_key) do
    scope = if String.starts_with?(lock_key, "doc_article_lifecycle:"), do: :doc, else: :article
    %{aggregate: scope, lock_key_hash: :erlang.phash2(lock_key)}
  end
end
