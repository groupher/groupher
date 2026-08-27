import type { AnchorHTMLAttributes, ImgHTMLAttributes, ScriptHTMLAttributes } from 'react'

export type TRouteSearchValue = string | number | boolean | null | undefined

export type TRouteSearch = Record<string, TRouteSearchValue>

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

export type TRouteTarget = TDsbRouteTarget | TCommunityRouteTarget

export type TResolvedRouteMask = {
  to: string
  visibleHref: string
}

type TLinkDestination =
  | {
      route: TRouteTarget
      href?: never
      preserveSearch?: boolean
    }
  | {
      href: string
      route?: never
      preserveSearch?: never
    }

type TRouterNavigation = {
  navigation: 'router'
  mask?: TResolvedRouteMask
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
}

type TDocumentNavigation = {
  navigation: 'document'
  mask?: never
  prefetch?: never
  replace?: never
  scroll?: never
}

export type TLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  TLinkDestination &
  (TRouterNavigation | TDocumentNavigation)

export type TImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string
}

export type TScriptProps = ScriptHTMLAttributes<HTMLScriptElement> & {
  strategy?: 'mount' | 'idle'
}
