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
  @refs_limit 100

  @spec page(Community.t(), map() | nil) :: T.domain_res(T.paged_data())
  def page(%Community{id: community_id}, filter) do
    %{page: page, size: size} = normalize_filter(filter)

    CommunityAsset
    |> where([asset], asset.community_id == ^community_id)
    |> where([asset], is_nil(asset.deleted_at))
    |> where([asset], asset.status == :active)
    |> order_by([asset], desc: asset.inserted_at, desc: asset.id)
    |> ORM.paginator(page: page, size: size)
    |> then(&{:ok, &1})
  end

  @spec usage(Community.t()) :: T.domain_res(map())
  def usage(%Community{id: community_id}) do
    result =
      CommunityAsset
      |> where([asset], asset.community_id == ^community_id)
      |> where([asset], is_nil(asset.deleted_at))
      |> where([asset], asset.status == :active)
      |> select([asset], %{
        asset_count: count(asset.id),
        storage_bytes: coalesce(sum(asset.size_bytes), 0)
      })
      |> Repo.one()

    {:ok, normalize_usage_result(result)}
  end

  @spec refs(CommunityAsset.t()) :: T.domain_res(list(ArticleDocumentAssetRef.t()))
  def refs(%CommunityAsset{id: asset_id}) do
    ArticleDocumentAssetRef
    |> where([ref], ref.asset_id == ^asset_id)
    |> order_by([ref], desc: ref.inserted_at, desc: ref.id)
    |> limit(^@refs_limit)
    |> Repo.all()
    |> then(&{:ok, &1})
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
end
