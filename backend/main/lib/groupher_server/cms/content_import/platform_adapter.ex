defmodule GroupherServer.CMS.ContentImport.PlatformAdapter do
  @moduledoc "Contract for fetching one external platform into an immutable Snapshot."

  alias GroupherServer.CMS.ContentImport.{Diagnostic, Snapshot}

  @type connection :: map()

  @callback validate_connection(connection(), keyword()) :: :ok | {:error, Diagnostic.t()}
  @callback fetch(connection(), keyword()) :: {:ok, Snapshot.t()} | {:error, Diagnostic.t()}
end
