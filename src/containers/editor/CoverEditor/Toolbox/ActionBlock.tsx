import { type FC, useState, Fragment } from 'react'

import Tooltip from '~/widgets/Tooltip'

import SettingSVG from '~/icons/Setting'
import DeleteSVG from '~/icons/Delete'

import useSalon, { cn } from '../salon/toolbox/action_block'

type TProps = {
  onDelete: () => void
  onReplace: () => void
}

const ActionBlock: FC<TProps> = ({ onDelete, onReplace }) => {
  const s = useSalon()
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <div className={s.wrapper}>
      <Tooltip
        content={
          <Fragment>
            {panelOpen && (
              <div className={s.panel}>
                <div className={s.item} onClick={onReplace}>
                  替换图片
                </div>
                <div className={cn(s.item, s.deleteItem)} onClick={onDelete}>
                  <DeleteSVG className={s.deleteIcon} />
                  删除
                </div>
              </div>
            )}
          </Fragment>
        }
        placement="top"
        trigger="mouseenter focus"
        onShow={() => setPanelOpen(true)}
        onHide={() => setPanelOpen(false)}
        hideOnClick={false}
        offset={[-1, 5]}
        noPadding
      >
        <div className={cn(s.block, panelOpen && s.blockActive)}>
          <SettingSVG className={s.icon} />
        </div>
      </Tooltip>

      <div className={s.title}>其他</div>
    </div>
  )
}

export default ActionBlock
