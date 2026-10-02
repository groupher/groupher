defmodule GroupherServer.CMS.CommandReceipt.Key do
  @moduledoc """
  Validates the stable UUID identity for one CMS command attempt.

      direct command id
        -> Key.validate
        -> validated UUID, command_id_required or command_id_invalid
  """

  alias GroupherServer.CMS
  alias CMS.ErrorCat

  @doc """
  Validates a required command id without creating a replacement identity.
  """
  @spec validate(term()) :: {:ok, Ecto.UUID.t()} | {:error, term()}
  def validate(nil), do: {:error, ErrorCat.command_id_required()}

  def validate(key) when is_binary(key) do
    case Ecto.UUID.cast(key) do
      {:ok, uuid} -> {:ok, uuid}
      :error -> {:error, ErrorCat.command_id_invalid()}
    end
  end

  def validate(_id), do: {:error, ErrorCat.command_id_invalid()}
end
