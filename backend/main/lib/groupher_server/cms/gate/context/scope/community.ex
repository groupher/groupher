defmodule GroupherServer.CMS.Gate.Context.Scope.Community do
  @moduledoc """
  Explicit read intent for Community queries.

  The constructor records the requested policy mode; the Community compiler
  still verifies the actor against that mode. It does not load or own a
  Community Lifecycle.

      Reader -> Community scope context -> Gate.scope -> Community compiler

  Examples:

      iex> %__MODULE__{policy_mode: :public} = public()
      iex> %__MODULE__{policy_mode: :owner_management} = owner_management()
  """

  @modes [:public, :owner_management, :moderator_management, :operations]
  @enforce_keys [:policy_mode]
  defstruct [:policy_mode]

  @type t :: %__MODULE__{policy_mode: atom()}

  @doc "Builds a public Community read intent."
  def public, do: %__MODULE__{policy_mode: :public}
  @doc "Builds an owner-management Community read intent."
  def owner_management, do: %__MODULE__{policy_mode: :owner_management}
  @doc "Builds a moderator-management Community read intent."
  def moderator_management, do: %__MODULE__{policy_mode: :moderator_management}
  @doc "Builds an operations Community read intent."
  def operations, do: %__MODULE__{policy_mode: :operations}

  @doc "Builds a Community read intent for a validated policy mode."
  def new(mode) when mode in @modes, do: %__MODULE__{policy_mode: mode}
  def new(_mode), do: raise(ArgumentError, "invalid Community scope policy mode")
end
