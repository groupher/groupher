import type { PagiInput, PagiPageInfo, PagiPage } from '@groupher/contracts/pagination'

import type { PagiMode } from '~/lib/graphql/generated/graphql'

/** Transport-neutral pagination request used by Core adapters. */
export type TPaginationApi = 'offset' | 'cursor'
export type TPaginationMode = PagiMode

export type TOffsetPagi = {
  api: 'offset'
  page: number
  size: number
  configRevision?: number
}

export type TCursorPagi = {
  api: 'cursor'
  first: number
  after?: string
  configRevision?: number
}

export type TPagiRequest = TOffsetPagi | TCursorPagi

export type TPagiGraphQLInput = PagiInput

export type TEffectivePagiConfig = {
  api: TPaginationApi
  mode: TPaginationMode
  schemaVersion: number
  revision: number
  defaultSize: number
  maxSize: number
}

export type TPagiPreference = {
  pagiMode?: TPaginationMode
  pagiMobileMode?: TPaginationMode
  pagiRevision?: number
}

export type TOffsetPageInfo = Extract<PagiPageInfo, { __typename: 'OffsetPageInfo' }> & {
  api: 'offset'
}
export type TCursorPageInfo = Extract<PagiPageInfo, { __typename: 'CursorPageInfo' }> & {
  api: 'cursor'
}
export type TPagiPageInfo = TOffsetPageInfo | TCursorPageInfo
export type TGraphQLPagiPageInfo = PagiPageInfo
export type TPagiPage<T> = PagiPage<T>
