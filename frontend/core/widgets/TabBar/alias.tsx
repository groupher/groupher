import { mergeRight, clone, keys, findIndex, forEach } from 'ramda'

import type { TTabItem } from '~/spec'

const alias = {
  home: {
    user: 'CPer',
  },
  javascript: {
    user: 'JSer',
  },
  ruby: {
    user: 'Rubyist',
  },
  clojure: {
    user: 'Clojurist',
  },
  python: 'Pythoner',
}

export const mapAlias = (_source: TTabItem[], communitySlug: string): TTabItem[] => {
  const communityAlias = alias[communitySlug]
  const source = clone(_source)

  if (!communityAlias) return source

  const aliasKeys = keys(communityAlias)

  forEach((key) => {
    const index = findIndex((item) => item.slug === key, source)
    if (index >= 0) {
      source[index] = mergeRight(source[index], { alias: communityAlias[key] })
    }
  }, aliasKeys)

  return source
}

export const holder = 1
