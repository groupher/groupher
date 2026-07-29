defmodule GroupherServer.Test.Helper.Schema.Asset do
  @moduledoc "GraphQL documents used by asset tests."

  def q(:community_asset_refs) do
    """
    query($community: String!, $assetId: ID!, $filter: PagiFilter) {
        communityAssetRefs(community: $community, assetId: $assetId, filter: $filter) {
          entries {
            id
            articleId
            usage
            source
          }
          totalCount
          totalPages
          pageSize
          pageNumber
        }
      }
    """
  end

  def q(:community_asset_origin_info) do
    """
    query($publicRef: String!) {
        communityAssetOriginInfo(publicRef: $publicRef) {
          publicRef
          status
          deletedAt
          filename
          storage
          storageKey
          mimeType
          sizeBytes
          width
          height
          meta
        }
      }
    """
  end
end
