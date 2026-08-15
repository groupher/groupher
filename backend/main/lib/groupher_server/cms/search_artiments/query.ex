defmodule GroupherServer.CMS.SearchArtiments.Query do
  @moduledoc """
  Platform-neutral Search Artiments query contract.

  Business position:

      Resolver / Oban
        -> CMS.SearchArtiments
        -> Query
        -> search platform
  """

  alias GroupherServer.CMS.SearchArtiments.Artiment

  @type sort :: :relevance

  @type t :: %__MODULE__{
          text: String.t(),
          scope: map(),
          filters: map(),
          sort: sort(),
          page: pos_integer(),
          size: pos_integer(),
          highlight: boolean()
        }

  @enforce_keys [:text]
  defstruct text: "",
            scope: %{},
            filters: %{},
            sort: :relevance,
            page: 1,
            size: 20,
            highlight: true

  @max_size 100
  @types [:article, :comment]
  @threads [:post, :blog, :changelog, :doc]
  @sorts [:relevance]

  @spec new(map()) :: {:ok, t()} | {:error, term()}
  def new(attrs) when is_map(attrs) do
    text = attrs |> Map.get(:text, "") |> String.trim()
    page = positive_integer(Map.get(attrs, :page), 1)
    size = positive_integer(Map.get(attrs, :size), 20) |> min(@max_size)
    sort = Map.get(attrs, :sort, :relevance)
    scope = normalize_scope(Map.get(attrs, :scope, %{}))

    with :ok <- validate_text(text),
         :ok <- validate_sort(sort),
         {:ok, filters} <- normalize_filters(Map.get(attrs, :filters, %{})) do
      {:ok,
       %__MODULE__{
         text: text,
         scope: scope,
         filters: filters,
         sort: sort,
         page: page,
         size: size,
         highlight: Map.get(attrs, :highlight, true)
       }}
    end
  end

  @spec types(t()) :: [Artiment.artiment_type()]
  def types(%__MODULE__{filters: filters}), do: Map.get(filters, :types, [])

  @spec threads(t()) :: [Artiment.thread()]
  def threads(%__MODULE__{filters: filters}), do: Map.get(filters, :threads, [])

  defp normalize_scope(scope) when is_map(scope) do
    scope
    |> Map.take([:community_ref, :article_ref])
    |> Enum.reject(fn {_key, value} -> not is_binary(value) or value == "" end)
    |> Map.new()
  end

  defp normalize_scope(_), do: %{}

  defp normalize_filters(filters) when is_map(filters) do
    with {:ok, types} <- normalize_enum_list(Map.get(filters, :types), @types),
         {:ok, threads} <- normalize_enum_list(Map.get(filters, :threads), @threads),
         {:ok, author_refs} <- normalize_string_list(Map.get(filters, :author_refs)),
         {:ok, locales} <- normalize_string_list(Map.get(filters, :locales)) do
      {:ok, %{types: types, threads: threads, author_refs: author_refs, locales: locales}}
    end
  end

  defp normalize_filters(_), do: {:error, {:custom, "invalid search filters"}}

  defp normalize_enum_list(nil, _allowed), do: {:ok, []}

  defp normalize_enum_list(values, allowed) when is_list(values) do
    if Enum.all?(values, &(&1 in allowed)) do
      {:ok, Enum.uniq(values)}
    else
      {:error, {:custom, "invalid search filter enum"}}
    end
  end

  defp normalize_enum_list(_, _), do: {:error, {:custom, "invalid search filter enum"}}

  defp normalize_string_list(nil), do: {:ok, []}

  defp normalize_string_list(values) when is_list(values) do
    if Enum.all?(values, &(is_binary(&1) and &1 != "")) do
      {:ok, Enum.uniq(values)}
    else
      {:error, {:custom, "invalid search filter string"}}
    end
  end

  defp normalize_string_list(_), do: {:error, {:custom, "invalid search filter string"}}

  defp validate_text(""), do: {:error, {:custom, "search text is required"}}
  defp validate_text(_text), do: :ok

  defp validate_sort(sort) when sort in @sorts, do: :ok
  defp validate_sort(_sort), do: {:error, {:custom, "invalid search sort"}}

  defp positive_integer(value, _default) when is_integer(value) and value > 0, do: value
  defp positive_integer(_, default), do: default
end
