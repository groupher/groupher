defmodule GroupherServer.CMS.Comments.Query.Contract do
  @moduledoc """
  Defines the public Comment page sort contract.

  Business position:

      GraphQL / service filter
        -> Comments.Query.Contract
        -> Comments.Query
        -> Gate scope + Pagi
  """

  alias GroupherServer.{CMS, Pagi}

  @sort_values [:asc_inserted, :desc_inserted]

  @doc """
  Returns sort values supported by Comment timeline and reply pages.

  ## Examples

      Contract.sort_values()
      #=> [:asc_inserted, :desc_inserted]
  """
  @spec sort_values() :: [atom()]
  def sort_values, do: @sort_values

  @doc """
  Validates a Comment page filter and rejects unsupported keys or sorts.

  ## Examples

      Contract.validate_filter(%{sort: :desc_inserted})
      #=> {:ok, :pass}

      Contract.validate_filter(%{sort: :most_views})
      #=> {:error, reason}
  """
  @spec validate_filter(map()) :: {:ok, :pass} | {:error, term()}
  def validate_filter(filter) when is_map(filter) do
    cond do
      Enum.any?(Map.keys(filter), &(&1 != :sort)) ->
        {:error, CMS.ErrorCat.invalid_body("Unsupported Comment filter")}

      not is_nil(Map.get(filter, :sort)) and Map.get(filter, :sort) not in @sort_values ->
        {:error, Pagi.unsupported_sort()}

      true ->
        {:ok, :pass}
    end
  end

  def validate_filter(_filter) do
    {:error, CMS.ErrorCat.invalid_body("Invalid Comment filter")}
  end
end
