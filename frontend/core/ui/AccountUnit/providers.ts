import Github from '~/icons/social/Github'
import LinuxDo from '~/icons/social/LinuxDo'
import type { TOauthProvider } from '~/spec'

export const OAUTH_DISPLAY = {
  github: { name: 'GitHub', Icon: Github },
  linuxdo: { name: 'Linux DO', Icon: LinuxDo },
} satisfies Record<TOauthProvider, { name: string; Icon: typeof Github }>

/** Returns display metadata only for recognized OAuth providers. */
export const oauthDisplay = (provider: string) =>
  Object.prototype.hasOwnProperty.call(OAUTH_DISPLAY, provider)
    ? OAUTH_DISPLAY[provider as TOauthProvider]
    : undefined
