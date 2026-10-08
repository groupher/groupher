defmodule GroupherServer.Test.Helper.Schema.Dsb do
  @moduledoc "GraphQL documents used by dashboard tests."

  def m(:save_custom_theme_preset) do
    """
    mutation($community: String!, $commandId: ID!, $themePreset: DsbThemePreset!, $themePresetBase: DsbThemePreset!, $themeOverwrite: Json) {
          saveCustomThemePreset(community: $community, commandId: $commandId, themePreset: $themePreset, themePresetBase: $themePresetBase, themeOverwrite: $themeOverwrite) {
            layout {
                themePreset
                themePresetBase
                themeTokens
                themePresets {
                  value
                  tokens
                }
            }
          }
        }
    """
  end

  def m(:select_theme_preset) do
    """
    mutation($community: String!, $commandId: ID!, $themePreset: DsbThemePreset!) {
          selectThemePreset(community: $community, commandId: $commandId, themePreset: $themePreset) {
            layout {
                themePreset
                themePresetBase
                themeTokens
                themePresets {
                  value
                  tokens
                }
            }
          }
        }
    """
  end

  def m(:prepare_wallpaper_upload) do
    """
    mutation($community: String!, $input: WallpaperUploadPrepareInput!) {
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
    """
  end

  def m(:publish_wallpaper) do
    """
      mutation($community: String!, $input: WallpaperPublishInput!) {
      publishWallpaper(community: $community, input: $input) {
        version
      }
    }
    """
  end

  def m(:restore_wallpaper_snapshot) do
    """
    mutation($community: String!, $input: WallpaperRestoreSnapshotInput!) {
      restoreWallpaperSnapshot(community: $community, input: $input) {
        version
      }
    }
    """
  end

  def m(:update_dashboard_content_shadow) do
    """
    mutation($community: String!, $commandId: ID!, $enabled: Boolean!) {
      updateDashboardContentShadow(community: $community, commandId: $commandId, enabled: $enabled) {
        contentShadow
      }
    }
    """
  end

  def m(:update_dashboard_base_info) do
    """
    mutation($community: String!, $commandId: ID!, $homepage: String, $locale: String, $title: String, $slug: String, $desc: String, $introduction: String, $logo: String, $favicon: String, $city: String, $techstack: String) {
          updateDashboardBaseInfo(community: $community, commandId: $commandId, homepage: $homepage, locale: $locale, title: $title, slug: $slug, desc: $desc, introduction: $introduction, logo: $logo, favicon: $favicon, city: $city, techstack: $techstack) {
            baseInfo {
              title
              locale
              introduction
            }
          }
        }
    """
  end

  def m(:update_dashboard_seo) do
    """
    mutation($community: String!, $commandId: ID!, $ogTitle: String, $ogDescription: String, $seoEnable: Boolean) {
          updateDashboardSeo(community: $community, commandId: $commandId, ogTitle: $ogTitle, ogDescription: $ogDescription, seoEnable: $seoEnable) {
            seo {
              seoEnable
            }
          }
        }
    """
  end

  def m(:update_dashboard_enable) do
    """
    mutation($community: String!, $commandId: ID!, $post: Boolean, $changelog: Boolean) {
          updateDashboardEnable(community: $community, commandId: $commandId, post: $post, changelog: $changelog) {
            enable {
              post
              changelog
            }
          }
        }
    """
  end

  def m(:update_dashboard_thread_emotions) do
    """
    mutation($community: String!, $commandId: ID!, $post: [EmotionType!], $postComment: [EmotionType!], $docComment: [EmotionType!]) {
          updateDashboardThreadEmotions(
            community: $community
            commandId: $commandId
            post: $post
            postComment: $postComment
            docComment: $docComment
          ) {
            threadEmotions {
              post
              postComment
              docComment
            }
          }
        }
    """
  end

  def m(:update_dashboard_layout) do
    """
    mutation($community: String!, $commandId: ID!, $postLayout: DsbPostLayout, $kanbanLayout: DsbKanbanLayout, $kanbanCardLayout: DsbKanbanCardLayout, $footerLayout: DsbFooterLayout, $topbarEnabled: Boolean, $broadcastEnable: Boolean, $kanbanBgColors: [RainbowColor], $kanbanBoards: [KanbanBoard], $tagLayout: DsbTagLayout, $inlineTagLayout: DsbInlineTagLayout, $brandLayout: DsbBrandLayout, $communityLayout: DsbCommunityLayout, $navActiveLayout: DsbNavActiveLayout, $overlayDark: Boolean) {
          updateDashboardLayout(community: $community, commandId: $commandId, postLayout: $postLayout, kanbanLayout: $kanbanLayout, kanbanCardLayout: $kanbanCardLayout, footerLayout: $footerLayout, topbarEnabled: $topbarEnabled, broadcastEnable: $broadcastEnable, kanbanBgColors: $kanbanBgColors, kanbanBoards: $kanbanBoards, tagLayout: $tagLayout, inlineTagLayout: $inlineTagLayout, brandLayout: $brandLayout, communityLayout: $communityLayout, navActiveLayout: $navActiveLayout, overlayDark: $overlayDark) {
            layout {
              kanbanBoards
              footerLayout
              topbarEnabled
              tagLayout
              inlineTagLayout
              brandLayout
              communityLayout
              navActiveLayout
              overlayDark
            }
          }
        }
    """
  end

  def m(:update_dashboard_rss) do
    """
    mutation($community: String!, $commandId: ID!, $rssFeedType: DsbRssFeedType, $rssFeedCount: Int) {
          updateDashboardRss(community: $community, commandId: $commandId, rssFeedType: $rssFeedType, rssFeedCount: $rssFeedCount) {
            rss {
              rssFeedType
              rssFeedCount
            }
          }
        }
    """
  end

  def m(:update_dashboard_name_alias) do
    """
    mutation($community: String!, $commandId: ID!, $nameAlias: [DsbAliasMap]) {
          updateDashboardNameAlias(community: $community, commandId: $commandId, nameAlias: $nameAlias) {
            nameAlias {
              slug
              name
              original
              group
            }
          }
        }
    """
  end

  def m(:update_dashboard_header_links) do
    """
    mutation($community: String!, $commandId: ID!, $headerLinks: [DsbLinkMap]) {
          updateDashboardHeaderLinks(community: $community, commandId: $commandId, headerLinks: $headerLinks) {
            headerLinks {
              id
              type
              title
              url
              links {
                id
                title
                url
              }
            }
          }
        }
    """
  end

  def m(:update_dashboard_footer_links) do
    """
    mutation($community: String!, $commandId: ID!, $footerLinks: [DsbLinkMap]) {
          updateDashboardFooterLinks(community: $community, commandId: $commandId, footerLinks: $footerLinks) {
            footerLinks {
              id
              type
              title
              links {
                id
                title
                url
              }
            }
          }
        }
    """
  end

  def m(:update_dashboard_footer_oneline_links) do
    """
    mutation($community: String!, $commandId: ID!, $footerOnelineLinks: [DsbLinkChildMap]) {
          updateDashboardFooterOnelineLinks(
            community: $community,
            commandId: $commandId,
            footerOnelineLinks: $footerOnelineLinks
          ) {
            footerOnelineLinks {
              id
              title
              url
            }
            footerLinks {
              id
              title
            }
          }
        }
    """
  end

  def m(:update_dashboard_social_links) do
    """
    mutation($community: String!, $commandId: ID!, $socialLinks: [DsbSocialLinkMap]) {
          updateDashboardSocialLinks(community: $community, commandId: $commandId, socialLinks: $socialLinks) {
            socialLinks {
              type
              link
            }
          }
        }
    """
  end

  def m(:update_dashboard_media_reports) do
    """
    mutation($community: String!, $commandId: ID!, $mediaReports: [DsbMediaReportMap]) {
          updateDashboardMediaReports(community: $community, commandId: $commandId, mediaReports: $mediaReports) {
            mediaReports {
              title
              url
            }
          }
        }
    """
  end

  def m(:update_dashboard_doc_faq) do
    """
    mutation($community: String!, $commandId: ID!, $docFaq: DsbDocFaqInput!) {
          updateDashboardDocFaq(community: $community, commandId: $commandId, docFaq: $docFaq) {
            docFaq {
              title
              desc
              groupedView
              groupItems {
                id
                title
                index
                items {
                  id
                  title
                  detail
                  index
                }
              }
              flatItems {
                id
                title
                detail
                index
              }
            }
          }
        }
    """
  end

  def q(:content_shadow) do
    """
    query($community: String!) {
      community(slug: $community) {
      dashboard {
        contentShadow
      }
      }
    }
    """
  end

  def q(:wallpaper) do
    """
    query($community: String!, $theme: WallpaperTheme!) {
      community(slug: $community) {
        dashboard {
          wallpaper {
            version
            light {
              wide { url width height }
              desktop { url width height }
              tablet { url width height }
              phone { url width height }
            }
            dark {
              wide { url width height }
              desktop { url width height }
              tablet { url width height }
              phone { url width height }
            }
          }
          wallpaperSettings {
            light {
              settingsSchemaVersion
              type
              source
              customWallpaper { type assetPublicRef config }
              renderConfig
            }
            dark {
              settingsSchemaVersion
              type
              source
              customWallpaper { type assetPublicRef config }
              renderConfig
            }
          }
          wallpaperHistory(theme: $theme) {
            id
            theme
            settings {
              settingsSchemaVersion
              type
              source
              customWallpaper { type assetPublicRef config }
              renderConfig
            }
            savedAt
            active
          }
        }
      }
    }
    """
  end
end
