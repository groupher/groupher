defmodule GroupherServer.CMS.Review do
  @moduledoc """
  Public boundary for CMS review-target reads and internal result application.

      CMS review target key
        -> CMS.Review facade
        -> locked Lifecycle target / internal ApplyResult command
  """
  alias GroupherServer.CMS
  alias CMS.Review.{Notice, Target}

  @doc "Applies a trusted worker opinion through the internal transaction-owning Command."
  defdelegate apply_result_internal(request_id, opinion),
    to: CMS.Review.Commands.ApplyResult,
    as: :execute

  @doc "Loads and locks one canonical review target inside the caller transaction."
  @spec load_for_update(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  defdelegate load_for_update(target_key, scope_key), to: Target

  @doc "Returns the current review notice for the target's author."
  defdelegate notice_for_author(target, actor), to: Notice, as: :for_author

  @doc "Locks a CMS target and confirms that a report still refers to its observed public version."
  defdelegate validate_report_target_in_transaction(target), to: Target
end
