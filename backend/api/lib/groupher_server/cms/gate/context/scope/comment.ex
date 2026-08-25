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

  alias GroupherServer.CMS.Gate.Config

  @threads Config.article_threads()
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
    policy_mode = Keyword.get(opts, :policy_mode, :public)

    cond do
      not valid_branch_policy?(thread, branch_policy) ->
        raise_branch_policy_error(thread, branch_policy)

      not valid_policy_mode?(policy_mode) ->
        raise ArgumentError, "invalid Comment scope policy mode"

      true ->
        %__MODULE__{
          thread: thread,
          policy_mode: policy_mode,
          branch_policy: branch_policy
        }
    end
  end

  defp valid_branch_policy?(:doc, :main), do: true
  defp valid_branch_policy?(:doc, nil), do: false
  defp valid_branch_policy?(:doc, _branch_policy), do: false
  defp valid_branch_policy?(_thread, nil), do: true
  defp valid_branch_policy?(_thread, _branch_policy), do: false

  defp raise_branch_policy_error(:doc, nil),
    do: raise(ArgumentError, "Doc Comment scope requires branch_policy: :main")

  defp raise_branch_policy_error(:doc, _branch_policy),
    do: raise(ArgumentError, "Doc Comment scope only accepts branch_policy: :main")

  defp raise_branch_policy_error(_thread, _branch_policy),
    do: raise(ArgumentError, "only Doc Comment scope accepts branch_policy")

  defp valid_policy_mode?(mode),
    do: mode in [:public, :owner_management, :moderator_management, :operations]

  @doc "Builds the explicit cross-thread public Comment read intent."
  def all_public, do: %__MODULE__{thread: :all, policy_mode: :public}
end
