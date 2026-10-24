import { graphql } from '~/graphql/authoring'

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

export const pendingContentReviews = graphql(`
  query PendingContentReviews($scope: ReviewBotScopeInput!) {
    pendingContentReviews(scope: $scope) {
      artimentReviewId
      targetType
      articleId
      commentId
      branchId
      communityId
      state
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

export const approveArticleReview = graphql(`
  mutation ApproveArticleReview($target: CmsReviewTargetInput!, $commandId: ID!) {
    approveArticle(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)

export const approveCommentReview = graphql(`
  mutation ApproveCommentReview($target: CmsReviewTargetInput!, $commandId: ID!) {
    approveComment(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)

export const denyArticleReview = graphql(`
  mutation DenyArticleReview($target: CmsReviewTargetInput!, $commandId: ID!) {
    denyArticle(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)

export const releaseArticleReview = graphql(`
  mutation ReleaseArticleReview($target: CmsReviewTargetInput!, $commandId: ID!) {
    releaseArticle(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)

export const denyCommentReview = graphql(`
  mutation DenyCommentReview($target: CmsReviewTargetInput!, $commandId: ID!) {
    denyComment(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)

export const releaseCommentReview = graphql(`
  mutation ReleaseCommentReview($target: CmsReviewTargetInput!, $commandId: ID!) {
    releaseComment(target: $target, commandId: $commandId) {
      commandId
      targetType
      targetId
      action
    }
  }
`)
