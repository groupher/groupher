'use client'

import NextImage from 'next/image'
import { type FC, useMemo } from 'react'

import { MARKER } from '~/const/marker'
import type { TMarkerValue } from '~/spec'
import { getDevLogoFilePath, getDevLogoSrc } from '~/utils/icons'

import { DEV_LOGOS, type TDevLogo } from '../constant/dev_logo'
import useSalon from '../IconTab/salon'
import VirtualList from '../VirtualList'

type TProps = {
  query: string
  selectedValue: TMarkerValue
  onSelect: (name: TDevLogo) => void
}

type TLogoItem = TDevLogo

type TLogoContentProps = {
  item: TLogoItem
  active: boolean
}

const normalizeQuery = (value: string): string => value.trim().toLowerCase().replaceAll(/\s+/g, '')

const isSelectedDevLogo = (selectedValue: TMarkerValue, name: TDevLogo): boolean =>
  selectedValue.type === MARKER.ICON &&
  selectedValue.provider === 'dev' &&
  selectedValue.name === name

const LogoContent: FC<TLogoContentProps> = ({ item }) => {
  const src = getDevLogoSrc(getDevLogoFilePath(item))

  return (
    <NextImage
      src={src}
      width={24}
      height={24}
      alt=''
      unoptimized
      draggable={false}
      className='size-5 object-contain'
    />
  )
}

const DevTab: FC<TProps> = ({ query, selectedValue, onSelect }) => {
  const s = useSalon()

  const logos = useMemo<TDevLogo[]>(() => {
    const normalizedQuery = normalizeQuery(query)
    if (!normalizedQuery) return [...DEV_LOGOS]

    return DEV_LOGOS.filter((name) => name.includes(normalizedQuery))
  }, [query])

  return logos.length === 0 ? (
    <div className={s.emptyState}>no logo found</div>
  ) : (
    <VirtualList
      items={logos}
      viewportClassName={s.devViewport}
      gridRowClassName={s.gridRow}
      itemClassName={s.devCell}
      itemActiveClassName={s.cellActive}
      onItemClick={onSelect}
      isActive={(item) => isSelectedDevLogo(selectedValue, item)}
      getItemKey={(item) => item}
      ItemContent={LogoContent}
    />
  )
}

export default DevTab
