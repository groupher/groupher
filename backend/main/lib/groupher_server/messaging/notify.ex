defmodule GroupherServer.Messaging.Notify do
  @moduledoc false

  @spec dispatch(atom(), map()) :: {:ok, :pass} | {:error, term()}
  def dispatch(event, payload) when is_atom(event) and is_map(payload) do
    _ = {event, payload}
    {:ok, :pass}
  end

  def dispatch(_, _), do: {:error, :invalid_notify_payload}
end
