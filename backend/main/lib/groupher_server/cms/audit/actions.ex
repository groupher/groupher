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
    article.archived
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
    community.destroy_scheduled
    community.destroy_cancelled
    community.destroyed
    community.lifecycle_reconciled
  )

  @doc "Returns all registered CMS audit action names."
  @spec values() :: [String.t()]
  def values, do: @actions

  @doc """
  Checks whether an action name is a registered audit action.

  ## Examples

      Actions.valid?("article.trashed")
      #=> true

      Actions.valid?("unknown.action")
      #=> false

  """
  @spec valid?(String.t()) :: boolean()
  def valid?(action), do: action in @actions
end
