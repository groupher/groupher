defmodule GroupherServer.CMS.Review do
  @moduledoc """
  Public boundary for canonical CMS review-target loading.

      CMS review target key
        -> CMS.Review facade
        -> locked Lifecycle target
  """
  alias GroupherServer.CMS.Review.{Notice, Target}

  @doc "Loads and locks one canonical review target inside the caller transaction."
  @spec load_for_update(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  defdelegate load_for_update(target_key, scope_key), to: Target

  @doc "Returns the current review notice for the target's author."
  defdelegate notice_for_author(target, actor), to: Notice, as: :for_author

  @doc "Locks a CMS target and confirms that a report still refers to its observed public version."
  defdelegate validate_report_target_in_transaction(target), to: Target
end
