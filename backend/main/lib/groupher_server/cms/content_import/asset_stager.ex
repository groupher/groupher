defmodule GroupherServer.CMS.ContentImport.AssetStager do
  @moduledoc """
  Per-asset staging contract. The Job orchestrator owns batching, bounded
  concurrency, retries and persistence; implementations only stage one claimed
  asset and return a terminal Plan.Asset.
  """

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Plan}

  @type context :: %{
          required(:job_ref) => String.t(),
          optional(:connection) => map()
        }

  @callback stage(Plan.Asset.t(), context(), keyword()) ::
              {:ok, Plan.Asset.t()} | {:error, Diagnostic.t()}

  @spec valid_result?(Plan.Asset.t()) :: boolean()
  def valid_result?(%Plan.Asset{status: status}), do: status in [:ready, :failed]
end
