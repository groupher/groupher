import F from '../fragments'

// contributesDigest
export const subscribedCommunities = `
  query subscribedCommunities($login: String, $filter: PagiFilter!) {
    subscribedCommunities(login: $login, filter: $filter) {
      entries {
        ${F.community}
        contributesDigest
      }
      ${F.pagi}
    }
  }
`

export const community = `
  query community($slug: String!, $userHasLogin: Boolean!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      ${F.community}
      viewerHasSubscribed @include(if: $userHasLogin)
      threads {
        title
        slug
        index
      }
      contributesDigest
      moderatorsCount
      meta {
        postsCount
        blogsCount
      }
      moderators {
        role
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
        wallpaper {
          ${F.wallpaper}
        }
        headerLinks {
          ${F.customLink}
        }
        footerLinks {
          ${F.customLink}
        }
        socialLinks {
          type
          link
        }
        seo {
          ${F.seo}
        }
        nameAlias {
          slug
          name
          original
          group
        }
        layout {
          primaryColor
          postLayout
          docLayout
          docFaqLayout
          tagLayout
          avatarLayout
          brandLayout
          bannerLayout
          topbarLayout
          topbarBg
          broadcastLayout
          kanbanLayout
          kanbanCardLayout
          kanbanBgColors
          changelogLayout
          headerLayout
          footerLayout
          glowType
          glowFixed
          glowOpacity
          gossBlur
          gossBlurDark
          broadcastEnable
        } 

        rss {
          rssFeedType
          rssFeedCount
        }

        enable {
          post
          kanban
          changelog
          doc
          about
        }
      }
    }
  }
`
export const pagedCommunities = `
  query($filter: CommunitiesFilter!, $userHasLogin: Boolean!) {
    pagedCommunities(filter: $filter) {
      entries {
        ${F.community}
        contributesDigest
        viewerHasSubscribed @include(if: $userHasLogin)
      }
      ${F.pagi}
    }
  }
`
