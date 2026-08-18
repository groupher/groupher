defmodule GroupherServerWeb.Middleware.CutParticipators do
  @moduledoc """
  Bounds and de-duplicates the comment-participant list returned by Absinthe.

  The current loader returns the full participant collection, so this legacy
  middleware applies the requested `filter.first` (or five by default) after
  resolution. It is an in-memory compatibility boundary, not a database paging
  implementation.

  Business position:

      Resolver result
        -> CutParticipators middleware
        -> next middleware
        -> GraphQL field result
  """

  @behaviour Absinthe.Middleware
  @default_length 5

  @doc "Returns a bounded, newest-first unique participant list when resolution succeeds."
  def call(%{errors: errors} = resolution, _) when length(errors) > 0, do: resolution

  def call(%{value: value, arguments: %{filter: %{first: first}}} = resolution, _) do
    %{resolution | value: value |> Enum.uniq() |> Enum.reverse() |> Enum.slice(0, first)}
  end

  def call(%{value: value} = resolution, _) do
    %{
      resolution
      | value: value |> Enum.uniq() |> Enum.reverse() |> Enum.slice(0, @default_length)
    }
  end

  def call(resolution, _), do: resolution
end
