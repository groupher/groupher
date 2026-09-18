import { graphql } from '~/graphql/authoring'

export const upvotePost = graphql(`
  mutation QueryUpvotePost($article: ArticlePathInput!, $commandId: ID!) {
    upvotePost(article: $article, commandId: $commandId) {
      innerId
      articleStats {
        upvotesCount
      }
      ... on Post {
        meta {
          latestUpvotedUsers {
            login
            nickname
            avatar
          }
        }
        viewerHasUpvoted
        viewerHasCollected
        viewerEmotion
        collectsCount
        articleInteractionRevision
        reactionOutcome
        emotions {
          type
          count
          latestUsers {
            login
            nickname
            avatar
          }
        }
      }
    }
  }
`)

export const undoUpvotePost = graphql(`
  mutation QueryUndoUpvotePost($article: ArticlePathInput!, $commandId: ID!) {
    undoUpvotePost(article: $article, commandId: $commandId) {
      innerId
      articleStats {
        upvotesCount
      }
      ... on Post {
        meta {
          latestUpvotedUsers {
            login
            nickname
            avatar
          }
        }
        viewerHasUpvoted
        viewerHasCollected
        viewerEmotion
        collectsCount
        articleInteractionRevision
        reactionOutcome
        emotions {
          type
          count
          latestUsers {
            login
            nickname
            avatar
          }
        }
      }
    }
  }
`)

export const upvoteChangelog = graphql(`
  mutation QueryUpvoteChangelog($article: ArticlePathInput!, $commandId: ID!) {
    upvoteChangelog(article: $article, commandId: $commandId) {
      innerId
      articleStats {
        upvotesCount
      }
      ... on Changelog {
        meta {
          latestUpvotedUsers {
            login
            nickname
            avatar
          }
        }
        viewerHasUpvoted
        viewerHasCollected
        viewerEmotion
        collectsCount
        articleInteractionRevision
        reactionOutcome
        emotions {
          type
          count
          latestUsers {
            login
            nickname
            avatar
          }
        }
      }
    }
  }
`)

export const undoUpvoteChangelog = graphql(`
  mutation QueryUndoUpvoteChangelog($article: ArticlePathInput!, $commandId: ID!) {
    undoUpvoteChangelog(article: $article, commandId: $commandId) {
      innerId
      articleStats {
        upvotesCount
      }
      ... on Changelog {
        meta {
          latestUpvotedUsers {
            login
            nickname
            avatar
          }
        }
        viewerHasUpvoted
        viewerHasCollected
        viewerEmotion
        collectsCount
        articleInteractionRevision
        reactionOutcome
        emotions {
          type
          count
          latestUsers {
            login
            nickname
            avatar
          }
        }
      }
    }
  }
`)

export const upvoteDoc = graphql(`
  mutation QueryUpvoteDoc($article: ArticlePathInput!, $commandId: ID!) {
    upvoteDoc(article: $article, commandId: $commandId) {
      innerId
      articleStats {
        upvotesCount
      }
      ... on Doc {
        meta {
          latestUpvotedUsers {
            login
            nickname
            avatar
          }
        }
        viewerHasUpvoted
        viewerHasCollected
        viewerEmotion
        collectsCount
        articleInteractionRevision
        reactionOutcome
        emotions {
          type
          count
          latestUsers {
            login
            nickname
            avatar
          }
        }
      }
    }
  }
`)

export const undoUpvoteDoc = graphql(`
  mutation QueryUndoUpvoteDoc($article: ArticlePathInput!, $commandId: ID!) {
    undoUpvoteDoc(article: $article, commandId: $commandId) {
      innerId
      articleStats {
        upvotesCount
      }
      ... on Doc {
        meta {
          latestUpvotedUsers {
            login
            nickname
            avatar
          }
        }
        viewerHasUpvoted
        viewerHasCollected
        viewerEmotion
        collectsCount
        articleInteractionRevision
        reactionOutcome
        emotions {
          type
          count
          latestUsers {
            login
            nickname
            avatar
          }
        }
      }
    }
  }
`)
