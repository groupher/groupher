defmodule GroupherServer.CMS.ContentImport.ThreadAdapter do
  @moduledoc """
  Contract for projecting a Snapshot into one Groupher thread.

  `apply_in_transaction/3` is invoked synchronously by `Orchestrator` in the
  process that owns an active `GroupherServer.Repo` transaction. Implementations
  must not call `Repo.transaction/2`, `Repo.transact/2`, or `Repo.rollback/1`,
  and must return errors to the orchestrator instead. All transactional writes
  must use the same Repo; network calls, object-store writes, and writes through
  another Repo belong outside this callback and require idempotent compensation
  or an outbox/saga boundary.
  """

  alias GroupherServer.CMS.ContentImport.{
    ApplyResult,
    Diagnostic,
    Mapping,
    Plan,
    Preview,
    Snapshot
  }

  @type thread_context :: %{
          required(:community_ref) => String.t(),
          required(:thread) => atom(),
          optional(:scope_ref) => String.t()
        }
  @type plan_context :: %{
          required(:mappings) => [Mapping.t()],
          optional(:preparation) => term(),
          optional(:local_hashes) => %{optional(String.t()) => String.t()},
          optional(:options) => keyword()
        }

  @callback validate(Snapshot.t(), thread_context(), keyword()) ::
              :ok | {:error, [Diagnostic.t()]}

  @callback plan(Snapshot.t(), thread_context(), plan_context()) ::
              {:ok, Plan.t()} | {:error, [Diagnostic.t()]}

  @callback project_preview(Plan.t()) ::
              {:ok, Preview.t()} | {:error, [Diagnostic.t()]}

  @callback apply_in_transaction(Plan.t(), term(), keyword()) ::
              {:ok, ApplyResult.t()} | {:error, [Diagnostic.t()]}
end
