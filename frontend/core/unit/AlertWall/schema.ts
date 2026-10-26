import { graphql } from '~/graphql/authoring'
import type { ResolveAlertItemDocument } from '~/graphql/generated/graphql'

export const alertItems = graphql(`
  query AlertItems($scope: ReviewBotScopeInput!, $filter: AlertItemFilter, $pagi: PagiInput) {
    alertItems(scope: $scope, filter: $filter, pagi: $pagi) {
      entries {
        id
        owner
        targetType
        targetId
        communityId
        aiSourceRef
        status
        susNotes {
          type
          evidence
          explanation
        }
        summary
        reportCount
        totalReportCount
        version
        openedAt
      }
      pageInfo {
        ... on OffsetPageInfo {
          totalCount
          totalPages
          hasPreviousPage
          hasNextPage
        }
        ... on CursorPageInfo {
          hasPreviousPage
          hasNextPage
        }
      }
    }
  }
`)

export const alertItemReports = graphql(`
  query AlertItemReports($id: ID!, $pagi: PagiInput) {
    alertItemReports(id: $id, pagi: $pagi) {
      entries {
        id
        reportType
        reporterLogin
        details
        observedVersion
        insertedAt
        withdrawnAt
        outdatedAt
        resolvedAt
      }
      pageInfo {
        ... on OffsetPageInfo {
          totalPages
          hasPreviousPage
          hasNextPage
        }
      }
    }
  }
`)

export const resolveAlertItem = graphql(`
  mutation ResolveAlertItem(
    $id: ID!
    $resolution: String!
    $expectedVersion: Int!
    $commandId: ID!
  ) {
    resolveAlertItem(
      id: $id
      resolution: $resolution
      expectedVersion: $expectedVersion
      commandId: $commandId
    ) {
      itemId
      resolution
    }
  }
`) as typeof ResolveAlertItemDocument

export const myReports = graphql(`
  query MyReports($pagi: PagiInput) {
    myReports(pagi: $pagi) {
      entries {
        id
        targetType
        targetId
        communityId
        itemId
        reportType
        details
        withdrawnAt
        outdatedAt
        resolvedAt
        resolution
        insertedAt
      }
      pageInfo {
        ... on OffsetPageInfo {
          totalCount
          totalPages
          hasPreviousPage
          hasNextPage
        }
        ... on CursorPageInfo {
          hasPreviousPage
          hasNextPage
        }
      }
    }
  }
`)

export const submitReport = graphql(`
  mutation SubmitReport($input: AlertReportInput!, $commandId: ID!) {
    submitReport(input: $input, commandId: $commandId) {
      id
      reportType
    }
  }
`)

export const withdrawReport = graphql(`
  mutation WithdrawReport($reportId: ID!, $commandId: ID!) {
    withdrawReport(reportId: $reportId, commandId: $commandId) {
      id
      withdrawnAt
    }
  }
`)
