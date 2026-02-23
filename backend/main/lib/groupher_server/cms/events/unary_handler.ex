defmodule GroupherServer.CMS.Events.UnaryHandler do
  @moduledoc """
  Callback contract for CMS event handlers with `handle/1`.
  """

  @callback handle(arg :: term()) :: {:ok, term()} | {:error, term()}
end
