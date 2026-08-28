'use client'

import type { ComponentType, SVGProps } from 'react'

import LayoutDashboardIcon from '~/icons/LayoutDashboard'
import LayoutMenuIcon from '~/icons/LayoutMenu'
import LayoutTableIcon from '~/icons/LayoutTable'
import Tooltip from '~/ui/Tooltip'

import { ASSETS_HUB_LIST_VIEW, ASSETS_HUB_LIST_VIEW_OPTIONS } from '../constant'
import type { TAssetListViewMode } from '../spec'
import useSalon from './salon/layout_switcher'

const ICON_BY_VIEW_MODE: Record<TAssetListViewMode, ComponentType<SVGProps<SVGSVGElement>>> = {
  [ASSETS_HUB_LIST_VIEW.SINGLE]: LayoutMenuIcon,
  [ASSETS_HUB_LIST_VIEW.DOUBLE]: LayoutTableIcon,
  [ASSETS_HUB_LIST_VIEW.MASONRY]: LayoutDashboardIcon,
}

type TProps = {
  viewMode: TAssetListViewMode
  onViewModeChange: (mode: TAssetListViewMode) => void
}

export default function LayoutSwitcher({ viewMode, onViewModeChange }: TProps) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {ASSETS_HUB_LIST_VIEW_OPTIONS.map((option) => {
        const active = option.mode === viewMode
        const Icon = ICON_BY_VIEW_MODE[option.mode]

        return (
          <Tooltip key={option.mode} content={option.label} placement='top'>
            <button
              type='button'
              className={s.option({ active })}
              aria-label={option.label}
              aria-pressed={active}
              onClick={() => onViewModeChange(option.mode)}
            >
              <Icon className={s.icon} />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}
