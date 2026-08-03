defmodule GroupherServer.Analysis.Provider do
  @moduledoc """
  Provider boundary for built-in Web Analysis.

  Providers return a Groupher-owned DTO. Raw vendor response fields must not
  cross this boundary.
  """

  alias GroupherServer.Analysis.Community

  @callback summary(map(), Community.t(), map()) :: {:ok, map()} | {:error, term()}
end
