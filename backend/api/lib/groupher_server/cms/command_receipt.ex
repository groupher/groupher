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

  @doc """
  Resolves an internal command id from a direct id.

  `nil` is intentionally allowed only for internal one-shot facades; transport
  callers must supply the id before reaching this boundary. Existing binary
  ids must be UUID-shaped so retries cannot silently become a different
  command identity. Invalid values fail closed.
  """
  @spec resolve_command_id(term()) :: {:ok, Ecto.UUID.t()} | {:error, term()}
  defdelegate resolve_command_id(value), to: Key, as: :resolve

  @doc "Runs the internal receipt protocol for a CMS command without exposing recovery state."
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
                target_type,
                target_key,
                data,
                execute,
                recovery
              ),
              to: Runner

  @doc "Runs the internal receipt protocol with a post-commit effect callback."
  @spec run_internal(
          User.t(),
          Ecto.UUID.t() | nil,
          String.t(),
          String.t(),
          String.t() | pos_integer(),
          term(),
          (-> term()),
          (CMS.Model.CommandReceipt.t() -> term()),
          (term() -> term())
        ) :: {:ok, term()} | {:error, term()}
  defdelegate run_internal(
                user,
                command_id,
                command,
                target_type,
                target_key,
                data,
                execute,
                recovery,
                after_commit
              ),
              to: Runner

  @doc "Deletes a bounded batch of receipts past the recovery window."
  @spec prune_expired(pos_integer()) :: non_neg_integer()
  def prune_expired(limit \\ 1_000), do: Store.prune_expired(limit)
end
