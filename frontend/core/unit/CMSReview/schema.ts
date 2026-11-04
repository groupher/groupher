import { graphql } from '~/graphql/authoring'
import type {
  RecheckArticleDocument,
  RecheckCommentDocument,
  RecheckDocDocument,
} from '~/graphql/generated/graphql'

export const contentReview = graphql(`
  query ContentReview($target: CmsReviewTargetInput!) {
    contentReview(target: $target) {
      artimentReviewId
      targetType
      articleId
      commentId
      branchId
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
  query ContentReviewNotice($target: CmsReviewTargetInput!) {
    contentReviewNotice(target: $target) {
      status
      failureCode
    }
  }
`)

export const pendingContentReviews = graphql(`
  query PendingContentReviews($scope: ReviewBotScopeInput!, $limit: Int, $offset: Int) {
    pendingContentReviews(scope: $scope, limit: $limit, offset: $offset) {
      artimentReviewId
      targetType
      articleId
      commentId
      branchId
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
