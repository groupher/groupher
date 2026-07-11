import Link from 'next/link'
import type { FC } from 'react'

import type { TDocPublicTreeTab } from '~/spec'

import useSalon, { cn } from './salon'

type TProps = {
  activeTabId: string | null
  tabs: readonly TDocPublicTreeTab[]
  onSelect: (id: string) => void
}

const firstHref = (tab: TDocPublicTreeTab): string | null => {
  for (const group of tab.groups) {
    const href = group.children?.find((child) => child.href)?.href
    if (href) return href
  }

  return tab.pins.find((pin) => pin.href)?.href ?? null
}

const Tabs: FC<TProps> = ({ activeTabId, tabs, onSelect }) => {
  const s = useSalon()

  if (tabs.length < 2) return null

  return (
    <nav className={s.wrapper} aria-label='Docs tabs'>
      {tabs.map((tab) => {
        const active = tab.id === activeTabId
        const className = cn(s.tab, active && s.tabActive)
        const href = firstHref(tab)

        return href ? (
          <Link
            key={tab.id}
            className={className}
            href={href}
            aria-current={active ? 'page' : undefined}
          >
            {tab.title}
          </Link>
        ) : (
          <button key={tab.id} type='button' className={className} onClick={() => onSelect(tab.id)}>
            {tab.title}
          </button>
        )
      })}
    </nav>
  )
}

export default Tabs
