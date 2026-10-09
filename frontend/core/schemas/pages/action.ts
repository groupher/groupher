import { graphql } from '~/graphql/authoring'

export const setTag = graphql(`
  mutation SetCommunityTag($article: ArticlePathInput!, $tagId: ID!, $commandId: ID!) {
    setCommunityTag(article: $article, communityTagId: $tagId, commandId: $commandId) {
      innerId
      title
    }
  }
`)

export const unsetTag = graphql(`
  mutation UnsetCommunityTag($article: ArticlePathInput!, $tagId: ID!, $commandId: ID!) {
    unsetCommunityTag(article: $article, communityTagId: $tagId, commandId: $commandId) {
      innerId
      title
    }
  }
`)

export const follow = graphql(`
  mutation Follow($login: String!) {
    follow(login: $login) {
      login
      viewerHasFollowed
    }
  }
`)

export const undoFollow = graphql(`
  mutation UndoFollow($login: String!) {
    undoFollow(login: $login) {
      login
      viewerHasFollowed
    }
  }
`)
