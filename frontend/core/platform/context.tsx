'use client'

import { createContext, useContext } from 'react'
import type {
  AnchorHTMLAttributes,
  ComponentType,
  ImgHTMLAttributes,
  Ref,
  ReactNode,
  ScriptHTMLAttributes,
} from 'react'

export type TNaviOptions = {
  replace?: boolean
  preserveSearch?: boolean
}

export type TPlatformSearchValue = string | number | boolean | null | undefined

export type TPlatformSearch = Record<string, TPlatformSearchValue>

export type TRouteTarget = TDsbRouteTarget

export type TPlatformLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  prefetch?: boolean
  replace?: boolean
  scroll?: boolean
}

export type TPlatformImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  alt: string
  fill?: boolean
  priority?: boolean
  ref?: Ref<HTMLImageElement>
  sizes?: string
  src: string | { src: string }
  unoptimized?: boolean
}

export type TPlatformScriptProps = ScriptHTMLAttributes<HTMLScriptElement> & {
  strategy?: 'afterInteractive' | 'beforeInteractive' | 'lazyOnload'
}

export type TDsbRouteTarget = {
  app: 'dsb'
  community: string
  path: string
  search?: TPlatformSearch
  searchSchema?: readonly string[]
  preserveSearchKeys?: readonly string[]
}

export type TPlatformNavi = {
  location: {
    pathname: string
    search: string
    searchParams: URLSearchParams
  }
  to: (target: TDsbRouteTarget, options?: TNaviOptions) => void
  push: (href: string, options?: { scroll?: boolean }) => void
  replace: (href: string, options?: { scroll?: boolean }) => void
  back: () => void
  forward: () => void
  refresh: () => void
  prefetch: (href: string) => Promise<void>
  isActive: (target: TDsbRouteTarget) => boolean
}

export type TPlatform = {
  navi: TPlatformNavi
  components: {
    Image: ComponentType<TPlatformImageProps>
    Link: ComponentType<TPlatformLinkProps>
    Script: ComponentType<TPlatformScriptProps>
  }
}

const PlatformContext = createContext<TPlatform | null>(null)
let platformFallback: TPlatform | null = null

export const setPlatformFallback = (value: TPlatform | null): void => {
  platformFallback = value
}

export const PlatformProvider = ({
  value,
  children,
}: {
  value: TPlatform
  children: ReactNode
}): ReactNode => <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>

export const usePlatform = (): TPlatform => {
  const platform = useContext(PlatformContext)

  if (!platform && !platformFallback) {
    throw new Error('usePlatform must be used inside a PlatformProvider')
  }

  return platform ?? platformFallback!
}
