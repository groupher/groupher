import { graphql } from '~/graphql/authoring'

export const articleCoAuthorPermissions = graphql(`
  query DashboardArticleCoAuthorPermissions($articleId: ID!) {
    articlePermissions(articleId: $articleId) {
      articleId
      isOwner
      permissions
    }
  }
`)

export const articleCoAuthorMembers = graphql(`
  query DashboardPagedArticleCoAuthors($articleId: ID!, $pagi: PagiInput) {
    pagedArticleCoAuthors(articleId: $articleId, pagi: $pagi) {
      entries {
        memberId
        articleId
        revision
        permissions
        user {
          login
          nickname
          avatar
        }
      }
      pageInfo {
        __typename
        hasNextPage
        hasPreviousPage
        ... on OffsetPageInfo {
          page
          size
          totalCount
          totalPages
        }
      }
    }
  }
`)

export const articleCoAuthorRequests = graphql(`
  query DashboardPagedArticleCoAuthorRequests($articleId: ID!, $pagi: PagiInput) {
    pagedArticleCoAuthorRequests(articleId: $articleId, pagi: $pagi) {
      entries {
        id
        type
        status
        decision
        revision
        proposedPermissions
        approvedPermissions
        subjectUser {
          login
          nickname
          avatar
        }
        createdBy {
          login
          nickname
          avatar
        }
      }
      pageInfo {
        __typename
        hasNextPage
        hasPreviousPage
        ... on OffsetPageInfo {
          page
          size
          totalCount
          totalPages
        }
      }
    }
  }
`)

export const articleCoAuthorCandidates = graphql(`
  query DashboardArticleCoAuthorCandidates($articleId: ID!, $name: String!) {
    articleCoAuthorCandidates(articleId: $articleId, name: $name) {
      ...UserSearchFields
    }
  }
`)

export const createArticleCoAuthorRequest = graphql(`
  mutation DashboardCreateArticleCoAuthorRequest(
    $articleId: ID!
    $subjectLogin: String
    $type: ArticleCoAuthorRequestType!
    $permissions: Json!
    $commandId: ID!
  ) {
    createArticleCoAuthorRequest(
      articleId: $articleId
      subjectLogin: $subjectLogin
      type: $type
      permissions: $permissions
      commandId: $commandId
    ) {
      id
      revision
      status
    }
  }
`)

export const decideArticleCoAuthorRequest = graphql(`
  mutation DashboardDecideArticleCoAuthorRequest(
    $requestId: ID!
    $revision: Int!
    $decision: ArticleCoAuthorDecision!
    $approvedPermissions: Json
    $commandId: ID!
  ) {
    decideArticleCoAuthorRequest(
      requestId: $requestId
      revision: $revision
      decision: $decision
      approvedPermissions: $approvedPermissions
      commandId: $commandId
    ) {
      id
      revision
      status
    }
  }
`)

export const cancelArticleCoAuthorRequest = graphql(`
  mutation DashboardCancelArticleCoAuthorRequest(
    $requestId: ID!
    $revision: Int!
    $commandId: ID!
  ) {
    cancelArticleCoAuthorRequest(
      requestId: $requestId
      revision: $revision
      commandId: $commandId
    ) {
      id
      revision
      status
    }
  }
`)

export const updateArticleCoAuthorPermissions = graphql(`
  mutation DashboardUpdateArticleCoAuthorPermissions(
    $articleId: ID!
    $memberId: ID!
    $revision: Int!
    $permissions: Json!
    $commandId: ID!
  ) {
    updateArticleCoAuthorPermissions(
      articleId: $articleId
      memberId: $memberId
      revision: $revision
      permissions: $permissions
      commandId: $commandId
    ) {
      memberId
      revision
      permissions
    }
  }
`)

export const removeArticleCoAuthor = graphql(`
  mutation DashboardRemoveArticleCoAuthor(
    $articleId: ID!
    $memberId: ID!
    $revision: Int!
    $commandId: ID!
  ) {
    removeArticleCoAuthor(
      articleId: $articleId
      memberId: $memberId
      revision: $revision
      commandId: $commandId
    ) {
      memberId
      revision
    }
  }
`)
