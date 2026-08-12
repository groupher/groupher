import { graphql } from '~/graphql/authoring'

export const KanbanAuthorFields = graphql(`
  fragment KanbanAuthorFields on User {
    login
    nickname
    avatar
    bio
    shortbio
  }
`)

export const KanbanPageFields = graphql(`
  fragment KanbanPageFields on PagedPosts {
    totalPages
    totalCount
    pageSize
    pageNumber
  }
`)
