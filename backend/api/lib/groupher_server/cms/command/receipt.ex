defmodule GroupherServer.CMS.Command.Receipt do
  @moduledoc """
  Internal receipt boundary for command identity, execution, recovery and retention.

      CMS domain command / retention job
        -> Command.Receipt facade
        -> Key / Runner / Store
        -> cms.command_receipts

  Concrete commands continue to own Gate, Lifecycle, version checks and domain
  writes. This facade exposes only the shared receipt protocol used around them.
  """

  alias GroupherServer.{Accounts, CMS}
  alias Helper.T

  alias Accounts.Model.User
  alias CMS.Command
  alias __MODULE__.{Key, Runner, Store}

  @doc "Validates the required UUID identity of one command attempt."
  @spec validate_command_id(term()) :: {:ok, Ecto.UUID.t()} | {:error, term()}
  defdelegate validate_command_id(value), to: Key, as: :validate

  @doc "Executes the internal receipt protocol for a CMS command without exposing replay state."
  @spec execute(
          User.t(),
          Ecto.UUID.t() | nil,
          String.t(),
          String.t(),
          String.t() | pos_integer(),
          term(),
          (-> Command.action_result(term(), term())),
          module()
        ) :: T.result(term(), term())
  defdelegate execute(
                user,
                command_id,
                command,
                resource_type,
                resource_id,
                data,
                execute,
                confirmation
              ),
              to: Runner

  @doc "Executes with an optional presenter for first-execution result reuse."
  @spec execute(
          User.t(),
          Ecto.UUID.t() | nil,
          String.t(),
          String.t(),
          String.t() | pos_integer(),
          term(),
          (-> Command.action_result(term(), term())),
          module(),
          Command.presenter()
        ) :: T.result(term(), term())
  def execute(
        user,
        command_id,
        command,
        resource_type,
        resource_id,
        data,
        execute,
        confirmation,
        presenter
      )
      when is_function(presenter, 2) do
    Runner.execute(
      user,
      command_id,
      command,
      resource_type,
      resource_id,
      data,
      execute,
      confirmation,
      presenter
    )
  end

  @doc "Deletes a bounded batch of receipts past the recovery window."
  @spec prune_expired(pos_integer()) :: non_neg_integer()
  def prune_expired(limit \\ 1_000), do: Store.prune_expired(limit)
end
