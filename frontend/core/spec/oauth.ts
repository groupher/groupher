import type { SOCIAL } from '~/const/oauth'

export type TOauthProvider = (typeof SOCIAL)[keyof typeof SOCIAL]
