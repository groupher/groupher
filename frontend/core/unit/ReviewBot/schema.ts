import { graphql } from '~/graphql/authoring'

export const reviewBotConfig = graphql(`
  query ReviewBotConfig($scope: ReviewBotScopeInput!, $subjectType: ReviewBotSubjectType!) {
    reviewBotConfig(scope: $scope, subjectType: $subjectType) {
      id
      communityId
      subjectType
      reviewMode
      reviewBanWords
      reviewPrompt
      version
      updatedAt
    }
  }
`)

export const updateReviewBotConfig = graphql(`
  mutation UpdateReviewBotConfig($input: UpdateReviewBotConfigInput!, $commandId: ID!) {
    updateReviewBotConfig(input: $input, commandId: $commandId) {
      id
      reviewMode
      reviewBanWords
      reviewPrompt
      version
    }
  }
`)
