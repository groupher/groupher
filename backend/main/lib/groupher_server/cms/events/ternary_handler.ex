defmodule GroupherServer.CMS.Events.TernaryHandler do
  @moduledoc """
  Callback contract for CMS event handlers with `handle/3`.
  """

  @callback handle(arg1 :: term(), arg2 :: term(), arg3 :: term()) :: {:ok, term()} | {:error, term()}
end
