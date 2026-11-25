defmodule GroupherServer.Accounts.Profiles.ReportTarget do
  @moduledoc """
  Validates a user report target while the caller owns the transaction.

      AlertWall command -> Accounts report target -> current User
  """

  alias GroupherServer.{Accounts, Repo}
  alias Accounts.Model.User

  @doc "Validates an existing, non-self user target in the caller's transaction."
  def validate_in_transaction(target_id, reporter_id)
      when is_binary(target_id) and is_integer(reporter_id) do
    with true <- Repo.in_transaction?(),
         {id, ""} when id > 0 and id != reporter_id <- Integer.parse(target_id),
         %User{} <- Repo.get(User, id) do
      {:ok, :pass}
    else
      _ -> {:error, :invalid_report_target}
    end
  end

  def validate_in_transaction(_, _), do: {:error, :invalid_report_target}
end
