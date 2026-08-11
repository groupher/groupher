import { graphql } from '~/graphql/authoring'

export const communityBaseInfo = graphql(`
  query DashboardCommunityBaseInfo($slug: String!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      dashboard {
        baseInfo {
          title
          locale
          favicon
          logo
          slug
          desc
          introduction
          homepage
          city
          techstack
        }
        mediaReports {
          url
          title
          siteName
          favicon
          index
        }
      }
    }
  }
`)

export const communitySocialLinks = graphql(`
  query DashboardCommunitySocialLinks($slug: String!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      dashboard {
        socialLinks {
          type
          link
        }
      }
    }
  }
`)

export const communityOverview = graphql(`
  query DashboardCommunityOverview($slug: String!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      views
      subscribersCount
      meta {
        postsCount
        changelogsCount
        docsCount
      }
    }
  }
`)

export default { communityBaseInfo, communitySocialLinks, communityOverview }
