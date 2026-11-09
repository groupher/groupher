defmodule GroupherServer.CMS.Review.Commands.ApplyResult do
  @moduledoc """
  Owns the internal transaction applying one current ReviewBot result.

      Review worker -> ApplyResult -> locked current request/target
        -> Review Restrictions + Ticket consequences + Wall -> atomic commit

  The request identity and applied marker provide retry idempotency. This is
  an internal worker command, not a user permission or transport entry point.
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.CMS

  @doc "Applies an opinion once while its review request is current."
  @spec execute(Ecto.UUID.t(), map()) :: {:ok, term()} | {:error, term()}
  def execute(request_id, opinion) do
    run_internal(request_id, opinion)
  end

  @pipeline operation: :cms_review_apply_result,
            access: :internal,
            target: :request_id,
            params: [:opinion]
  direct_pipeline run_internal(request_id, opinion) do
    change(fn _target -> CMS.Review.Results.apply_in_transaction(request_id, opinion) end)
  end
end
