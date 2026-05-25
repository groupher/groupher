defmodule GroupherServerWeb.Schema.CMS.Dashboard.Metrics.Objects do
  @moduledoc """
  GraphQL dashboard object types.
  """
  use Absinthe.Schema.Notation

  object :social do
    field(:platform, :string)
    field(:link, :string)
  end

  object :app_store do
    field(:platform, :string)
    field(:link, :string)
  end
end
