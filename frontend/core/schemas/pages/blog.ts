import { graphql } from '~/graphql/authoring'

export const blog = graphql(`
  "Get blog by id"
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
        ...AuthorFields
      }
      community {
        ...CommunityFields
      }
      communities {
        ...CommunityFields
      }
      communityTags {
        ...TagFields
      }
      meta {
        thread
        isEdited
        latestUpvotedUsers {
          ...CommonUserFields
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
        ref
        login
        nickname
        avatar
      }
      lifecycle {
        state
        version
        archivedAt
      }
    }
  }
`)
