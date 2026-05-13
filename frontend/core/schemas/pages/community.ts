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
        wallpaper {
          ${F.wallpaper}
        }
        headerLinks {
          ${F.headerLink}
        }
        footerLinks {
          ${F.headerLink}
        }
        footerOnelineLinks {
          ${F.footerOnelineLink}
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
          pageBg
          pageBgDark
          pageCustomBg
          pageCustomBgDark
          pageCustomIntensity
          pageCustomIntensityDark
          primaryColor
          primaryCustomColor
          primaryCustomColorDark
          subPrimaryColor
          subPrimaryCustomColor
          subPrimaryCustomColorDark
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
          glowType
          glowFixed
          glowOpacity
          overlayDark
          gaussBlur
          gaussBlurDark
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
