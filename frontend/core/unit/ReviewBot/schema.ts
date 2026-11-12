import { graphql } from '~/graphql/authoring'

export const reviewBotConfig = graphql(`
  "Loads ReviewBot policy for a scope and subject type."
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
  "Updates ReviewBot policy for the requested scope and subject type."
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
