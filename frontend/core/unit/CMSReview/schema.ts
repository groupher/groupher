import { graphql } from '~/graphql/authoring'
import type {
  RecheckArticleDocument,
  RecheckCommentDocument,
  RecheckDocDocument,
} from '~/graphql/generated/graphql'

export const contentReview = graphql(`
  "Loads the current review for a content target."
  query ContentReview($target: CmsReviewTargetInput!) {
    contentReview(target: $target) {
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

export const contentReviewNotice = graphql(`
  "Loads the review notice for a content target."
  query ContentReviewNotice($target: CmsReviewTargetInput!) {
    contentReviewNotice(target: $target) {
      status
      failureCode
    }
  }
`)

export const pendingContentReviews = graphql(`
  "Lists pending content reviews in a review scope."
  query PendingContentReviews($scope: ReviewBotScopeInput!, $limit: Int, $offset: Int) {
    pendingContentReviews(scope: $scope, limit: $limit, offset: $offset) {
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

export const contentReviewHistory = graphql(`
  "Lists past reviews for a content target."
  query ContentReviewHistory($target: CmsReviewTargetInput!, $limit: Int, $offset: Int) {
    contentReviewHistory(target: $target, limit: $limit, offset: $offset) {
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
    $target: CmsReviewTargetInput!
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
    $target: CmsReviewTargetInput!
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

export const recheckDocReview = graphql(`
  mutation RecheckDoc(
    $target: CmsReviewTargetInput!
    $scope: ReviewBotScopeInput!
    $commandId: ID!
  ) {
    recheckDocV2(target: $target, scope: $scope, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`) as typeof RecheckDocDocument

export const approveArticleReview = graphql(`
  "Approves the current review of an article."
  mutation ApproveArticleReview($target: CmsReviewTargetInput!, $commandId: ID!) {
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
  mutation ApproveCommentReview($target: CmsReviewTargetInput!, $commandId: ID!) {
    approveCommentV2(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)

export const approveDocReview = graphql(`
  mutation ApproveDocReview($target: CmsReviewTargetInput!, $commandId: ID!) {
    approveDocV2(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)

export const rejectArticleReview = graphql(`
  "Rejects the current review of an article."
  mutation DenyArticleReview($target: CmsReviewTargetInput!, $commandId: ID!) {
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
  mutation DenyCommentReview($target: CmsReviewTargetInput!, $commandId: ID!) {
    rejectCommentV2(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)

export const rejectDocReview = graphql(`
  mutation DenyDocReview($target: CmsReviewTargetInput!, $commandId: ID!) {
    rejectDocV2(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)
