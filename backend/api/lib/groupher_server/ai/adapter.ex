defmodule GroupherServer.AI.Adapter do
  @moduledoc """
  Provider boundary for one AI moderation request.

      AI.check -> Adapter -> configured judgment service -> strict OpinionOutput
  """
  alias GroupherServer.AI
  alias AI.{OpinionInput, OpinionOutput}

  @callback check(OpinionInput.t(), map()) :: {:ok, OpinionOutput.t()} | {:error, term()}
end
