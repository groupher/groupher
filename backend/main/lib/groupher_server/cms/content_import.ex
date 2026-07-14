defmodule GroupherServer.CMS.ContentImport do
  @moduledoc """
  Pure fetch and planning boundary for importing external content.

  PlatformAdapter fetches an immutable Snapshot, ThreadAdapter returns a typed
  side-effect-free Plan and a safe Preview projection, and AssetStager resolves
  resource work asynchronously. Database writes must enter through
  `ContentImport.Orchestrator.apply_job/7` so thread writes, Mapping checkpoints,
  and Job completion share one transaction.
  """

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Plan, Preview, Snapshot}

  @spec fetch(module(), map(), keyword()) :: {:ok, Snapshot.t()} | {:error, Diagnostic.t()}
  def fetch(platform_adapter, connection, opts \\ []) do
    with :ok <- platform_adapter.validate_connection(connection, opts),
         {:ok, %Snapshot{} = snapshot} <- platform_adapter.fetch(connection, opts) do
      {:ok, snapshot}
    end
  end

  @spec plan(module(), Snapshot.t(), map(), map()) ::
          {:ok, Plan.t()} | {:error, [Diagnostic.t()]}
  def plan(thread_adapter, %Snapshot{} = snapshot, thread_context, plan_context) do
    with :ok <- thread_adapter.validate(snapshot, thread_context, []),
         {:ok, %Plan{} = plan} <- thread_adapter.plan(snapshot, thread_context, plan_context) do
      {:ok, plan}
    end
  end

  @spec project_preview(module(), Plan.t()) ::
          {:ok, Preview.t()} | {:error, [Diagnostic.t()]}
  def project_preview(thread_adapter, %Plan{} = plan) do
    with {:ok, %Preview{} = preview} <- thread_adapter.project_preview(plan) do
      {:ok, preview}
    end
  end

  @spec ready_for_apply?(Plan.t()) :: boolean()
  defdelegate ready_for_apply?(plan), to: Plan
end
