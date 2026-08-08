defmodule GroupherServer.CMS.Audit.Actions do
  @moduledoc """
  Registry of stable CMS audit action names.

  Keeping validation in code lets the audit table support new domains without
  a database enum migration.
  """

  @actions ~w(
    article.trashed
    article.restored
    article.permanently_deleted
    doc_tree.trashed
    doc_tree.restored
    doc_tree.permanently_deleted
    press.config_updated
  )

  @spec values() :: [String.t()]
  def values, do: @actions

  @spec valid?(String.t()) :: boolean()
  def valid?(action), do: action in @actions
end
