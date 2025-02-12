import type { TPagedArticles, TPagedComments, TPagedCommunities } from '~/spec'
import { PAGE_SIZE } from '~/config'

export const EMPTY_PAGED_ARTICLES = {
  entries: [],
  pageNumber: 1,
  pageSize: PAGE_SIZE.D,
  totalCount: 0,
  totalPages: 0,
} as TPagedArticles

export const EMPTY_PAGED_COMMENTS = {
  entries: [],
  pageNumber: 1,
  pageSize: PAGE_SIZE.D,
  totalCount: 0,
  totalPages: 0,
} as TPagedComments

export const EMPTY_PAGED_COMMUNITIES = {
  entries: [],
  pageNumber: 1,
  pageSize: PAGE_SIZE.D,
  totalCount: 0,
  totalPages: 0,
} as TPagedCommunities

export const EMPTY_TAG = { id: '', title: '', color: '', slug: '' }
