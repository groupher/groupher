defmodule GroupherServer.CMS.CommandReceipt.Key do
  @moduledoc """
  Resolves and validates the stable UUID identity for one CMS command attempt.

      direct command id
        -> Key
        -> validated UUID, command_id_required or command_id_invalid
  """

  alias GroupherServer.CMS
  alias CMS.ErrorCat


  @doc """
  Resolves a direct command id.

  A missing key is equivalent to `nil` and creates an internal one-shot key.
  A key that is present but invalid fails closed instead of being replaced.
  """
  @spec resolve(term()) :: {:ok, Ecto.UUID.t()} | {:error, term()}
  def resolve(nil), do: {:ok, Ecto.UUID.generate()}

  def resolve(key) when is_binary(key) do
    case Ecto.UUID.cast(key) do
      {:ok, uuid} -> {:ok, uuid}
      :error -> {:error, ErrorCat.command_id_invalid()}
    end
  end

  def resolve(_id), do: {:error, ErrorCat.command_id_invalid()}
end
