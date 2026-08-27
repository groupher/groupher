import { graphql } from '~/graphql/authoring'

export const createCommunityAssetUploadIntent = graphql(`
  mutation CreateCommunityAssetUploadIntent(
    $community: String!
    $file: CommunityAssetUploadFileInput!
  ) {
    createCommunityAssetUploadIntent(community: $community, file: $file) {
      uploadRef
      assetPublicRef
      objectKey
      capability
      expiresAt
      maxSizeBytes
      allowedMimeTypes
    }
  }
`)

export const pagedCommunityAssets = graphql(`
  query PagedCommunityAssets($community: String!, $filter: CommunityAssetFilter) {
    pagedCommunityAssets(community: $community, filter: $filter) {
      entries {
        id
        publicRef
        thread
        assetType
        status
        filename
        mimeType
        sizeBytes
        storage
        storageKey
        contentHash
        width
        height
        url
        uploader {
          login
          nickname
        }
        deletedAt
        insertedAt
      }
      pageNumber
      pageSize
      totalCount
      totalPages
    }
  }
`)

export const communityAssetStats = graphql(`
  query CommunityAssetStats($community: String!, $filter: CommunityAssetFilter) {
    communityAssetStats(community: $community, filter: $filter) {
      totalCount
      storageBytes
      storageLimitBytes
      byThread {
        thread
        count
      }
      byAssetType {
        assetType
        count
        subtypes {
          key
          label
          count
        }
      }
    }
  }
`)

export const communityAssetRefs = graphql(`
  query CommunityAssetRefs($community: String!, $assetId: ID!, $filter: PagiFilter) {
    communityAssetRefs(community: $community, assetId: $assetId, filter: $filter) {
      entries {
        id
        thread
        articleId
        usage
        blockId
        blockType
        position
        title
        alt
        source
        insertedAt
      }
      pageNumber
      pageSize
      totalCount
      totalPages
    }
  }
`)

export const deleteCommunityAsset = graphql(`
  mutation DeleteCommunityAsset($community: String!, $id: ID!) {
    deleteCommunityAsset(community: $community, id: $id) {
      id
      publicRef
      status
      deletedAt
    }
  }
`)

export default {
  createCommunityAssetUploadIntent,
  pagedCommunityAssets,
  communityAssetStats,
  communityAssetRefs,
  deleteCommunityAsset,
}
