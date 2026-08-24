import { graphql } from '~/graphql/authoring'

export const subscribedCommunities = graphql(`
  query PageSubscribedCommunities($login: String, $filter: PagiFilter!) {
    subscribedCommunities(login: $login, filter: $filter) {
      entries {
        ...PageCommunityFields
        contributesDigest
      }
      ...PageCommunityPageInfo
    }
  }
`)

// Keep the dashboard's large selection inline so it remains one static document
// while the list/detail-independent operations share generated fragments.
export const community = graphql(`
  query PageCommunity($slug: String!, $userHasLogin: Boolean!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      title
      slug
      index
      desc
      logo
      subscribersCount
      homepage
      articlesCount
      views
      pending
      insertedAt
      updatedAt
      viewerHasSubscribed @include(if: $userHasLogin)
      contributesDigest
      moderatorsCount
      meta {
        postsCount
        blogsCount
      }
      moderators {
        isRoot
        passportItemCount
        user {
          login
          avatar
          nickname
          bio
        }
      }
      dashboard {
        baseInfo {
          title
          slug
          locale
          favicon
          homepage
          logo
          desc
          city
          techstack
          introduction
        }
        mediaReports {
          url
          title
          siteName
          favicon
          index
        }
        thirdPartyAnalytics {
          provider
          enabled
          measurementId
          containerId
          projectId
          domain
          siteId
        }
        enabledThirdPartyAnalytics {
          provider
          enabled
          measurementId
          containerId
          projectId
          domain
          siteId
        }
        umamiWebsiteId
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
        wallpaper {
          light {
            type
            source
            gradient
            pattern
            contentShadow
            effect
            texture
          }
          dark {
            type
            source
            gradient
            pattern
            contentShadow
            effect
            texture
          }
        }
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
        footerLinks {
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
        footerOnelineLinks {
          id
          title
          url
        }
        socialLinks {
          type
          link
        }
        seo {
          seoEnable
          ogSiteName
          ogTitle
          ogDescription
          ogUrl
          ogImage
          twTitle
          twDescription
          twUrl
          twCard
          twSite
          twImage
          twImageWidth
          twImageHeight
        }
        nameAlias {
          slug
          name
          original
          group
        }
        layout {
          themePreset
          themePresetBase
          themeTokens
          themePresets {
            value
            tokens
          }
          postLayout
          docCoverLayout
          docFaqLayout
          tagLayout
          inlineTagLayout
          avatarLayout
          brandLayout
          communityLayout
          navActiveLayout
          topbarEnabled
          topbarBg
          topbarBgCustomColor
          broadcastLayout
          broadcastBg
          broadcastCustomBg
          broadcastArticleBg
          broadcastArticleCustomBg
          kanbanLayout
          kanbanCardLayout
          kanbanBoards
          kanbanBgColors
          changelogLayout
          headerLayout
          footerLayout
          overlayDark
          broadcastEnable
        }
        enable {
          post
          kanban
          changelog
          doc
          docLastUpdate
          docReaction
          about
          aboutTechstack
          aboutLocation
          aboutLinks
          aboutMediaReport
          visitorLocationMap
        }
      }
    }
  }
`)

export const pagedCommunities = graphql(`
  query PagePagedCommunities($filter: CommunitiesFilter!, $userHasLogin: Boolean!) {
    pagedCommunities(filter: $filter) {
      entries {
        ...PageCommunityFields
        contributesDigest
        viewerHasSubscribed @include(if: $userHasLogin)
      }
      ...PageCommunityPageInfo
    }
  }
`)
