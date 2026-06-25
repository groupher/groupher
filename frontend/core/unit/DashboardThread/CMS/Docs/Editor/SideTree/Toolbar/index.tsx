import type { ComponentType, FC, SVGProps } from 'react'

import FilePlusSVG from '~/icons/FilePlus'
import FolderPlusSVG from '~/icons/FolderPlus'
import MagnifyingGlassSVG from '~/icons/MagnifyingGlass'
import MapPinPlusSVG from '~/icons/MapPinPlus'
import MoreSVG from '~/icons/menu/MoreL'

import useSalon from '../salon/toolbar'

type TToolbarAction = {
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  compact?: boolean
}

const ACTIONS: TToolbarAction[] = [
  { label: 'Top', Icon: MapPinPlusSVG },
  { label: 'Group', Icon: FolderPlusSVG },
  { label: 'Doc', Icon: FilePlusSVG },
  { label: 'More', Icon: MoreSVG, compact: true },
]

const Toolbar: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <button type='button' className={s.search} aria-label='Search docs tree' title='Search'>
        <MagnifyingGlassSVG className={s.searchIcon} />
        <span className={s.searchText}>Search</span>
      </button>

      <div className={s.actions}>
        {ACTIONS.map(({ label, Icon, compact }) => (
          <button
            key={label}
            type='button'
            className={compact ? s.moreButton : s.actionButton}
            aria-label={compact ? 'More tree actions' : `Add ${label}`}
            title={compact ? 'More tree actions' : `Add ${label}`}
          >
            <Icon className={s.actionIcon} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default Toolbar
