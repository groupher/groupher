defmodule Helper.TestFakes.SearchArtiments do
  @moduledoc false

  @behaviour GroupherServer.CMS.SearchArtiments.PlatformAdapter

  alias GroupherServer.CMS.SearchArtiments.{Artiment, Query, Result}

  @table :search_artiments_test_platform

  @impl true
  def upsert(artiments, _opts \\ []) do
    table = ensure_table()
    Enum.each(artiments, &:ets.insert(table, {&1.ref, &1}))
    :ok
  end

  @impl true
  def delete(refs) do
    table = ensure_table()
    Enum.each(refs, &:ets.delete(table, &1))
    :ok
  end

  @impl true
  def update_metrics(updates) do
    table = ensure_table()

    Enum.each(updates, fn {ref, metrics} ->
      case :ets.lookup(table, ref) do
        [{^ref, artiment}] ->
          updated =
            Enum.reduce(metrics, artiment, fn
              {:upvotes_count, value}, acc -> %{acc | upvotes_count: value}
              {:comments_count, value}, acc -> %{acc | comments_count: value}
              {:replies_count, value}, acc -> %{acc | replies_count: value}
              {:updated_at, value}, acc -> %{acc | updated_at: value}
              _, acc -> acc
            end)

          :ets.insert(table, {ref, updated})

        [] ->
          :ok
      end
    end)

    :ok
  end

  @impl true
  def search(%Query{} = query) do
    matches =
      ensure_table()
      |> :ets.tab2list()
      |> Enum.map(fn {_ref, artiment} -> artiment end)
      |> Enum.filter(&matches?(&1, query))
      |> Enum.sort_by(& &1.inserted_at, {:desc, DateTime})

    total_count = length(matches)
    entries = matches |> Enum.drop((query.page - 1) * query.size) |> Enum.take(query.size)

    {:ok,
     %Result{
       entries: Enum.map(entries, &%{artiment: &1, highlights: []}),
       total_pages: ceil(total_count / query.size),
       total_count: total_count,
       page_size: query.size,
       page_number: query.page
     }}
  end

  def reset do
    case :ets.whereis(@table) do
      :undefined -> :ok
      table -> :ets.delete_all_objects(table)
    end
  end

  defp matches?(%Artiment{} = artiment, query) do
    text = String.downcase(query.text)

    contains_text =
      String.contains?(String.downcase(artiment.plain_text), text) or
        String.contains?(String.downcase(artiment.title || ""), text)

    contains_text and matches_scope?(artiment, query.scope) and
      matches_values?(artiment.type, Query.types(query)) and
      matches_values?(artiment.thread, Query.threads(query)) and
      matches_values?(artiment.author_ref, query.filters[:author_refs]) and
      matches_values?(artiment.locale, query.filters[:locales])
  end

  defp matches_scope?(artiment, scope) do
    matches_optional?(artiment.community_ref, scope[:community_ref]) and
      matches_optional?(artiment.article_ref, scope[:article_ref])
  end

  defp matches_optional?(_actual, nil), do: true
  defp matches_optional?(actual, expected), do: actual == expected

  defp matches_values?(_actual, []), do: true
  defp matches_values?(actual, values), do: actual in values

  defp ensure_table do
    case :ets.whereis(@table) do
      :undefined -> :ets.new(@table, [:named_table, :public, :set, read_concurrency: true])
      table -> table
    end
  rescue
    ArgumentError -> :ets.whereis(@table)
  end
end
