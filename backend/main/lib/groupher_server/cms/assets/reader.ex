defmodule GroupherServer.CMS.Assets.Reader do
  @moduledoc """
  Read-side helpers for the community asset library.

  Billing-oriented reads only look at active rows in `community_assets`. Usage
  reads go through `article_document_asset_refs`.

  Business position:

      Dashboard / editor
        -> CMS.Assets
        -> Reader
        -> Repo / Assets Hub
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Assets.ErrorCat
  alias CMS.Artiment.Threads
  alias CMS.Model.{ArticleDocumentAssetRef, Community, CommunityAsset}
  alias Helper.{ORM, T}

  @default_page 1
  @default_size 20
  @storage_limit_bytes 100 * 1024 * 1024

  @doc """
  Returns a page of active assets for a community.

  This read-side function is the implementation behind `CMS.Assets.page/2`.
  It applies the shared active-asset predicate and orders newest assets first.

  ## Examples

      Reader.page(community, %{page: 1, size: 20})
      #=> {:ok, %{entries: assets, total_count: total_count}}

  """
  @spec page(Community.t(), map() | nil) :: T.domain_res(T.paged_data())
  def page(%Community{id: community_id}, filter) do
    %{page: page, size: size} = normalized = normalize_filter(filter)

    community_id
    |> CommunityAsset.active_query()
    |> apply_filter(normalized)
    |> order_by([asset], desc: asset.inserted_at, desc: asset.id)
    |> ORM.paginator(page: page, size: size)
    |> then(&{:ok, &1})
  end

  @doc """
  Returns community asset stats for filter bars and quota display.

  Storage bytes and quota are community-wide active-asset values. Thread and
  type stats are based on `community_assets` ownership fields, not article refs.

  ## Examples

      Reader.stats(community, nil)
      #=> {:ok, %{storage_bytes: 4096, storage_limit_bytes: 104857600}}

  """
  @spec stats(Community.t(), map() | nil) :: T.domain_res(map())
  def stats(%Community{id: community_id}, filter) do
    normalized = normalize_filter(filter)
    base_query = community_id |> CommunityAsset.active_query() |> apply_filter(normalized)
    storage = community_storage(community_id)

    {:ok,
     %{
       total_count: total_count(base_query),
       storage_bytes: storage.storage_bytes,
       storage_limit_bytes: @storage_limit_bytes,
       by_thread: thread_stats(base_query),
       by_asset_type: asset_type_stats(base_query)
     }}
  end

  @doc """
  Returns active asset counts and storage bytes for one community.

  Usage is computed from `community_assets`, not from refs, so the same uploaded
  object is counted once regardless of how many articles reference it.

  ## Examples

      Reader.usage(community)
      #=> {:ok, %{asset_count: 2, storage_bytes: 4096}}

  """
  @spec usage(Community.t()) :: T.domain_res(map())
  def usage(%Community{id: community_id}) do
    result = community_storage(community_id)

    {:ok, normalize_usage_result(result)}
  end

  @doc """
  Returns a page of article document refs for one active asset.

  The asset lookup is scoped to the supplied community before refs are loaded,
  which prevents cross-community ref discovery.

  ## Examples

      Reader.refs(community, asset.id, %{page: 1, size: 10})
      #=> {:ok, %{entries: refs, page_number: 1}}

  """
  @spec refs(Community.t(), T.id(), map() | nil) :: T.domain_res(T.paged_data())
  def refs(%Community{id: community_id}, asset_id, filter) do
    %{page: page, size: size} = normalize_filter(filter)

    with {:ok, %CommunityAsset{id: asset_id}} <- find_active_asset(community_id, asset_id) do
      ArticleDocumentAssetRef
      |> where([ref], ref.community_id == ^community_id and ref.asset_id == ^asset_id)
      |> order_by([ref], desc: ref.inserted_at, desc: ref.id)
      |> ORM.paginator(page: page, size: size)
      |> then(&{:ok, &1})
    end
  end

  @doc """
  Returns public-read origin metadata for one active asset public ref.

  This is the Phoenix source-of-truth lookup used by assets-hub before it reads
  any provider object. It intentionally exposes only lifecycle and storage
  routing fields needed by the public origin.

  ## Examples

      Reader.origin_info("asset_xxx")
      #=> {:ok, %CommunityAsset{public_ref: "asset_xxx", status: :active}}

  """
  @spec origin_info(String.t()) :: T.domain_res(CommunityAsset.t())
  def origin_info(public_ref) when is_binary(public_ref) do
    public_ref = String.trim(public_ref)

    CommunityAsset
    |> where([asset], asset.public_ref == ^public_ref)
    |> where([asset], not is_nil(asset.storage))
    |> where([asset], not is_nil(asset.storage_key))
    |> where([asset], is_nil(asset.deleted_at))
    |> where([asset], asset.status == :active)
    |> Repo.one()
    |> case do
      nil -> {:error, ErrorCat.not_exist("asset not found")}
      asset -> {:ok, asset}
    end
  end

  def origin_info(_), do: {:error, ErrorCat.not_exist("asset not found")}

  defp normalize_filter(nil),
    do: %{
      asset_type: nil,
      page: @default_page,
      query: nil,
      size: @default_size,
      subtypes: [],
      thread: nil
    }

  defp normalize_filter(filter) do
    %{
      asset_type: normalize_asset_type(get_filter(filter, :asset_type)),
      page: Map.get(filter, :page, @default_page),
      query: normalize_query(get_filter(filter, :query)),
      size: Map.get(filter, :size, @default_size),
      subtypes: normalize_subtypes(get_filter(filter, :subtypes)),
      thread: normalize_thread(get_filter(filter, :thread))
    }
  end

  defp apply_filter(query, %{
         asset_type: asset_type,
         query: search,
         subtypes: subtypes,
         thread: thread
       }) do
    query
    |> apply_thread_filter(thread)
    |> apply_asset_type_filter(asset_type)
    |> apply_query_filter(search)
    |> apply_subtype_filter(subtypes)
  end

  defp apply_thread_filter(query, nil), do: query
  defp apply_thread_filter(query, thread), do: where(query, [asset], asset.thread == ^thread)

  defp apply_asset_type_filter(query, nil), do: query

  defp apply_asset_type_filter(query, asset_type),
    do: where(query, [asset], asset.asset_type == ^asset_type)

  defp apply_query_filter(query, nil), do: query

  defp apply_query_filter(query, search) do
    pattern = "%#{search}%"

    where(
      query,
      [asset],
      ilike(asset.title, ^pattern) or ilike(asset.filename, ^pattern)
    )
  end

  defp apply_subtype_filter(query, []), do: query

  defp apply_subtype_filter(query, subtypes) do
    where(
      query,
      [asset],
      fragment("lower(split_part(?, '/', 2))", asset.mime_type) in ^subtypes or
        fragment("lower(regexp_replace(?, '^.*\\.', ''))", asset.filename) in ^subtypes
    )
  end

  defp community_storage(community_id) do
    community_id
    |> CommunityAsset.active_query()
    |> select([asset], %{
      asset_count: count(asset.id),
      storage_bytes: coalesce(sum(asset.size_bytes), 0)
    })
    |> Repo.one()
    |> normalize_usage_result()
  end

  defp total_count(query), do: Repo.aggregate(query, :count, :id)

  defp thread_stats(query) do
    counts =
      query
      |> where([asset], not is_nil(asset.thread))
      |> group_by([asset], asset.thread)
      |> select([asset], %{thread: asset.thread, count: count(asset.id)})
      |> Repo.all()
      |> Map.new(&{&1.thread, &1.count})

    Threads.article_enums()
    |> Enum.map(&%{thread: &1, count: Map.get(counts, &1, 0)})
  end

  defp asset_type_stats(query) do
    rows =
      query
      |> group_by([asset], [asset.asset_type, asset.mime_type, asset.filename])
      |> select([asset], %{
        asset_type: asset.asset_type,
        count: count(asset.id),
        filename: asset.filename,
        mime_type: asset.mime_type
      })
      |> Repo.all()

    rows
    |> Enum.group_by(& &1.asset_type)
    |> Enum.map(fn {asset_type, rows} ->
      %{
        asset_type: asset_type,
        count: Enum.reduce(rows, 0, &(&1.count + &2)),
        subtypes: subtype_stats(rows)
      }
    end)
    |> Enum.sort_by(&to_string(&1.asset_type))
  end

  defp subtype_stats(rows) do
    rows
    |> Enum.group_by(&subtype_from_row/1)
    |> Enum.reject(fn {subtype, _rows} -> is_nil(subtype) end)
    |> Enum.map(fn {subtype, rows} ->
      %{key: subtype, label: subtype, count: Enum.reduce(rows, 0, &(&1.count + &2))}
    end)
    |> Enum.sort_by(& &1.key)
  end

  defp subtype_from_mime(nil), do: nil

  defp subtype_from_mime(mime_type) when is_binary(mime_type) do
    mime_type
    |> String.downcase()
    |> String.split("/", parts: 2)
    |> case do
      [_type, subtype] -> subtype |> String.split(["+", ";"], parts: 2) |> List.first()
      _ -> nil
    end
  end

  defp subtype_from_row(%{filename: filename, mime_type: mime_type}) do
    subtype_from_extension(filename) || subtype_from_mime(mime_type)
  end

  defp subtype_from_extension(nil), do: nil

  defp subtype_from_extension(filename) when is_binary(filename) do
    case filename |> String.downcase() |> String.split(".") do
      [_] -> nil
      parts -> List.last(parts)
    end
  end

  defp normalize_asset_type(nil), do: nil

  defp normalize_asset_type(asset_type) when asset_type in [:image, :video, :audio, :file],
    do: asset_type

  defp normalize_asset_type(asset_type) when is_binary(asset_type) do
    asset_type
    |> String.downcase()
    |> String.to_existing_atom()
    |> normalize_asset_type()
  rescue
    ArgumentError -> nil
  end

  defp normalize_asset_type(_), do: nil

  defp normalize_thread(nil), do: nil

  defp normalize_thread(thread) when is_atom(thread) do
    if thread in Threads.article_enums(), do: thread, else: nil
  end

  defp normalize_thread(thread) when is_binary(thread) do
    thread
    |> String.downcase()
    |> String.to_existing_atom()
    |> normalize_thread()
  rescue
    ArgumentError -> nil
  end

  defp normalize_thread(_), do: nil

  defp normalize_query(nil), do: nil

  defp normalize_query(query) when is_binary(query) do
    query = String.trim(query)
    if query == "", do: nil, else: query
  end

  defp normalize_query(_), do: nil

  defp normalize_subtypes(nil), do: []

  defp normalize_subtypes(subtypes) when is_list(subtypes) do
    subtypes
    |> Enum.map(&normalize_subtype/1)
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
  end

  defp normalize_subtypes(_), do: []

  defp normalize_subtype(subtype) when is_binary(subtype) do
    subtype = subtype |> String.trim() |> String.downcase()
    if subtype == "", do: nil, else: subtype
  end

  defp normalize_subtype(_), do: nil

  defp get_filter(filter, key) when is_map(filter),
    do: Map.get(filter, key) || Map.get(filter, to_string(key))

  defp get_filter(_, _), do: nil

  defp normalize_usage_result(nil), do: %{asset_count: 0, storage_bytes: 0}

  defp normalize_usage_result(%{storage_bytes: %Decimal{} = bytes} = result) do
    %{result | storage_bytes: Decimal.to_integer(bytes)}
  end

  defp normalize_usage_result(result), do: result

  defp find_active_asset(community_id, asset_id) do
    community_id
    |> CommunityAsset.active_query(asset_id)
    |> Repo.one()
    |> case do
      nil -> {:error, ErrorCat.not_exist("asset not found")}
      asset -> {:ok, asset}
    end
  end
end
