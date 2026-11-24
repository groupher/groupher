defmodule GroupherServer.CMS.Search do
  @moduledoc """
  Public CMS boundary for viewer-aware community discovery search.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Search
        -> Repo / external boundary
  """

  alias __MODULE__.Community
  alias GroupherServer.Accounts

  alias Accounts.Model.User
  alias Helper.T

  @doc "Finds public communities whose title, slug, or alias matches the search text."
  @spec community(String.t()) :: T.domain_res([map()])
  def community(title), do: Community.search(title)

  @doc "Finds matching public communities, with either a viewer for subscription state or a category filter."
  @spec community(String.t(), User.t()) :: T.domain_res([map()])
  def community(title, %User{} = user), do: Community.search(title, user)

  @spec community(String.t(), String.t()) :: T.domain_res([map()])
  def community(title, category) when is_binary(category), do: Community.search(title, category)

  @doc "Finds category-matched public communities with viewer-specific subscription state."
  @spec community(String.t(), String.t(), User.t()) :: T.domain_res([map()])
  def community(title, category, %User{} = user) when is_binary(category) do
    Community.search(title, category, user)
  end
end
