import type { ReactNode } from 'react'

import type { TSpace } from '~/spec'

export type TLogoListItem = {
  logoSrc: string
  text: string
  slogan: string
  href: string
  markdownHref: string
}

export type TLogoListProps = {
  items: readonly TLogoListItem[]
  wrap?: boolean
  suffix?: ReactNode
} & TSpace
