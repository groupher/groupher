import type { FC } from 'react'

import SettingSVG from '~/icons/Setting'
import DeleteSVG from '~/icons/Delete'

import ToolUnit from './ToolUnit'

import useSalon, { cn } from '../salon/toolbox/action_block'

type TProps = {
  onDelete: () => void
  onReplace: () => void
}

const ActionBlock: FC<TProps> = ({ onDelete, onReplace }) => {
  const s = useSalon()

  return (
    <ToolUnit
      title="其他"
      icon={<SettingSVG className={s.icon} />}
      panel={
        <div className={s.panel}>
          <div className={s.item} onClick={onReplace}>
            替换图片
          </div>
          <div className={cn(s.item, s.deleteItem)} onClick={onDelete}>
            <DeleteSVG className={s.deleteIcon} />
            删除
          </div>
        </div>
      }
    />
  )
}

export default ActionBlock
