defmodule GroupherServerWeb.Schema.CMS.Dashboard.Metrics.Objects do
  @moduledoc """
  GraphQL dashboard object types.

  Business position:

      Client
        -> Absinthe schema / Objects
        -> resolver or domain context
        -> GraphQL response
  """
  use Absinthe.Schema.Notation

  object :social do
    @desc "Social platform identifier."
    field(:platform, :string)
    @desc "URL of the community profile on that platform."
    field(:link, :string)
  end

  object :app_store do
    @desc "App store identifier."
    field(:platform, :string)
    @desc "URL of the application listing."
    field(:link, :string)
  end
end
