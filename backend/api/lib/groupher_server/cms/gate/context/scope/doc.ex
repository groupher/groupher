defmodule GroupherServer.CMS.Gate.Context.Scope.Doc do
  @moduledoc """
  Explicit site-owned read intent for Doc article queries.

      Query -> Doc scope context -> Gate.scope -> Doc Scope query

  Examples:

      iex> %__MODULE__{stage: :public} = public()
      iex> %__MODULE__{stage: :draft} = draft()
  """

  @modes [:public, :owner, :admin_management, :operations, :insights_management]
  @enforce_keys [:stage, :policy_mode]
  defstruct [
    :stage,
    :policy_mode,
    passport_granted_community_slugs: []
  ]

  @type t :: %__MODULE__{
          stage: :public | :draft,
          policy_mode: atom(),
          passport_granted_community_slugs: [String.t()]
        }

  @doc "Builds a public Doc read intent."
  def public(opts \\ []) do
    build(:public, Keyword.get(opts, :policy_mode, :public), opts)
  end

  @doc "Builds an owner-scoped default Doc workspace read intent."
  def draft(policy_mode \\ :owner, opts \\ []) do
    build(:draft, policy_mode, opts)
  end

  @doc "Builds the public Doc Insights read intent."
  def insights(opts \\ []), do: build(:public, :insights_management, opts)

  defp build(stage, policy_mode, opts) do
    unless policy_mode in @modes do
      raise ArgumentError, "invalid Doc scope policy mode"
    end

    if stage == :draft and policy_mode == :public do
      raise ArgumentError, "draft Doc scope requires a management policy mode"
    end

    %__MODULE__{
      stage: stage,
      policy_mode: policy_mode,
      passport_granted_community_slugs:
        opts
        |> Keyword.get(:passport_granted_community_slugs, [])
        |> Enum.filter(&is_binary/1)
        |> Enum.uniq()
    }
  end
end
