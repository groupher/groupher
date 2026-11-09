import { createServerFn } from '@tanstack/react-start'

/** Resolves the deployment's initial Dash community without assuming a home row exists. */
export const loadDefaultCommunity = createServerFn({ method: 'GET' }).handler(
  () => process.env.DASH_DEFAULT_COMMUNITY?.trim() || 'home',
)
