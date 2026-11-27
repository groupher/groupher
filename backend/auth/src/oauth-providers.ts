/**
 * Static OAuth provider definitions for Auth login and linking.
 *
 * Provider ID -> registered protocol and identity mapping -> Auth flow
 */
import GitHub from '@auth/core/providers/github'

import { GITHUB_ENDPOINTS, exchangeGithubCodeForIdentity, githubAuthorizationUrl } from './github'
import {
  LINUXDO_ENDPOINTS,
  exchangeLinuxDoCodeForIdentity,
  linuxDoAuthorizationUrl,
  linuxDoIdentity,
  linuxDoProvider,
} from './linuxdo'

export const OAUTH_PROVIDERS = {
  github: {
    auth: () =>
      GitHub({
        authorization: {
          url: GITHUB_ENDPOINTS.authorization,
          params: { scope: 'read:user user:email' },
        },
        token: GITHUB_ENDPOINTS.token,
        userinfo: { url: GITHUB_ENDPOINTS.userinfo },
      }),
    callback: 'separate',
    endpoints: GITHUB_ENDPOINTS,
    authorizationUrl: githubAuthorizationUrl,
    exchange: exchangeGithubCodeForIdentity,
    identity: (profile: Record<string, unknown>, id: string) => ({
      provider: 'github',
      providerId: id,
      login: profile.login,
      nickname: profile.name,
      avatar: profile.avatar_url,
      bio: profile.bio,
      country: '',
      city: profile.location,
      company: profile.company,
    }),
  },
  linuxdo: {
    auth: linuxDoProvider,
    callback: 'shared',
    endpoints: LINUXDO_ENDPOINTS,
    authorizationUrl: linuxDoAuthorizationUrl,
    exchange: exchangeLinuxDoCodeForIdentity,
    identity: (profile: Record<string, unknown>, _id: string) =>
      linuxDoIdentity(profile as Parameters<typeof linuxDoIdentity>[0]),
  },
} as const
export type TOauthProvider = keyof typeof OAUTH_PROVIDERS
/** Returns a registered OAuth provider, rejecting unknown IDs. */
export const oauthProvider = (id: string) =>
  Object.prototype.hasOwnProperty.call(OAUTH_PROVIDERS, id)
    ? OAUTH_PROVIDERS[id as TOauthProvider]
    : undefined
