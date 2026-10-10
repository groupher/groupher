defmodule GroupherServer.CMS.Communities.Categories.Query do
  @moduledoc """
  Read-only Category queries for Community scopes.

      Query resolver -> Communities.Categories.Query -> Gate-scoped read facts
  """

  alias GroupherServer.CMS.Communities.Query, as: CommunitiesQuery

  @doc "Returns the paged Category projection used by the existing Community query."
  defdelegate page(filter), to: CommunitiesQuery, as: :page_categories
end
