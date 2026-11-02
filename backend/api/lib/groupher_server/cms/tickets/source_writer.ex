defmodule GroupherServer.CMS.Tickets.SourceWriter do
  @moduledoc """
  Performs TicketSource deletion under the narrowly privileged database role.

      Authorized Ticket/Post command
        -> existing Repo transaction
        -> SET LOCAL ROLE cms_ticket_write for one DELETE
        -> reset role before Activity and Outbox writes
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Tickets.Model.Source

  @doc "Deletes one already-authorized source using the caller's current transaction."
  @spec delete(Source.t()) :: {:ok, Source.t()} | {:error, term()}
  def delete(%Source{} = source) do
    if Repo.in_transaction?() do
      with {:ok, _result} <- Repo.query("SET LOCAL ROLE cms_ticket_write") do
        result = Repo.delete(source)

        case Repo.query("RESET ROLE") do
          {:ok, _reset} -> result
          {:error, reason} -> {:error, reason}
        end
      end
    else
      {:error, CMS.Tickets.ErrorCat.invalid_ticket_content()}
    end
  end
end
