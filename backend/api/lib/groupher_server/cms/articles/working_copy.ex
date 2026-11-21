defmodule GroupherServer.CMS.Articles.WorkingCopy do
  @moduledoc """
  Public boundary for Article WorkingCopy and Snapshot capabilities.

      CMS facade -> WorkingCopy access/query capabilities -> scoped owner content
      Article Commands -> WorkingCopy store/snapshot/publication capabilities -> transaction result
  """

  alias __MODULE__.{Access, Query}

  @doc "Checks edit admission for an Article in the explicit Community context."
  defdelegate access_check(actor, action, article, community), to: Access

  @doc "Checks edit admission inside the caller-owned resource transaction."
  defdelegate check_in_transaction(actor, action, article, community), to: Access

  @doc "Lists editable WorkingCopies after the caller has authorized the Article."
  defdelegate working_copies(article, community), to: Query

  @doc "Lists immutable Snapshots after the caller has authorized the Article."
  defdelegate snapshots(article, community), to: Query

  @doc "Loads one Snapshot after the caller has authorized the Article."
  defdelegate snapshot(article, community, snapshot_id), to: Query

  @doc "Loads one WorkingCopy after the caller has authorized the Article."
  defdelegate working_copy(article, community, working_copy_id), to: Query

  @doc "Returns typed thread-specific fields owned by one WorkingCopy."
  defdelegate working_copy_thread_fields(working_copy), to: Query

  @doc "Returns the tag IDs owned by one WorkingCopy."
  defdelegate working_copy_tag_ids(working_copy), to: Query

  @doc "Returns typed thread-specific fields captured by one Snapshot."
  defdelegate snapshot_thread_fields(snapshot), to: Query

  @doc "Returns the tag IDs captured by one Snapshot."
  defdelegate snapshot_tag_ids(snapshot), to: Query
end
