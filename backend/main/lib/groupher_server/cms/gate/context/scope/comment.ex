defmodule GroupherServer.CMS.Gate.Context.Scope.Comment do
  @moduledoc """
  Explicit thread-aware read intent for Comment queries.

  A normal thread may not carry a branch selector. Doc comments may select only
  the official main branch. `all_public/0` is the explicit cross-thread public
  query and is not inferred from an empty context.

      Reader -> Comment scope context -> Gate.scope -> Comment Scope query

  Examples:

      iex> %__MODULE__{thread: :post, policy_mode: :public} = for_thread(:post)
      iex> %__MODULE__{thread: :all, policy_mode: :public} = all_public()
  """

  @threads [:post, :blog, :changelog, :doc]
  @enforce_keys [:thread, :policy_mode]
  defstruct [:thread, :policy_mode, :branch_policy]

  @type t :: %__MODULE__{
          thread: atom(),
          policy_mode: :public | :owner_management | :moderator_management | :operations,
          branch_policy: :main | nil
        }

  @doc "Builds a thread-specific Comment read intent."
  def for_thread(thread, opts \\ []) when thread in @threads do
    branch_policy = Keyword.get(opts, :branch_policy)

    cond do
      thread != :doc and not is_nil(branch_policy) ->
        raise ArgumentError, "only Doc Comment scope accepts branch_policy"

      thread == :doc and not is_nil(branch_policy) and branch_policy != :main ->
        raise ArgumentError, "Doc Comment scope only accepts branch_policy: :main"

      thread == :doc and is_nil(branch_policy) ->
        raise ArgumentError, "Doc Comment scope requires branch_policy: :main"

      Keyword.get(opts, :policy_mode, :public) not in [
        :public,
        :owner_management,
        :moderator_management,
        :operations
      ] ->
        raise ArgumentError, "invalid Comment scope policy mode"

      true ->
        %__MODULE__{
          thread: thread,
          policy_mode: Keyword.get(opts, :policy_mode, :public),
          branch_policy: branch_policy
        }
    end
  end

  @doc "Builds the explicit cross-thread public Comment read intent."
  def all_public, do: %__MODULE__{thread: :all, policy_mode: :public}
end
