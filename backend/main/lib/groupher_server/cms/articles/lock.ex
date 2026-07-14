defmodule GroupherServer.CMS.Articles.Lock do
  @moduledoc """
  Serializes every lifecycle mutation for one logical Article.

      community + thread + article_hash_id
                       |
                       v
              one advisory transaction lock
                       |
          +------------+-------------+
          |            |             |
        Draft        Publish       Preview
          |         Snapshot      fork/promote
          +------------+-------------+

  The lock deliberately does not include `branch_id`. Promote and fork cross
  branch boundaries, so a branch-local lock would allow autosave or Publish to
  change one side while the cross-branch operation is still in progress.
  Different logical Articles remain fully concurrent.
  """

  alias GroupherServer.CMS.Model.Community
  alias Helper.{T, Transaction}

  @doc "Runs an Article lifecycle mutation under its shared transaction lock."
  @spec run(Community.t(), T.thread(), Ecto.UUID.t(), (-> term())) ::
          {:ok, term()} | {:error, term()}
  def run(%Community{} = community, thread, article_hash_id, fun)
      when is_binary(article_hash_id) and is_function(fun, 0) do
    Transaction.lock_global(key(community, thread, article_hash_id), fun)
  end

  @doc "Runs a mutation under a deterministic set of logical Article locks."
  @spec run_many(Community.t(), T.thread(), [Ecto.UUID.t()], (-> term())) ::
          {:ok, term()} | {:error, term()}
  def run_many(%Community{} = community, thread, article_hash_ids, fun)
      when is_list(article_hash_ids) and is_function(fun, 0) do
    article_hash_ids
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
    |> Enum.sort()
    |> lock_many(community, thread, fun)
  end

  @doc "Returns the branch-independent lock key for one logical Article."
  @spec key(Community.t(), T.thread(), Ecto.UUID.t()) :: String.t()
  def key(%Community{} = community, thread, article_hash_id) do
    "article_lifecycle:#{community.id}:#{thread}:#{article_hash_id}"
  end

  defp lock_many([], _community, _thread, fun), do: fun.()

  defp lock_many([article_hash_id | rest], community, thread, fun) do
    run(community, thread, article_hash_id, fn ->
      lock_many(rest, community, thread, fun)
    end)
  end
end
