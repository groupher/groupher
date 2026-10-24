defmodule GroupherServer.CMS.Review do
  @moduledoc """
  Public boundary for canonical CMS review-target loading.

      ReviewBot Check target key
        -> CMS.Review facade
        -> locked Lifecycle target
  """
  alias GroupherServer.{CMS}

  alias CMS.Review.Target

  @doc "Loads and locks one canonical review target inside the caller transaction."
  @spec load_for_update(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  defdelegate load_for_update(target_key, scope_key), to: Target
end
