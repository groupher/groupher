/*
 *
 * FaIcons
 *
 */

import { type FC, useState } from 'react'
import { keys } from 'ramda'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import '@fortawesome/fontawesome-svg-core/styles.css'

import { COLOR_NAME } from '~/const/colors'
import type { TSpace, TColorName } from '~/spec'

import ArrowSVG from '~/icons/ArrowSolid'
import Tooltip from '~/widgets/Tooltip'

import type { TIcon } from './spec'
import FaIcon from './icons'
import Panel from './Panel'

import useSalon, { cn } from './salon/selector'

type TProps = {
  testid?: string
  size?: number
} & TSpace

const FaIcons: FC<TProps> = ({ testid = 'fa-icons', size = 16, ...spacing }) => {
  const s = useSalon({ ...spacing })

  const [panelOpen, setPanelOpen] = useState(false)
  const [selectColor, setSelectColor] = useState<TColorName>(COLOR_NAME.BLACK)

  const iconNames = keys(FaIcon)
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
          placement="bottom-start"
          hideOnClick={false}
          trigger="click"
          offset={[-5, 5]}
          onShow={() => setPanelOpen(true)}
          onHide={() => setPanelOpen(false)}
          noPadding
        >
          <div className="row">
            <div
              className={cn(s.iconBox, panelOpen && s.rainbow(selectColor, 'border'))}
              color={selectColor}
            >
              <FontAwesomeIcon icon={FaIcon[selectIcon]} fontSize={size} color={selectColor} />
            </div>

            <ArrowSVG className={cn(s.arrowIcon, panelOpen && 'opacity-100')} />
          </div>
        </Tooltip>
      </div>
    </div>
  )
}

export default FaIcons
