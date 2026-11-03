import { graphql } from '~/graphql/authoring'

export const blog = graphql(`
  query Blog($article: ArticlePathInput!) {
    blog(article: $article) {
      innerId
      version
      isPinned
      title
      insertedAt
      activeAt
      updatedAt
      author {
        ...PageAuthorFields
      }
      community {
        ...PageCommunityFields
      }
      communities {
        ...PageCommunityFields
      }
      communityTags {
        ...PageTagFields
      }
      meta {
        thread
        isEdited
        latestUpvotedUsers {
          ...PageCommonUserFields
        }
      }
      body {
        json
        html
        markdown
        toc {
          id
          level
          title
        }
      }
      commentsParticipants {
        ...PageAuthorFields
      }
      lifecycle {
        state
        version
        archivedAt
      }
    }
  }
`)
