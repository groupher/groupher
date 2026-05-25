defmodule GroupherServerWeb.Schema.CMS.Dashboard.Metrics do
  @moduledoc """
  GraphQL dashboard shared types.
  """
  use Absinthe.Schema.Notation

  import_types(__MODULE__.Enums)
  import_types(__MODULE__.Inputs)
  import_types(__MODULE__.Objects)
end
