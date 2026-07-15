defmodule GroupherServer.CMS.ContentImport do
  @moduledoc """
  Pure fetch and planning boundary for importing external content.

  PlatformAdapter fetches an immutable Snapshot, ThreadAdapter returns a typed
  side-effect-free Plan and a safe Preview projection, and AssetStager resolves
  resource work asynchronously. Database writes must enter through
  `ContentImport.Orchestrator.apply_job/7` so thread writes, Mapping checkpoints,
  and Job completion share one transaction.

  The complete runtime pipeline is:

      External source
            |
            v
      PlatformAdapter.fetch                 no Repo writes
            |
            v
         Snapshot ---------------------> Checkpoints.persist_snapshot
            |                                  |             |
            |                                  v             v
            |                             PayloadStore   Snapshot row
            |
            +---- Docs only: Thread.Doc.prepare
            |                    |
            |                    v
            |               Preparation ------> Checkpoints.persist_preparation
            |
            v
      ThreadAdapter.plan                  pure projection
            |
            v
          Plan ------------------------> Checkpoints.persist_plan
            |                                  |             |
            |                                  v             v
            |                             PayloadStore   Job.Item/Job.Asset
            |
            +---- project_preview ------> Preview        no Repo writes
            |
            +---- asset staging --------> Job ready
            |
            v
      Orchestrator.begin_apply
            |
            v
      +---------------- one Repo transaction ----------------+
      | Orchestrator.apply_job                               |
      |      |                                                |
      |      +--> ThreadAdapter.apply_in_transaction          |
      |      |         +--> thread Draft/Preview writes       |
      |      |         `--> Docs navigation tree writes       |
      |      |                                                |
      |      +--> Mapping upserts / source_deleted actions    |
      |      `--> Job completed                               |
      +-------------------------------------------------------+

  Snapshot, Preparation, and Plan payloads live in PayloadStore. Their database
  rows contain bounded locators and queryable execution state, not full payloads.
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
