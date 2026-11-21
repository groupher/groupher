import { graphql } from '~/graphql/authoring'

export const communityBaseInfo = graphql(`
  "Spec community info"
  query DashboardCommunityBaseInfo($slug: String!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      ref
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
  "Spec community info"
  query DashboardCommunitySocialLinks($slug: String!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      ref
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
  "Spec community info"
  query DashboardCommunityOverview($slug: String!, $incViews: Boolean) {
    community(slug: $slug, incViews: $incViews) {
      ref
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
