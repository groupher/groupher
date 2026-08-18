defmodule GroupherServer.CMS.Events.Handler do
  @moduledoc """
  Callback contract for CMS event handlers.

  Business position:

      Domain write
        -> CMS.Events
        -> Handler
        -> bounded side effect
  """

  alias GroupherServer.CMS.Events.Event

  @callback handle(Event.t()) :: {:ok, term()} | {:error, term()}
end
