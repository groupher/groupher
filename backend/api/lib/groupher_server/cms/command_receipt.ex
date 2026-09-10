defmodule GroupherServer.CMS.CommandReceipt do
  @moduledoc """
  Public CMS boundary for command identity, execution, replay and retention.

      CMS domain command / retention job
        -> CommandReceipt facade
        -> Key / Runner / Store
        -> cms.command_receipts

  Concrete commands continue to own Gate, Lifecycle, version checks and domain
  writes. This facade exposes only the shared receipt protocol used around them.
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.CommandReceipt.{Key, Runner, Store}
  alias GroupherServer.CMS.Model.CommandReceipt, as: CommandReceiptModel

  @doc """
  Resolves an internal command key from a direct key or option containers.

  `nil` is intentionally allowed only for internal one-shot facades; transport
  callers must supply the key before reaching this boundary. Existing binary
  keys must be UUID-shaped so retries cannot silently become a different
  command identity. Invalid values fail closed.
  """
  @spec resolve_command_key(term()) :: {:ok, Ecto.UUID.t()} | {:error, term()}
  defdelegate resolve_command_key(value), to: Key, as: :resolve

  @doc "Resolves a primary option container, falling back to a secondary one."
  @spec resolve_command_key(term(), term()) :: {:ok, Ecto.UUID.t()} | {:error, term()}
  defdelegate resolve_command_key(primary, fallback), to: Key, as: :resolve

  @doc "Runs one user command behind the shared receipt boundary."
  @spec run_user_command(
          User.t(),
          Ecto.UUID.t() | nil,
          String.t(),
          String.t(),
          String.t() | pos_integer(),
          term(),
          (-> term()),
          (CommandReceiptModel.t() -> term())
        ) :: {:ok, term()} | {:error, term()}
  defdelegate run_user_command(
                user,
                command_key,
                command_name,
                target_type,
                target_key,
                data,
                execute,
                replay
              ),
              to: Runner

  @doc "Deletes a bounded batch of receipts past the replay window."
  @spec prune_expired(pos_integer()) :: non_neg_integer()
  def prune_expired(limit \\ 1_000), do: Store.prune_expired(limit)
end
