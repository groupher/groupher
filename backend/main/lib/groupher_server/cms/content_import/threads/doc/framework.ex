defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Framework do
  @moduledoc """
  Contract implemented by source-framework adapters.

  Adapters only inspect an already available project directory. Downloading or
  extracting repositories belongs to a separate loader, and persisting the
  resulting source tree belongs to a later import-planning stage.
  """

  @type diagnostic :: %{
          required(:code) => String.t(),
          required(:severity) => String.t(),
          required(:message) => String.t(),
          optional(:file) => String.t(),
          optional(:source_id) => String.t(),
          optional(:details) => term()
        }

  @type result :: %{
          required(:tree) => map(),
          required(:diagnostics) => [diagnostic()]
        }

  @callback parse(Path.t()) :: {:ok, result()} | {:error, diagnostic()}
end
