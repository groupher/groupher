import type { TDevLogo } from '~/widgets/MarkerPicker/constant/dev_logo'

const TWEMOJI_VERSION = '14.0.2'

export const getDevLogoFilePath = (name: TDevLogo): string => `/icons/devicon/${name}-original.svg`

/**
 * Builds the colored Devicon CDN URL from the persisted relative icon path.
 * SideTree stores relative paths only, so CDN host changes stay frontend-owned.
 */
export const getDevLogoSrc = (path: string): string => {
  const fileName = path.split('/').pop() ?? ''
  const name = fileName.replace(/-original\.svg$/, '') as TDevLogo

  return `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${name}/${name}-original.svg`
}

export const getTwemojiSrc = (unified: string): string =>
  `https://cdn.jsdelivr.net/gh/twitter/twemoji@${TWEMOJI_VERSION}/assets/svg/${unified}.svg`
