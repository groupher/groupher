'use client'

import { useLocation } from '@tanstack/react-router'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import Link from '~/platform/Link'

import { resolveCommunityPreviewMask } from '../../routes/community-preview'

type TProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  children?: ReactNode
  href: string
  previewId: string | number
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
}

/** Owns Community post, changelog, and Kanban drawer navigation semantics. */
export default function CommunityPreviewLink({
  children,
  href,
  previewId,
  prefetch,
  replace,
  scroll = false,
  ...props
}: TProps) {
  const { pathname } = useLocation()
  const mask = resolveCommunityPreviewMask({
    currentPathname: pathname,
    href,
    previewId,
  })

  return (
    <Link
      {...props}
      href={href}
      mask={mask ?? undefined}
      navigation='router'
      prefetch={prefetch}
      replace={replace}
      scroll={scroll}
    >
      {children}
    </Link>
  )
}
