defmodule GroupherServer.Messaging.Notify do
  @moduledoc """
  Placeholder dispatch boundary for future async notification delivery.

  Today the function validates the event shape and returns `{:ok, :pass}`.
  Keeping the boundary explicit lets callers depend on a stable notification
  dispatch API while delivery channels are added later.
  """

  @spec dispatch(atom(), map()) :: {:ok, :pass} | {:error, term()}
  def dispatch(event, payload) when is_atom(event) and is_map(payload) do
    _ = {event, payload}
    {:ok, :pass}
  end

  def dispatch(_, _), do: {:error, :invalid_notify_payload}
end
