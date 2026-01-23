import type { FC } from 'react'

import Button from '~/widgets/Buttons/Button'

import useSalon from '../../salon/cms/filter_bar/action_bar'

type TProps = {
  onCancel: () => void
  selectedCount: number
}

const ActionBar: FC<TProps> = ({ onCancel, selectedCount }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.main}>
        <div className={s.note}>
          共选中 <div className={s.focus}>{selectedCount}</div> 条，
        </div>
        <div className={s.actionNotes}>
          <div className={s.note}>操作:</div>
          <div className={s.deleteNote}>删除</div>
        </div>
        <div className='grow' />
        <Button size='small' ghost noBorder onClick={onCancel}>
          取消
        </Button>
        <Button size='small' space={2}>
          确定
        </Button>
      </div>
    </div>
  )
}

export default ActionBar
