defmodule GroupherServer.CMS.Gate.Context.Scope.Doc do
  @moduledoc """
  Explicit branch-aware read intent for Doc article queries.

  `branch_id` and `branch_policy: :main` are mutually exclusive. Public reads
  use the main policy; draft and editor reads name a concrete branch.

      Reader -> Doc scope context -> Gate.scope -> Doc Scope query

  Examples:

      iex> %__MODULE__{stage: :public, branch_policy: :main} = public_main()
      iex> %__MODULE__{stage: :draft, branch_id: 42} = draft(42)
  """

  @modes [:public, :owner_management, :moderator_management, :operations]
  @enforce_keys [:stage, :policy_mode]
  defstruct [:stage, :policy_mode, :branch_id, :branch_policy, include_illegal: false]

  @type t :: %__MODULE__{
          stage: :public | :draft,
          policy_mode: atom(),
          branch_id: integer() | nil,
          branch_policy: :main | nil,
          include_illegal: boolean()
        }

  @doc "Builds a public Doc read intent for the official main branch."
  def public_main(opts \\ []),
    do: build(:public, Keyword.get(opts, :policy_mode, :public), nil, :main, opts)

  @doc "Builds a public Doc read intent for a concrete branch."
  def public_branch(branch_id, opts \\ []),
    do: build(:public, Keyword.get(opts, :policy_mode, :public), branch_id, nil, opts)

  @doc "Builds a management-scoped draft Doc read intent for a branch."
  def draft(branch_id, policy_mode \\ :owner_management, opts \\ []) do
    build(:draft, policy_mode, branch_id, nil, opts)
  end

  defp build(stage, policy_mode, branch_id, branch_policy, opts) do
    unless policy_mode in @modes do
      raise ArgumentError, "invalid Doc scope policy mode"
    end

    if is_nil(branch_id) == is_nil(branch_policy) do
      raise ArgumentError, "Doc scope requires exactly one branch selector"
    end

    if stage == :draft and policy_mode == :public do
      raise ArgumentError, "draft Doc scope requires a management policy mode"
    end

    %__MODULE__{
      stage: stage,
      policy_mode: policy_mode,
      branch_id: branch_id,
      branch_policy: branch_policy,
      include_illegal: Keyword.get(opts, :include_illegal, false)
    }
  end
end
