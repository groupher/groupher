import { graphql } from '~/graphql/authoring'

export const createCommunityAssetUploadIntent = graphql(`
  "Create a short-lived assets-hub upload intent"
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
  "Paged assets owned by a community"
  query PagedCommunityAssets($community: String!, $filter: CommunityAssetFilter, $pagi: PagiInput) {
    pagedCommunityAssets(community: $community, filter: $filter, pagi: $pagi) {
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
      pageInfo {
        __typename
        hasNextPage
        hasPreviousPage
        ... on OffsetPageInfo {
          page
          size
          totalCount
          totalPages
        }
        ... on CursorPageInfo {
          startCursor
          endCursor
        }
      }
    }
  }
`)

export const communityAssetStats = graphql(`
  "Community asset filter stats and storage quota"
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
  "Paged article references for one community asset"
  query CommunityAssetRefs($community: String!, $assetId: ID!, $pagi: PagiInput) {
    communityAssetRefs(community: $community, assetId: $assetId, pagi: $pagi) {
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
      pageInfo {
        __typename
        hasNextPage
        hasPreviousPage
        ... on OffsetPageInfo {
          page
          size
          totalCount
          totalPages
        }
        ... on CursorPageInfo {
          startCursor
          endCursor
        }
      }
    }
  }
`)

export const deleteCommunityAsset = graphql(`
  "Delete an unreferenced community asset from the asset library"
  mutation DeleteCommunityAsset($community: String!, $id: ID!, $commandId: ID!) {
    deleteCommunityAsset(community: $community, id: $id, commandId: $commandId) {
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
