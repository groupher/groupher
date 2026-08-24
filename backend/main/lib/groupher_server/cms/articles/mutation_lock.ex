defmodule GroupherServer.CMS.Articles.MutationLock do
  @moduledoc """
  Serializes commands that mutate the same logical Article aggregate.

      ordinary Article: community + thread + article_hash_id
      Doc Article:      community + branch_id + article_hash_id
                                  |
                                  v
                    advisory transaction lock

  MutationLock owns only lock identity and deterministic acquisition order. It
  does not load resources, authorize actors, transition Lifecycle, or write
  business data.

      Legacy mutation
        -> with_article -> Transaction.lock_global -> callback

      Aggregate command
        -> transact_article -> Repo.transact
             -> advisory lock -> callback -> commit / rollback
  """

  alias GroupherServer.CMS.Artiment.Matcher
  alias GroupherServer.CMS.Gate.ErrorCat
  alias GroupherServer.CMS.Interactions.ErrorCat, as: InteractionErrorCat
  alias GroupherServer.CMS.Model.Community
  alias GroupherServer.Repo
  alias Helper.{T, Transaction}

  @article_threads GroupherServer.CMS.Artiment.Config.threads() -- [:doc]

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

      if is_nil(previous),
        do: Process.delete(@observer_key),
        else: Process.put(@observer_key, previous)

      Enum.each(observations, fn {acquired_at, metadata} ->
        emit_hold(completed_at - acquired_at, metadata)
      end)
    end
  end

  @doc "Uses an already-loaded Article struct to select its aggregate lock identity."
  @spec with_article(Community.t(), struct(), (-> term())) ::
          {:ok, term()} | {:error, term()}
  def with_article(%Community{} = community, article, fun)
      when is_struct(article) and is_function(fun, 0) do
    case Matcher.match_interaction(article) do
      {:ok, %{artiment: :doc}} ->
        case Map.get(article, :branch_id) do
          nil -> {:error, ErrorCat.doc_branch_required()}
          branch_id -> with_article(community, :doc, branch_id, article.article_hash_id, fun)
        end

      {:ok, %{artiment: thread}} when thread in @article_threads ->
        with_article(community, thread, article.article_hash_id, fun)

      _ ->
        {:error, InteractionErrorCat.unsupported_artiment()}
    end
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
  def transact_article(%Community{} = community, article, fun)
      when is_struct(article) and is_function(fun, 0) do
    case Matcher.match_interaction(article) do
      {:ok, %{artiment: :doc}} ->
        case Map.get(article, :branch_id) do
          nil -> {:error, ErrorCat.doc_branch_required()}
          branch_id -> transact_lock(doc_key(community, branch_id, article.article_hash_id), fun)
        end

      {:ok, %{artiment: thread}} when thread in @article_threads ->
        transact_lock(key(community, thread, article.article_hash_id), fun)

      _ ->
        {:error, InteractionErrorCat.unsupported_artiment()}
    end
  end

  @doc "Locks one ordinary Article by its stable logical identity."
  @spec with_article(Community.t(), T.thread(), Ecto.UUID.t(), (-> term())) ::
          {:ok, term()} | {:error, term()}
  def with_article(%Community{}, :doc, _article_hash_id, _fun),
    do: {:error, ErrorCat.doc_branch_required()}

  def with_article(%Community{} = community, thread, article_hash_id, fun)
      when thread in @article_threads and is_binary(article_hash_id) and
             is_function(fun, 0) do
    lock(key(community, thread, article_hash_id), fun)
  end

  @doc "Locks one Doc Article in one branch or across a deterministic branch set."
  @spec with_article(Community.t(), :doc, term() | [term()], Ecto.UUID.t(), (-> term())) ::
          {:ok, term()} | {:error, term()}
  def with_article(%Community{} = community, :doc, branch_ids, article_hash_id, fun)
      when is_list(branch_ids) and is_binary(article_hash_id) and is_function(fun, 0) do
    branch_ids
    |> clean_identities()
    |> Enum.map(&doc_key(community, &1, article_hash_id))
    |> lock_keys_in_order(fun)
  end

  def with_article(%Community{} = community, :doc, branch_id, article_hash_id, fun)
      when is_binary(article_hash_id) and is_function(fun, 0) do
    lock(doc_key(community, branch_id, article_hash_id), fun)
  end

  @doc "Locks several ordinary Articles using stable key ordering."
  @spec with_articles(Community.t(), T.thread(), [Ecto.UUID.t()], (-> term())) ::
          {:ok, term()} | {:error, term()}
  def with_articles(%Community{}, :doc, _article_hash_ids, _fun),
    do: {:error, ErrorCat.doc_branch_required()}

  def with_articles(%Community{} = community, thread, article_hash_ids, fun)
      when thread in @article_threads and is_list(article_hash_ids) and
             is_function(fun, 0) do
    article_hash_ids
    |> clean_identities()
    |> Enum.map(&key(community, thread, &1))
    |> lock_keys_in_order(fun)
  end

  @doc "Locks several Doc Articles within one branch using stable key ordering."
  @spec with_articles(Community.t(), :doc, term(), [Ecto.UUID.t()], (-> term())) ::
          {:ok, term()} | {:error, term()}
  def with_articles(%Community{} = community, :doc, branch_id, article_hash_ids, fun)
      when is_list(article_hash_ids) and is_function(fun, 0) do
    article_hash_ids
    |> clean_identities()
    |> Enum.map(&doc_key(community, branch_id, &1))
    |> lock_keys_in_order(fun)
  end

  @doc "Returns the logical lock key for one ordinary Article."
  @spec key(Community.t(), T.thread(), Ecto.UUID.t()) :: String.t()
  def key(%Community{} = community, thread, article_hash_id) do
    "article_lifecycle:#{community.id}:#{thread}:#{article_hash_id}"
  end

  @doc "Returns the branch-scoped logical lock key for one Doc Article."
  @spec doc_key(Community.t(), term(), Ecto.UUID.t()) :: String.t()
  def doc_key(%Community{} = community, branch_id, article_hash_id) do
    "doc_article_lifecycle:#{community.id}:#{branch_id}:#{article_hash_id}"
  end

  defp clean_identities(identities) do
    identities
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
    |> Enum.sort()
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
  defp transact_lock(lock_key, fun) do
    started_at = System.monotonic_time()
    metadata = lock_metadata(lock_key)
    key = normalize_lock_key(lock_key)

    Repo.transact(fn ->
      Repo.query!("SELECT pg_advisory_xact_lock($1)", [key])
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

  defp normalize_lock_key(lock_key) when is_binary(lock_key) do
    <<key::signed-64, _::binary>> = :crypto.hash(:sha256, lock_key)
    key
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
