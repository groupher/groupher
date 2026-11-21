import { graphql } from '~/graphql/authoring'

export const setTag = graphql(`
  "Set a community_tag to content"
  mutation SetCommunityTag($article: ArticlePathInput!, $tagId: ID!, $commandId: ID!) {
    setCommunityTag(article: $article, communityTagId: $tagId, commandId: $commandId) {
      innerId
      title
    }
  }
`)

export const unsetTag = graphql(`
  "Unset a tag to content"
  mutation UnsetCommunityTag($article: ArticlePathInput!, $tagId: ID!, $commandId: ID!) {
    unsetCommunityTag(article: $article, communityTagId: $tagId, commandId: $commandId) {
      innerId
      title
    }
  }
`)

export const follow = graphql(`
  "Follow a user"
  mutation Follow($login: String!) {
    follow(login: $login) {
      login
      viewerHasFollowed
    }
  }
`)

export const undoFollow = graphql(`
  "Unfollow a user"
  mutation UndoFollow($login: String!) {
    undoFollow(login: $login) {
      login
      viewerHasFollowed
    }
  }
`)
