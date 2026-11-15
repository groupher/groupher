import { graphql } from '~/graphql/authoring'
import type { RecheckArticleDocument, RecheckCommentDocument } from '~/graphql/generated/graphql'

export const artimentReview = graphql(`
  "Loads the current review for a content target."
  query ContentReview($target: ArtimentReviewTargetInput!) {
    artimentReview(target: $target) {
      artimentReviewId
      targetType
      articleId
      commentId
      communityId
      state
      replacedAt
      outdatedAt
      failureCode
      failureMessage
      reviewMode
      systemOpinion {
        status
        summary
        susNotes {
          type
          evidence
          explanation
        }
      }
      communityOpinion {
        status
        summary
        susNotes {
          type
          evidence
          explanation
        }
      }
    }
  }
`)

export const artimentReviewNotice = graphql(`
  "Loads the review notice for a content target."
  query ContentReviewNotice($target: ArtimentReviewTargetInput!) {
    artimentReviewNotice(target: $target) {
      status
      failureCode
    }
  }
`)

export const pendingArtimentReviews = graphql(`
  "Lists pending content reviews in a review scope."
  query PendingContentReviews($scope: ReviewBotScopeInput!, $limit: Int, $offset: Int) {
    pendingArtimentReviews(scope: $scope, limit: $limit, offset: $offset) {
      artimentReviewId
      targetType
      articleId
      commentId
      communityId
      state
      replacedAt
      outdatedAt
      failureCode
      failureMessage
      reviewMode
      systemOpinion {
        status
        summary
        susNotes {
          type
          evidence
          explanation
        }
      }
      communityOpinion {
        status
        summary
        susNotes {
          type
          evidence
          explanation
        }
      }
    }
  }
`)

export const artimentReviewHistory = graphql(`
  "Lists past reviews for a content target."
  query ContentReviewHistory($target: ArtimentReviewTargetInput!, $limit: Int, $offset: Int) {
    artimentReviewHistory(target: $target, limit: $limit, offset: $offset) {
      artimentReviewId
      targetType
      state
      replacedAt
      outdatedAt
      failureCode
      failureMessage
      reviewMode
      systemOpinion {
        status
        summary
        susNotes {
          type
          evidence
          explanation
        }
      }
      communityOpinion {
        status
        summary
        susNotes {
          type
          evidence
          explanation
        }
      }
    }
  }
`)

export const recheckArticleReview = graphql(`
  "Requests another review of an article in the given scope."
  mutation RecheckArticle(
    $target: ArtimentReviewTargetInput!
    $scope: ReviewBotScopeInput!
    $commandId: ID!
  ) {
    recheckArticleV2(target: $target, scope: $scope, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`) as typeof RecheckArticleDocument

export const recheckCommentReview = graphql(`
  "Requests another review of a comment in the given scope."
  mutation RecheckComment(
    $target: ArtimentReviewTargetInput!
    $scope: ReviewBotScopeInput!
    $commandId: ID!
  ) {
    recheckCommentV2(target: $target, scope: $scope, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`) as typeof RecheckCommentDocument

export const approveArticleReview = graphql(`
  "Approves the current review of an article."
  mutation ApproveArticleReview($target: ArtimentReviewTargetInput!, $commandId: ID!) {
    approveArticleV2(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)

export const approveCommentReview = graphql(`
  "Approves the current review of a comment."
  mutation ApproveCommentReview($target: ArtimentReviewTargetInput!, $commandId: ID!) {
    approveCommentV2(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)

export const rejectArticleReview = graphql(`
  "Rejects the current review of an article."
  mutation DenyArticleReview($target: ArtimentReviewTargetInput!, $commandId: ID!) {
    rejectArticleV2(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)

export const rejectCommentReview = graphql(`
  "Rejects the current review of a comment."
  mutation DenyCommentReview($target: ArtimentReviewTargetInput!, $commandId: ID!) {
    rejectCommentV2(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)
