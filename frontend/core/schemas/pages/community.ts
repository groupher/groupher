import { graphql } from '~/graphql/authoring'

export const subscribedCommunities = graphql(`
  "Anyone can get anyone's subscribed communities"
  query PagedSubscribedCommunities($login: String!, $filter: UserListFilter, $pagi: PagiInput) {
    subscribedCommunities(login: $login, filter: $filter, pagi: $pagi) {
      entries {
        ...CommunityFields
        contributesDigest
      }
      ...PagedCommunitiesPageInfo
    }
  }
`)

// Keep the dashboard's large selection inline so it remains one static document
// while the list/detail-independent operations share generated fragments.
export const community = graphql(`
  "Spec community info"
  query Community($slug: String!, $userHasLogin: Boolean!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      ref
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
      adminsCount
      meta {
        postsCount
        blogsCount
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
        pagiMode
        pagiMobileMode
        pagiRevision
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
          version
          lightSource
          darkSource
          light {
            wide {
              url
              width
              height
            }
            desktop {
              url
              width
              height
            }
            tablet {
              url
              width
              height
            }
            phone {
              url
              width
              height
            }
          }
          dark {
            wide {
              url
              width
              height
            }
            desktop {
              url
              width
              height
            }
            tablet {
              url
              width
              height
            }
            phone {
              url
              width
              height
            }
          }
        }
        contentShadow
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
  "Communities with pagination info"
  query PagedCommunities($filter: CommunitiesFilter, $pagi: PagiInput, $userHasLogin: Boolean!) {
    pagedCommunities(filter: $filter, pagi: $pagi) {
      entries {
        ...CommunityFields
        contributesDigest
        viewerHasSubscribed @include(if: $userHasLogin)
      }
      ...PagedCommunitiesPageInfo
    }
  }
`)
