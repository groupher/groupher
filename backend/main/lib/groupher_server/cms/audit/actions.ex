defmodule GroupherServer.CMS.Audit.Actions do
  @moduledoc """
  Registry of stable CMS audit action names.

  Keeping validation in code lets the audit table support new domains without
  a database enum migration.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Actions
        -> Repo / external boundary
  """

  @actions ~w(
    article.trashed
    article.restored
    article.permanently_deleted
    doc_tree.trashed
    doc_tree.restored
    doc_tree.permanently_deleted
    press.config_updated
    community.blocker_created
    community.blocker_released
    community.blocker_terminated
    community.setup_failed
    community.setup_retried
    community.activated
    community.reclaim_scheduled
    community.reclaim_cancelled
    community.destroyed
    community.lifecycle_reconciled
  )

  @spec values() :: [String.t()]
  def values, do: @actions

  @spec valid?(String.t()) :: boolean()
  def valid?(action), do: action in @actions
end
