import { paginationDefaultV1 } from '@groupher/contracts/pagination'

import type {
  TPagiPageInfo,
  TGraphQLPagiPageInfo,
  TEffectivePagiConfig,
  TPagiPreference,
  TPagiGraphQLInput,
  TPagiRequest,
  TOffsetPagi,
  TCursorPagi,
} from '~/spec'

/** The platform fallback used before a community exposes an effective surface config. */
export const DEFAULT_EFFECTIVE_PAGI_CONFIG: TEffectivePagiConfig = {
  ...paginationDefaultV1,
  mode: paginationDefaultV1.mode.toUpperCase() as TEffectivePagiConfig['mode'],
}

/** Derives all list execution defaults from the community-wide product preference. */
export const toEffectivePagiConfig = (
  preference?: TPagiPreference | null,
  mobile = false,
): TEffectivePagiConfig => {
  const mode = mobile
    ? (preference?.pagiMobileMode ?? 'INFINITE_SCROLL')
    : (preference?.pagiMode ?? 'PAGE')
  return {
    ...DEFAULT_EFFECTIVE_PAGI_CONFIG,
    mode,
    api: mode === 'PAGE' ? 'offset' : 'cursor',
    revision: preference?.pagiRevision ?? 0,
  }
}

/** Maps the Core discriminated union to the GraphQL @oneOf input shape. */
export const toPagiGraphQLInput = (pagi: TPagiRequest): TPagiGraphQLInput => {
  if (pagi.api === 'offset') return { offset: toOffsetInput(pagi) }
  return { cursor: toCursorInput(pagi) }
}

/** Returns the config identity that must be part of every list query key. */
export const pagiConfigKey = (config: TEffectivePagiConfig) => ({
  api: config.api,
  mode: config.mode,
  schemaVersion: config.schemaVersion,
  revision: config.revision,
})

/** Adds the transport discriminator that GraphQL intentionally keeps out of PageInfo fields. */
export const toPagiPageInfo = (pageInfo: TGraphQLPagiPageInfo): TPagiPageInfo => {
  if (pageInfo.__typename === 'OffsetPageInfo') return { ...pageInfo, api: 'offset' }
  return { ...pageInfo, api: 'cursor' }
}

const toOffsetInput = (pagi: TOffsetPagi) => ({
  page: pagi.page,
  size: pagi.size,
  ...(pagi.configRevision === undefined ? {} : { configRevision: pagi.configRevision }),
})

const toCursorInput = (pagi: TCursorPagi) => ({
  first: pagi.first,
  ...(pagi.after === undefined ? {} : { after: pagi.after }),
  ...(pagi.configRevision === undefined ? {} : { configRevision: pagi.configRevision }),
})

/** URL position selects the API; bootstrap contributes current limits and revision only. */
export const resolvePagiPosition = (
  config: TEffectivePagiConfig,
  search: Pick<URLSearchParams, 'get'>,
  keys: { api: string; page: string; after: string },
) => {
  const explicit = search.get(keys.api)
  const api =
    explicit === 'offset' || explicit === 'cursor'
      ? explicit
      : search.get(keys.after)
        ? 'cursor'
        : search.get(keys.page) !== null
          ? 'offset'
          : config.api
  const pageValue = Number(search.get(keys.page) || 1)
  return {
    config: {
      ...config,
      api,
      mode:
        api === 'offset'
          ? ('PAGE' as const)
          : config.mode === 'PAGE'
            ? ('LOAD_MORE' as const)
            : config.mode,
    },
    page: Number.isInteger(pageValue) && pageValue >= 1 ? pageValue : 1,
    initialAfter: api === 'cursor' ? search.get(keys.after) || undefined : undefined,
  }
}
