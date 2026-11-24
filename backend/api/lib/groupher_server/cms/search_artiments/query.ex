defmodule GroupherServer.CMS.SearchArtiments.Query do
  @moduledoc """
  Platform-neutral Search Artiments query contract.

  Business position:

      Resolver / Oban
        -> CMS.SearchArtiments
        -> Query
        -> search platform
  """

  alias GroupherServer.{CMS, Pagi}
  alias Helper.T
  alias CMS.ErrorCat

  alias CMS.SearchArtiments.{Artiment, Config}

  @type sort :: :relevance

  @type t :: %__MODULE__{
          text: String.t(),
          scope: map(),
          filters: map(),
          sort: sort(),
          pagi: GroupherServer.Pagi.Params.t() | nil,
          highlight: boolean()
        }

  @enforce_keys [:text]
  defstruct text: "",
            scope: %{},
            filters: %{},
            sort: :relevance,
            pagi: nil,
            highlight: true

  @types [:article, :comment]
  @threads Config.article_threads()
  @sorts [:relevance]

  @doc """
  Builds a validated search query from raw attributes.

  Scope and filters are normalized separately from the canonical Pagi input.
  Empty text and unsupported sorts are rejected; Pagi owns position and size validation.

  ## Examples

      Query.new(%{text: "elixir"}, %{cursor: %{first: 20}})
      #=> {:ok, %Query{text: "elixir", pagi: %GroupherServer.Pagi.Params.Cursor{first: 20}, sort: :relevance}}

      Query.new(%{text: ""}, nil)
      #=> {:error, ErrorCat.custom("search text is required")}

  """
  @spec new(map(), term()) :: T.domain_res(t())
  def new(attrs, pagi) when is_map(attrs) do
    text = attrs |> Map.get(:text, "") |> String.trim()
    sort = Map.get(attrs, :sort, :relevance)
    scope = normalize_scope(Map.get(attrs, :scope, %{}))

    with {:ok, :pass} <- validate_keys(attrs),
         {:ok, params} <- Pagi.from_input(pagi),
         {:ok, :pass} <- validate_text(text),
         {:ok, :pass} <- validate_sort(sort),
         {:ok, filters} <- normalize_filters(Map.get(attrs, :filters, %{})) do
      {:ok,
       %__MODULE__{
         text: text,
         scope: scope,
         filters: filters,
         sort: sort,
         pagi: params,
         highlight: Map.get(attrs, :highlight, true)
       }}
    end
  end

  @doc "Returns the normalized Artiment types selected by the query filters."
  @spec types(t()) :: [Artiment.artiment_type()]
  def types(%__MODULE__{filters: filters}), do: Map.get(filters, :types, [])

  @doc "Returns the normalized Article threads selected by the query filters."
  @spec threads(t()) :: [Artiment.thread()]
  def threads(%__MODULE__{filters: filters}), do: Map.get(filters, :threads, [])

  defp normalize_scope(scope) when is_map(scope) do
    scope
    |> Map.take([:community_ref, :article_id])
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

  defp normalize_filters(_) do
    {:error, ErrorCat.custom("invalid search filters")}
  end

  defp normalize_enum_list(nil, _allowed), do: {:ok, []}

  defp normalize_enum_list(values, allowed) when is_list(values) do
    if Enum.all?(values, &(&1 in allowed)) do
      {:ok, Enum.sort(Enum.uniq(values))}
    else
      {:error, ErrorCat.custom("invalid search filter enum")}
    end
  end

  defp normalize_enum_list(_, _) do
    {:error, ErrorCat.custom("invalid search filter enum")}
  end

  defp normalize_string_list(nil), do: {:ok, []}

  defp normalize_string_list(values) when is_list(values) do
    if Enum.all?(values, &(is_binary(&1) and &1 != "")) do
      {:ok, Enum.sort(Enum.uniq(values))}
    else
      {:error, ErrorCat.custom("invalid search filter string")}
    end
  end

  defp normalize_string_list(_) do
    {:error, ErrorCat.custom("invalid search filter string")}
  end

  defp validate_text(""), do: {:error, ErrorCat.custom("search text is required")}
  defp validate_text(_text), do: {:ok, :pass}

  defp validate_sort(sort) when sort in @sorts, do: {:ok, :pass}
  defp validate_sort(_sort), do: {:error, ErrorCat.custom("invalid search sort")}

  defp validate_keys(attrs) do
    if Map.keys(attrs) -- [:text, :scope, :filters, :sort, :highlight] == [] do
      {:ok, :pass}
    else
      {:error, ErrorCat.custom("Pagination belongs in PagiInput")}
    end
  end
end
