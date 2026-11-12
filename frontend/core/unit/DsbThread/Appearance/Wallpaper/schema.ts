import { graphql } from '~/graphql/authoring'

const wallpaperEditor = graphql(`
  "Spec community info"
  query WallpaperEditor($community: String!) {
    community(slug: $community) {
      dashboard {
        contentShadow
        wallpaperSettings {
          light {
            settingsSchemaVersion
            type
            source
            customWallpaper {
              type
              assetPublicRef
              config
            }
            renderConfig
          }
          dark {
            settingsSchemaVersion
            type
            source
            customWallpaper {
              type
              assetPublicRef
              config
            }
            renderConfig
          }
        }
        wallpaperHistoryLight: wallpaperHistory(theme: LIGHT) {
          id
          theme
          settings {
            settingsSchemaVersion
            type
            source
            customWallpaper {
              type
              assetPublicRef
              config
            }
            renderConfig
          }
          savedAt
          active
        }
        wallpaperHistoryDark: wallpaperHistory(theme: DARK) {
          id
          theme
          settings {
            settingsSchemaVersion
            type
            source
            customWallpaper {
              type
              assetPublicRef
              config
            }
            renderConfig
          }
          savedAt
          active
        }
      }
    }
  }
`)

const prepareWallpaperUpload = graphql(`
  "Prepares the generated images for one current-theme Wallpaper save"
  mutation PrepareWallpaperUpload($community: String!, $input: WallpaperUploadPrepareInput!) {
    prepareWallpaperUpload(community: $community, input: $input) {
      batchRef
      batchCapability
      expiresAt
      uploadIntents {
        capability
        uploadRef
        profile
      }
    }
  }
`)

const publishWallpaper = graphql(`
  "Publishes one current-theme Wallpaper Snapshot"
  mutation PublishWallpaper($community: String!, $input: WallpaperPublishInput!) {
    publishWallpaper(community: $community, input: $input) {
      version
    }
  }
`)

const updateDashboardContentShadow = graphql(`
  "Updates the Dashboard-owned content surface shadow"
  mutation UpdateDashboardContentShadow($community: String!, $enabled: Boolean!, $commandId: ID!) {
    updateDashboardContentShadow(community: $community, enabled: $enabled, commandId: $commandId) {
      contentShadow
    }
  }
`)

const restoreWallpaperSnapshot = graphql(`
  "Restores one retained Wallpaper Snapshot"
  mutation RestoreWallpaperSnapshot($community: String!, $input: WallpaperRestoreSnapshotInput!) {
    restoreWallpaperSnapshot(community: $community, input: $input) {
      version
    }
  }
`)

export default {
  wallpaperEditor,
  prepareWallpaperUpload,
  publishWallpaper,
  updateDashboardContentShadow,
  restoreWallpaperSnapshot,
}
