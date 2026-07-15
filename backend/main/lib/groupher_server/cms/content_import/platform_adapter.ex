defmodule GroupherServer.CMS.ContentImport.PlatformAdapter do
  @moduledoc """
  Contract for fetching one external platform into an immutable Snapshot.

      Connection/config
             |
             v
      validate_connection
             |
             v
           fetch --------> entries + revision + diagnostics
                              |
                              v
                           Snapshot

  Adapters stop at source facts. They do not know Groupher target IDs, create
  Jobs, write Drafts, or decide conflict resolution.
  """

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Snapshot}

  @type connection :: map()

  @callback validate_connection(connection(), keyword()) :: :ok | {:error, Diagnostic.t()}
  @callback fetch(connection(), keyword()) :: {:ok, Snapshot.t()} | {:error, Diagnostic.t()}
end
