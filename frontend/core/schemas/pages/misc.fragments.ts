import { graphql } from '~/graphql/authoring'

export const PageCategoryPageInfo = graphql(`
  fragment PageCategoryPageInfo on PagedCategories {
    totalPages
    totalCount
    pageSize
    pageNumber
  }
`)
