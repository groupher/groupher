defmodule GroupherServer.CMS.Events.BinaryHandler do
  @moduledoc """
  Callback contract for CMS event handlers with `handle/2`.
  """

  @callback handle(arg1 :: term(), arg2 :: term()) :: {:ok, term()} | {:error, term()}
end
