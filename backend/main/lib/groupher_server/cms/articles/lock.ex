defmodule GroupherServer.CMS.Articles.Lock do
  @moduledoc """
  Serializes lifecycle mutations at the correct Article scope.

      ordinary Article
        community + thread + article_hash_id
                         |
                         v
                one advisory transaction lock

      Doc Article
        community + branch_id + article_hash_id
                         |
                         v
                one branch-scoped advisory lock

  `Helper.Transaction` owns the generic PostgreSQL advisory-lock mechanism.
  This module owns the Article key contract: ordinary Articles stay on the
  thread-scoped key, while Doc operations must explicitly provide a branch.
  Cross-branch Doc operations acquire all affected branch keys in a stable
  order.

  lifecycle command -> scoped advisory key -> serialized Article mutation
  """

  alias GroupherServer.CMS.Model.Community
  alias Helper.{T, Transaction}

  @doc "Runs an ordinary Article lifecycle mutation under its shared transaction lock."
  @spec run(Community.t(), T.thread(), Ecto.UUID.t(), (-> term())) ::
          {:ok, term()} | {:error, term()}
  def run(%Community{}, :doc, _article_hash_id, _fun), do: {:error, :doc_branch_required}

  def run(%Community{} = community, thread, article_hash_id, fun)
      when is_binary(article_hash_id) and is_function(fun, 0) do
    Transaction.lock_global(key(community, thread, article_hash_id), fun)
  end

  @doc "Runs a Doc lifecycle mutation under its branch-scoped transaction lock."
  @spec run_doc(Community.t(), term(), Ecto.UUID.t(), (-> term())) ::
          {:ok, term()} | {:error, term()}
  def run_doc(%Community{} = community, branch_id, article_hash_id, fun)
      when is_binary(article_hash_id) and is_function(fun, 0) do
    Transaction.lock_global(doc_key(community, branch_id, article_hash_id), fun)
  end

  @doc "Runs several Doc Article mutations under one branch-scoped lock set."
  @spec run_doc_many(Community.t(), term(), [Ecto.UUID.t()], (-> term())) ::
          {:ok, term()} | {:error, term()}
  def run_doc_many(%Community{} = community, branch_id, article_hash_ids, fun)
      when is_list(article_hash_ids) and is_function(fun, 0) do
    article_hash_ids
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
    |> Enum.sort()
    |> Enum.map(&doc_key(community, branch_id, &1))
    |> lock_keys_in_order(fun)
  end

  @doc "Runs a cross-branch Doc mutation with deterministic lock ordering."
  @spec run_doc_across_branches(Community.t(), [term()], Ecto.UUID.t(), (-> term())) ::
          {:ok, term()} | {:error, term()}
  def run_doc_across_branches(%Community{} = community, branch_ids, article_hash_id, fun)
      when is_list(branch_ids) and is_binary(article_hash_id) and is_function(fun, 0) do
    branch_ids
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
    |> Enum.sort()
    |> Enum.map(&doc_key(community, &1, article_hash_id))
    |> lock_keys_in_order(fun)
  end

  @doc "Uses the correct lock key for an already-loaded Article row."
  @spec run_for_article(Community.t(), T.thread(), map(), (-> term())) ::
          {:ok, term()} | {:error, term()}
  def run_for_article(%Community{} = community, :doc, article, fun)
      when is_map(article) and is_function(fun, 0) do
    case Map.get(article, :branch_id) do
      nil -> {:error, :doc_branch_required}
      branch_id -> run_doc(community, branch_id, Map.fetch!(article, :article_hash_id), fun)
    end
  end

  def run_for_article(%Community{} = community, thread, article, fun)
      when is_map(article) and is_function(fun, 0) do
    run(community, thread, Map.fetch!(article, :article_hash_id), fun)
  end

  @doc "Runs a mutation under a deterministic set of logical Article locks."
  @spec run_many(Community.t(), T.thread(), [Ecto.UUID.t()], (-> term())) ::
          {:ok, term()} | {:error, term()}
  def run_many(%Community{}, :doc, _article_hash_ids, _fun),
    do: {:error, :doc_branch_required}

  def run_many(%Community{} = community, thread, article_hash_ids, fun)
      when is_list(article_hash_ids) and is_function(fun, 0) do
    article_hash_ids
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
    |> Enum.sort()
    |> Enum.map(&key(community, thread, &1))
    |> lock_keys_in_order(fun)
  end

  @doc "Returns the lock key for one ordinary Article."
  @spec key(Community.t(), T.thread(), Ecto.UUID.t()) :: String.t()
  def key(%Community{} = community, thread, article_hash_id) do
    "article_lifecycle:#{community.id}:#{thread}:#{article_hash_id}"
  end

  @doc "Returns the branch-scoped lock key for one Doc Article."
  @spec doc_key(Community.t(), term(), Ecto.UUID.t()) :: String.t()
  def doc_key(%Community{} = community, branch_id, article_hash_id) do
    "doc_article_lifecycle:#{community.id}:#{branch_id}:#{article_hash_id}"
  end

  defp lock_keys_in_order([], fun), do: fun.()

  defp lock_keys_in_order([lock_key | rest], fun) do
    Transaction.lock_global(lock_key, fn ->
      lock_keys_in_order(rest, fun)
    end)
  end
end
