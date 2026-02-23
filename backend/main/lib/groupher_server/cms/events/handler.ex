defmodule GroupherServer.CMS.Events.Handler do
  @moduledoc """
  Callback contract for CMS event handlers.
  """

  alias GroupherServer.CMS.Events.Event

  @callback handle(Event.t()) :: {:ok, term()} | {:error, term()}
end
