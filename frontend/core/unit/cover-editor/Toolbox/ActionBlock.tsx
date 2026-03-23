import type { FC } from 'react'
import DeleteSVG from '~/icons/Delete'
import SettingSVG from '~/icons/Setting'
import useSalon, { cn } from '../salon/toolbox/action_block'
import ToolUnit from './ToolUnit'

type TProps = {
  onDelete: () => void
  onReplace: () => void
}

const ActionBlock: FC<TProps> = ({ onDelete, onReplace }) => {
  const s = useSalon()

  return (
    <ToolUnit
      title='其他'
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
