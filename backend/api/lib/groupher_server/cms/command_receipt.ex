defmodule GroupherServer.CMS.CommandReceipt do
  @moduledoc """
  Internal receipt boundary for command identity, execution, recovery and retention.

      CMS domain command / retention job
        -> CommandReceipt facade
        -> Key / Runner / Store
        -> cms.command_receipts

  Concrete commands continue to own Gate, Lifecycle, version checks and domain
  writes. This facade exposes only the shared receipt protocol used around them.
  """

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.CommandReceipt.{Key, Runner, Store}

  @doc "Validates the required UUID identity of one command attempt."
  @spec validate_command_id(term()) :: {:ok, Ecto.UUID.t()} | {:error, term()}
  defdelegate validate_command_id(value), to: Key, as: :validate

  @doc "Runs the internal receipt protocol for a CMS command without exposing replay state."
  @spec run_internal(
          User.t(),
          Ecto.UUID.t() | nil,
          String.t(),
          String.t(),
          String.t() | pos_integer(),
          term(),
          (-> term()),
          (CMS.Model.CommandReceipt.t() -> term())
        ) :: {:ok, term()} | {:error, term()}
  defdelegate run_internal(
                user,
                command_id,
                command,
                resource_type,
                resource_id,
                data,
                execute,
                result
              ),
              to: Runner

  @doc "Deletes a bounded batch of receipts past the recovery window."
  @spec prune_expired(pos_integer()) :: non_neg_integer()
  def prune_expired(limit \\ 1_000), do: Store.prune_expired(limit)
end
