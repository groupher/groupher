'use client'

import { createContext, useContext } from 'react'
import type {
  AnchorHTMLAttributes,
  ImgHTMLAttributes,
  ReactNode,
  Ref,
  ScriptHTMLAttributes,
} from 'react'

import type { TDsbRouteRootSegment } from './route'

export type TNaviOptions = {
  replace?: boolean
  preserveSearch?: boolean
  previewId?: string | number
  scroll?: boolean
}

export type TRouteSearchValue = string | number | boolean | null | undefined

export type TRouteSearch = Record<string, TRouteSearchValue>

export type TRouteTarget = TDsbRouteTarget | TCommunityRouteTarget

export type TLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href?: string
  route?: TRouteTarget
  previewId?: string | number
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
  preserveSearch?: boolean
}

export type TImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  alt: string
  fill?: boolean
  priority?: boolean
  ref?: Ref<HTMLImageElement>
  sizes?: string
  src: string | { src: string }
  unoptimized?: boolean
}

export type TScriptProps = ScriptHTMLAttributes<HTMLScriptElement> & {
  strategy?: 'afterInteractive' | 'beforeInteractive' | 'lazyOnload'
}

export type TDsbRouteTarget = {
  app: 'dsb'
  community: string
  path: string
  search?: TRouteSearch
  searchSchema?: readonly string[]
  preserveSearchKeys?: readonly string[]
}

export type TCommunityRouteTarget = {
  app: 'community'
  community: string
  path: string
  search?: TRouteSearch
  searchSchema?: readonly string[]
  preserveSearchKeys?: readonly string[]
}

export type TRouteNavigation = {
  /** Identifies the DSB product adapter; it is not emitted as a URL segment. */
  dsbRootSegment?: TDsbRouteRootSegment
  location: {
    pathname: string
    search: string
    searchParams: URLSearchParams
  }
  to: (target: TRouteTarget, options?: TNaviOptions) => void
  push: (href: string, options?: { scroll?: boolean }) => void
  replace: (href: string, options?: { scroll?: boolean }) => void
  back: () => void
  forward: () => void
  refresh: () => void
  prefetch: (href: string) => Promise<void>
  isActive: (target: TRouteTarget) => boolean
}

export type TRouteScope = { navi: TRouteNavigation }

const RouteScopeContext = createContext<TRouteScope | null>(null)

export const RouteScopeProvider = ({
  value,
  children,
}: {
  value: TRouteScope
  children: ReactNode
}): ReactNode => <RouteScopeContext.Provider value={value}>{children}</RouteScopeContext.Provider>

/** Exposes router-neutral route state and actions through the shared React boundary. */
export const useRouteScope = (): TRouteScope => {
  const scope = useContext(RouteScopeContext)

  if (!scope) {
    throw new Error('useRouteScope must be used inside a RouteScopeProvider')
  }

  return scope
}
