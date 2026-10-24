defmodule GroupherServer.CMS.Communities.Query.Contract do
  @moduledoc """
  Defines the public Community list filter and sort contract.

  Business position:

      GraphQL / service filter
        -> Communities.Query.Contract
        -> Communities.Query
        -> Gate scope + Pagi
  """

  alias GroupherServer.{CMS, Pagi}

  @sort_values [:desc_inserted, :asc_inserted, :most_views, :least_views]

  @doc """
  Returns sort values supported by the public Community list.

  ## Examples

      Contract.sort_values()
      #=> [:desc_inserted, :asc_inserted, :most_views, :least_views]
  """
  @spec sort_values() :: [atom()]
  def sort_values, do: @sort_values

  @doc """
  Validates Community list filters before Query applies them.

  ## Examples

      Contract.validate_filter(%{category: "technology", sort: :most_views})
      #=> {:ok, :pass}
  """
  @spec validate_filter(map()) :: {:ok, :pass} | {:error, term()}
  def validate_filter(filter) when is_map(filter) do
    cond do
      Enum.any?(Map.keys(filter), &(&1 not in [:category, :sort])) ->
        {:error, CMS.ErrorCat.invalid_body("Unsupported Community filter")}

      Map.has_key?(filter, :sort) and Map.get(filter, :sort) not in @sort_values ->
        {:error, Pagi.unsupported_sort()}

      true ->
        {:ok, :pass}
    end
  end

  def validate_filter(_filter) do
    {:error, CMS.ErrorCat.invalid_body("Invalid Community filter")}
  end
end
