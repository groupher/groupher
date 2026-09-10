import { graphql } from '~/graphql/authoring'

export const upvotePost = graphql(`
  mutation QueryUpvotePost($article: ArticlePathInput!, $commandKey: ID!) {
    upvotePost(article: $article, commandKey: $commandKey) {
      innerId
      upvotesCount
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
        commandKey
        commandReplayed
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
  mutation QueryUndoUpvotePost($article: ArticlePathInput!, $commandKey: ID!) {
    undoUpvotePost(article: $article, commandKey: $commandKey) {
      innerId
      upvotesCount
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
        commandKey
        commandReplayed
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
  mutation QueryUpvoteChangelog($article: ArticlePathInput!, $commandKey: ID!) {
    upvoteChangelog(article: $article, commandKey: $commandKey) {
      innerId
      upvotesCount
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
        commandKey
        commandReplayed
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
  mutation QueryUndoUpvoteChangelog($article: ArticlePathInput!, $commandKey: ID!) {
    undoUpvoteChangelog(article: $article, commandKey: $commandKey) {
      innerId
      upvotesCount
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
        commandKey
        commandReplayed
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
  mutation QueryUpvoteDoc($article: ArticlePathInput!, $commandKey: ID!) {
    upvoteDoc(article: $article, commandKey: $commandKey) {
      innerId
      upvotesCount
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
        commandKey
        commandReplayed
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
  mutation QueryUndoUpvoteDoc($article: ArticlePathInput!, $commandKey: ID!) {
    undoUpvoteDoc(article: $article, commandKey: $commandKey) {
      innerId
      upvotesCount
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
        commandKey
        commandReplayed
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
