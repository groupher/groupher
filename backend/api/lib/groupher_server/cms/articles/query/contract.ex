defmodule GroupherServer.CMS.Articles.Query.Contract do
  @moduledoc """
  Defines the accepted filter and ordering vocabulary for public Article pages.

      GraphQL/service input -> Contract.validate_filter/1 -> Pagination
  """

  alias GroupherServer.{CMS, Pagi}

  @filter_keys [
    :community,
    :author_id,
    :community_tag,
    :community_tags,
    :when,
    :cat,
    :status,
    :statuses,
    :order,
    :sort
  ]
  @order_values [:publish, :upvotes, :comments, :views]
  @sort_values [
    :most_views,
    :least_views,
    :asc_inserted,
    :desc_inserted,
    :asc_active,
    :desc_active
  ]
  @when_values [:today, :this_week, :this_month, :this_year]
  @cat_values CMS.Artiment.Const.cat_values()
  @status_values CMS.Artiment.Const.status_values()

  @doc """
  Returns the Article page `order` values accepted by the query.

  ## Examples

      Contract.order_values()
      #=> [:publish, :upvotes, :comments, :views]
  """
  @spec order_values() :: [atom()]
  def order_values, do: @order_values

  @doc """
  Returns the Article page `sort` values accepted by the query.

  ## Examples

      Contract.sort_values()
      #=> [:most_views, :least_views, :asc_inserted, :desc_inserted, :asc_active, :desc_active]
  """
  @spec sort_values() :: [atom()]
  def sort_values, do: @sort_values

  @doc """
  Validates Article filters before building a query; pagination belongs to PagiInput.

  ## Examples

      Contract.validate_filter(%{community: "groupher", order: :views})
      #=> {:ok, :pass}

      Contract.validate_filter(%{sort: :collects})
      #=> {:error, %ErrorCat.Error{reason: :unsupported_sort}}
  """
  @spec validate_filter(map()) :: {:ok, :pass} | {:error, term()}
  def validate_filter(filter) when is_map(filter) do
    keys = Map.keys(filter)
    order = Map.get(filter, :order)
    sort = Map.get(filter, :sort)

    cond do
      Enum.any?(keys, &(&1 not in @filter_keys)) ->
        {:error, CMS.ErrorCat.invalid_body("Unsupported Article filter")}

      Enum.any?([:page, :size, :first, :after, :config_revision], &Map.has_key?(filter, &1)) ->
        {:error, CMS.ErrorCat.invalid_body("Pagination belongs in PagiInput")}

      not is_nil(order) and order not in @order_values ->
        {:error, Pagi.unsupported_sort()}

      not is_nil(sort) and sort not in @sort_values ->
        {:error, Pagi.unsupported_sort()}

      not is_nil(order) and not is_nil(sort) ->
        {:error, CMS.ErrorCat.invalid_body("Select order or sort")}

      Map.has_key?(filter, :status) and Map.has_key?(filter, :statuses) ->
        {:error, CMS.ErrorCat.invalid_body("Select status or statuses")}

      Map.has_key?(filter, :community_tag) and Map.has_key?(filter, :community_tags) ->
        {:error, CMS.ErrorCat.invalid_body("Select community_tag or community_tags")}

      not valid_filter_values?(filter) ->
        {:error, CMS.ErrorCat.invalid_body("Invalid Article filter value")}

      true ->
        {:ok, :pass}
    end
  end

  def validate_filter(_filter), do: {:error, CMS.ErrorCat.invalid_body("Invalid Article filter")}

  defp valid_filter_values?(filter) do
    valid_optional?(filter, :community, &is_binary/1) and
      valid_optional?(filter, :author_id, &is_integer/1) and
      valid_optional?(filter, :community_tag, &is_binary/1) and
      valid_optional?(filter, :community_tags, fn tags ->
        is_list(tags) and Enum.all?(tags, &is_binary/1)
      end) and
      valid_optional?(filter, :when, &(&1 in @when_values)) and
      valid_optional?(filter, :cat, &(&1 in @cat_values)) and
      valid_optional?(filter, :status, &(&1 in @status_values)) and
      valid_optional?(filter, :statuses, fn statuses ->
        is_list(statuses) and Enum.all?(statuses, &(&1 in @status_values))
      end)
  end

  defp valid_optional?(filter, key, predicate) do
    case Map.fetch(filter, key) do
      :error -> true
      {:ok, nil} -> true
      {:ok, value} -> predicate.(value)
    end
  end
end
