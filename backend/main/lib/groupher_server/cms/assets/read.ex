defmodule GroupherServer.CMS.Assets.Read do
  @moduledoc """
  Read-side helpers for the community asset library.

  Billing-oriented reads only look at active rows in `community_assets`. Usage
  reads go through `article_document_asset_refs`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{ArticleDocumentAssetRef, Community, CommunityAsset}
  alias Helper.{ORM, T}

  @default_page 1
  @default_size 20

  @doc """
  Returns a page of active assets for a community.

  This read-side function is the implementation behind `CMS.Assets.page/2`.
  It applies the shared active-asset predicate and orders newest assets first.

  ## Examples

      Read.page(community, %{page: 1, size: 20})
      #=> {:ok, %{entries: assets, total_count: total_count}}

  """
  @spec page(Community.t(), map() | nil) :: T.domain_res(T.paged_data())
  def page(%Community{id: community_id}, filter) do
    %{page: page, size: size} = normalize_filter(filter)

    community_id
    |> CommunityAsset.active_query()
    |> order_by([asset], desc: asset.inserted_at, desc: asset.id)
    |> ORM.paginator(page: page, size: size)
    |> then(&{:ok, &1})
  end

  @doc """
  Returns active asset counts and storage bytes for one community.

  Usage is computed from `community_assets`, not from refs, so the same uploaded
  object is counted once regardless of how many articles reference it.

  ## Examples

      Read.usage(community)
      #=> {:ok, %{asset_count: 2, storage_bytes: 4096}}

  """
  @spec usage(Community.t()) :: T.domain_res(map())
  def usage(%Community{id: community_id}) do
    result =
      community_id
      |> CommunityAsset.active_query()
      |> select([asset], %{
        asset_count: count(asset.id),
        storage_bytes: coalesce(sum(asset.size_bytes), 0)
      })
      |> Repo.one()

    {:ok, normalize_usage_result(result)}
  end

  @doc """
  Returns a page of article document refs for one active asset.

  The asset lookup is scoped to the supplied community before refs are loaded,
  which prevents cross-community ref discovery.

  ## Examples

      Read.refs(community, asset.id, %{page: 1, size: 10})
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

  defp normalize_filter(nil), do: %{page: @default_page, size: @default_size}

  defp normalize_filter(filter) do
    %{
      page: Map.get(filter, :page, @default_page),
      size: Map.get(filter, :size, @default_size)
    }
  end

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
      nil -> {:error, {:not_exist, "asset not found"}}
      asset -> {:ok, asset}
    end
  end
end
