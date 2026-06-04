import { type FC, useState } from 'react'

import { COLOR } from '~/const/colors'
import ArrowSVG from '~/icons/ArrowSolid'
import type { TColorName, TSpace } from '~/spec'
import Tooltip from '~/widgets/Tooltip'

import FaIcon from '.'
import { ICONS } from './icons'
import Panel from './Panel'
import useSalon, { cn } from './salon/selector'
import type { TIcon } from './spec'

type TProps = {
  testid?: string
  size?: number
} & TSpace

const FaIcons: FC<TProps> = ({ testid: _testid = 'fa-icons', size = 16, ...spacing }) => {
  const s = useSalon({ ...spacing })

  const [panelOpen, setPanelOpen] = useState(false)
  const [selectColor, setSelectColor] = useState<TColorName>(COLOR.BLACK)

  const iconNames = ICONS.fa
  const [selectIcon, setSelectIcon] = useState<TIcon>(iconNames[0])

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <Tooltip
          content={
            <Panel
              panelOpen={panelOpen}
              selectIcon={selectIcon}
              selectColor={selectColor}
              onColorSelect={setSelectColor}
              onIconSelect={setSelectIcon}
            />
          }
          placement='bottom-start'
          hideOnClick={false}
          trigger='click'
          offset={[-5, 5]}
          onShow={() => setPanelOpen(true)}
          onHide={() => setPanelOpen(false)}
          noPadding
        >
          <div className='row'>
            <div
              className={cn(s.iconBox, panelOpen && s.rainbow(selectColor, 'border'))}
              color={selectColor}
            >
              <FaIcon color={selectColor} icon={selectIcon} size={size} />
            </div>

            <ArrowSVG className={cn(s.arrowIcon, panelOpen && 'opacity-100')} />
          </div>
        </Tooltip>
      </div>
    </div>
  )
}

export default FaIcons
