defmodule GroupherServerWeb.Schema.CMS.Dashboard.Metrics do
  @moduledoc """
  GraphQL dashboard shared types.

  Business position:

      Client
        -> Absinthe schema / Metrics
        -> resolver or domain context
        -> GraphQL response
  """
  use Absinthe.Schema.Notation

  import_types(__MODULE__.Enums)
  import_types(__MODULE__.Inputs)
  import_types(__MODULE__.Objects)
end
