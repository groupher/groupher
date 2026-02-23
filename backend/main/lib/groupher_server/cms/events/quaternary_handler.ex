defmodule GroupherServer.CMS.Events.QuaternaryHandler do
  @moduledoc """
  Callback contract for CMS event handlers with `handle/4`.
  """

  @callback handle(arg1 :: term(), arg2 :: term(), arg3 :: term(), arg4 :: term()) ::
              {:ok, term()} | {:error, term()}
end
